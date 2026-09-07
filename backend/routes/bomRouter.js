import { Router } from 'express';
import { pool, withTransaction } from '../db.js';
import { generateWorkOrderForSalesOrder } from '../services/sfcTriggerService.js';

const router = Router();

router.post('/create', async (req, res) => {
    const { productId, revisionNumber, operations } = req.body;

    if (!productId || !operations || !Array.isArray(operations) || operations.length === 0) {
        return res.status(400).json({ error: "Missing structural parameters. Provide a valid product ID and an operations array." });
    }

    try {
        await pool.query('BEGIN');

        // Check or inject the base root router record tracking row
        let bomRouterId;
        const existingRouter = await pool.query("SELECT id FROM bom_routers WHERE product_id = $1 AND revision_number = $2", [productId, revisionNumber]);
        
        if (existingRouter.rows.length > 0) {
            bomRouterId = existingRouter.rows[0].id;
        } else {
            const insertRouterQuery = `INSERT INTO bom_routers (product_id, revision_number) VALUES ($1, $2) RETURNING id;`;
            const routerResult = await pool.query(insertRouterQuery, [productId, revisionNumber || 'Rev A']);
            bomRouterId = routerResult.rows[0].id;
        }

        const insertOpQuery = `
            INSERT INTO router_operations (bom_router_id, sequence_number, work_center, setup_time_hours, estimated_run_time_hours) 
            VALUES ($1, $2, $3, $4, $5);
        `;

        for (const op of operations) {
            await pool.query(insertOpQuery, [
                bomRouterId,
                parseInt(op.sequenceNumber, 10),
                op.workCenter,
                parseFloat(op.setupTimeHours || 0),
                parseFloat(op.estimatedRunTimeHours || 0)
            ]);
        }

        await pool.query('COMMIT');
        res.status(201).json({ message: "Global Shop routing sequence steps initialized successfully!", bomRouterId });
    } catch (error) {
        await pool.query('ROLLBACK');
        res.status(500).json({ error: "Internal Database Transaction Failure.", details: error.message });
    }
});

/* ============================================================
   LOOP 2: MULTI-LEVEL BOM EXPLODER (Bill of Materials Module)
   GET /api/bom/explode/:partNumber
   Recursively traces a parent part/product down to absolute base
   raw materials through nested BOM trees, returning a flat array
   with combined total quantities per raw stock item.
   ============================================================ */
router.get('/explode/:partNumber', async (req, res) => {
    const parentKey = String(req.params.partNumber || '').trim();
    if (!parentKey) {
        return res.status(400).json({ error: "A parent part number is required." });
    }

    try {
        // Recursive descent: products/skus map to a BOM; components either reference
        // a raw part (part_id) or a nested sub-assembly product (component_product_id)
        // which is exploded again. Cycle-safe via path tracking.
        const result = await pool.query(`
            WITH RECURSIVE explosion AS (
                -- Anchor: components of the root product's active BOM
                SELECT bc.id,
                       bc.part_id,
                       bc.component_product_id,
                       bc.quantity::numeric AS qty,
                       1 AS lvl,
                       ARRAY[bc.id] AS path
                FROM boms b
                JOIN products p ON p.id = b.product_id
                JOIN bom_components bc ON bc.bom_id = b.id
                WHERE (p.sku = $1 OR p.name = $1) AND b.status <> 'inactive'

                UNION ALL

                -- Recursive: explode nested sub-assembly products
                SELECT bc.id,
                       bc.part_id,
                       bc.component_product_id,
                       (e.qty * bc.quantity)::numeric AS qty,
                       e.lvl + 1,
                       e.path || bc.id
                FROM explosion e
                JOIN products sub ON sub.id = e.component_product_id
                JOIN boms b ON b.product_id = sub.id AND b.status <> 'inactive'
                JOIN bom_components bc ON bc.bom_id = b.id
                WHERE NOT bc.id = ANY(e.path)  -- cycle guard
                  AND e.lvl < 25               -- depth guard
            )
            SELECT e.lvl,
                   COALESCE(pt.part_number, sp.sku) AS part_number,
                   COALESCE(pt.description, sp.name) AS description,
                   pt.unit,
                   e.qty,
                   (e.component_product_id IS NOT NULL) AS is_subassembly
            FROM explosion e
            LEFT JOIN parts pt ON pt.id = e.part_id
            LEFT JOIN products sp ON sp.id = e.component_product_id
            ORDER BY e.lvl, part_number
        `, [parentKey]);

        // Flatten: aggregate absolute combined totals for base raw materials only
        const flat = new Map();
        for (const row of result.rows) {
            if (row.is_subassembly) continue; // sub-assemblies roll up into their raw leaves
            const key = row.part_number;
            const entry = flat.get(key) || {
                partNumber: key,
                description: row.description,
                unit: row.unit || 'each',
                totalQuantity: 0,
                levels: new Set()
            };
            entry.totalQuantity += Number(row.qty);
            entry.levels.add(row.lvl);
            flat.set(key, entry);
        }

        const materials = [...flat.values()].map((m) => ({
            partNumber: m.partNumber,
            description: m.description,
            unit: m.unit,
            totalQuantity: Number(m.totalQuantity.toFixed(4)),
            deepestLevel: Math.max(...m.levels)
        }));

        return res.status(200).json({
            success: true,
            parent: parentKey,
            rawMaterialCount: materials.length,
            materials
        });
    } catch (error) {
        console.error("BOM Explode Error:", error.message);
        return res.status(500).json({ success: false, error: "Failed to explode BOM", message: error.message });
    }
});

/* ============================================================
   LOOP 1 TRIGGER: Sales Order Submission (Order Entry → SFC)
   POST /api/bom/submit-sales-order
   Creates the Sales Order then fires the SFC trigger hook: if the
   part is short in the Material Master, a Work Order + standard
   routing sequences are auto-generated and linked to the order.
   ============================================================ */
router.post('/submit-sales-order', async (req, res) => {
    const { orderNumber, customerId, partNumber, quantityOrdered, unitPrice = 0, requiredDate = null } = req.body || {};

    if (!orderNumber || !customerId || !partNumber || !(Number(quantityOrdered) > 0)) {
        return res.status(400).json({ error: "orderNumber, customerId, partNumber, and a positive quantityOrdered are required." });
    }

    try {
        const outcome = await withTransaction(async (client) => {
            // 1. Record the Sales Order (Order Entry module)
            const soRes = await client.query(
                `INSERT INTO sales_orders (order_number, customer_id, quantity_ordered, unit_price, required_date, status)
                 VALUES ($1, $2, $3, $4, $5, 'Released')
                 ON CONFLICT (order_number) DO UPDATE SET status = 'Released'
                 RETURNING id`,
                [String(orderNumber), String(customerId), Number(quantityOrdered), Number(unitPrice) || 0, requiredDate]
            );
            const salesOrderId = Number(soRes.rows[0].id);

            // 2. Fire the SFC trigger hook (checks Material Master, generates WO + routing if short)
            // Pass the live transaction client so the auto-generated work order can
            // reference the not-yet-committed sales order row without an FK violation.
            const trigger = await generateWorkOrderForSalesOrder({
                id: salesOrderId,
                orderNumber: String(orderNumber),
                partNumber: String(partNumber),
                quantityOrdered: Number(quantityOrdered),
                requiredDate
            }, client);

            return { salesOrderId, trigger };
        });

        return res.status(201).json({
            success: true,
            salesOrderId: outcome.salesOrderId,
            workOrderGenerated: outcome.trigger.created === true,
            trigger: outcome.trigger,
            message: outcome.trigger.created
                ? `Sales order captured. Shortfall of ${outcome.trigger.shortfall} detected — Work Order ${outcome.trigger.orderNumber} auto-generated with standard routing.`
                : "Sales order captured. Material Master has sufficient stock — no work order generated."
        });
    } catch (error) {
        console.error("Sales Order Trigger Error:", error.message);
        return res.status(500).json({ success: false, error: "Failed to submit sales order", message: error.message });
    }
});

export default router;
