import express from "express";
import rateLimit from "express-rate-limit";
import { query, withTransaction } from "../db.js";

const router = express.Router();
const intakeLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 30,
  standardHeaders: "draft-8",
  legacyHeaders: false,
  message: { error: "Too many document intake requests. Try again later." }
});
const MAX_UPLOAD_BYTES = 10 * 1024 * 1024;

function validateUploadRequest(req, res, next) {
  const contentLength = Number(req.get("content-length") || 0);
  if (contentLength > MAX_UPLOAD_BYTES) {
    return res.status(413).json({ error: "Uploaded document exceeds the 10 MB limit" });
  }
  if (!req.is("multipart/form-data") && !req.is("application/json")) {
    return res.status(415).json({ error: "Document intake requires multipart form data or JSON" });
  }
  return next();
}

/**
 * POST /upload
 * Simulates OCR parsing of supplier invoices
 * Accepts multipart form data with file uploads
 * Returns extracted invoice data in standardized JSON format
 */
router.post("/upload", intakeLimiter, validateUploadRequest, (req, res) => {
  try {
    // Simulate AI/OCR parsing with mock invoice extraction
    const parsedInvoice = {
      success: true,
      vendorName: "Northstar Steel Supply LLC",
      invoiceNumber: "INV-2026-981",
      invoiceDate: "2026-09-05",
      lineItems: [
        {
          partNumber: "MAT-STEEL-01",
          description: "A36 Cold Rolled Structural Steel Sheet (4x8)",
          quantity: 10,
          unitPrice: 45.00,
          totalPrice: 450.00
        },
        {
          partNumber: "MAT-ALUM-05",
          description: "6061-T6 Aluminum Flat Bar Stock (2-inch)",
          quantity: 4,
          unitPrice: 22.50,
          totalPrice: 90.00
        }
      ],
      totalAmount: 540.00
    };

    return res.status(200).json(parsedInvoice);
  } catch (error) {
    return res.status(500).json({
      success: false,
      error: "Document parsing failed",
      message: error.message
    });
  }
});

/**
 * POST /post-ledger
 * LAYER 1: Automated Invoice Inventory Injections (Option A)
 * Posts approved invoice to AP ledger and automatically updates inventory
 * Executes within PostgreSQL transaction for consistency
 */
router.post("/post-ledger", async (req, res) => {
  try {
    const { vendorName, invoiceNumber, invoiceDate, lineItems, totalAmount } = req.body;

    if (!vendorName || !invoiceNumber || !lineItems || !lineItems.length) {
      return res.status(400).json({ error: "Missing required invoice fields" });
    }

    // Execute database transaction: INSERT AP invoice + UPSERT inventory
    const result = await withTransaction(async (client) => {
      // Step 1: INSERT AP invoice record with parameterized query
      const apInsertText = `
        INSERT INTO ap_invoices 
        (vendor_name, invoice_number, invoice_date, total_amount, created_at)
        VALUES ($1, $2, $3, $4, CURRENT_TIMESTAMP)
        RETURNING id, created_at;
      `;
      
      const apResult = await client.query(apInsertText, [
        vendorName,
        invoiceNumber,
        invoiceDate,
        totalAmount
      ]);

      const apInvoiceId = apResult.rows[0].id;

      // Step 2: Loop through lineItems and UPSERT inventory (INSERT ... ON CONFLICT)
      for (const item of lineItems) {
        const inventoryUpsertText = `
          INSERT INTO inventory 
          (part_number, description, quantity, unit_price, last_updated)
          VALUES ($1, $2, $3, $4, CURRENT_TIMESTAMP)
          ON CONFLICT (part_number) DO UPDATE SET
            quantity = inventory.quantity + EXCLUDED.quantity,
            last_updated = CURRENT_TIMESTAMP
          RETURNING part_number, quantity;
        `;

        await client.query(inventoryUpsertText, [
          item.partNumber,
          item.description,
          item.quantity,
          item.unitPrice
        ]);

        // Module 7: stream the receipt into the movement ledger so live-levels meters increment
        await client.query(
          `INSERT INTO inventory_movements (part_number, change_qty, source, reference)
           VALUES ($1, $2, 'AP_INVOICE', $3)`,
          [item.partNumber, item.quantity, invoiceNumber]
        );
      }

      return { apInvoiceId, processedItems: lineItems.length };
    });

    return res.status(201).json({
      success: true,
      message: "Invoice posted to AP ledger and inventory updated automatically",
      apInvoiceId: result.apInvoiceId,
      inventoryUpdated: result.processedItems
    });
  } catch (error) {
    console.error("AP Ledger Posting Error:", error.message);
    return res.status(500).json({
      success: false,
      error: "Failed to post invoice to ledger",
      message: error.message
    });
  }
});

/**
 * GET /ledger
 * LAYER 2: AP Supervisor Audit Ledger (Option B)
 * Fetches all recorded AP invoices from database
 * Returns paginated results with filtering support
 */
router.get("/ledger", async (req, res) => {
  try {
    const { vendor, startDate, endDate, limit = 100, offset = 0 } = req.query;

    let queryText = `
      SELECT id, vendor_name, invoice_number, invoice_date, total_amount, created_at
      FROM ap_invoices
      WHERE 1=1
    `;
    const params = [];
    let paramCount = 1;

    // Add optional filters with parameterized queries
    if (vendor) {
      queryText += ` AND vendor_name ILIKE $${paramCount}`;
      params.push(`%${vendor}%`);
      paramCount++;
    }

    if (startDate) {
      queryText += ` AND invoice_date >= $${paramCount}`;
      params.push(startDate);
      paramCount++;
    }

    if (endDate) {
      queryText += ` AND invoice_date <= $${paramCount}`;
      params.push(endDate);
      paramCount++;
    }

    queryText += ` ORDER BY created_at DESC LIMIT $${paramCount} OFFSET $${paramCount + 1}`;
    params.push(parseInt(limit, 10), parseInt(offset, 10));

    const result = await query(queryText, params);

    return res.status(200).json({
      success: true,
      invoices: result.rows,
      total: result.rows.length
    });
  } catch (error) {
    console.error("Ledger Query Error:", error.message);
    return res.status(500).json({
      success: false,
      error: "Failed to fetch AP invoices",
      message: error.message
    });
  }
});

export default router;
