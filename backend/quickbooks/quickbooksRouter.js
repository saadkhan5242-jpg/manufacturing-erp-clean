import { Router } from "express";
import { pool } from "../db.js";

const router = Router();

/* ============================================================
   FORGELOGIC AI — QUICKBOOKS ONLINE INTEGRATION
   OAuth2 + reliable sync queue. When QBO credentials are not
   configured, the layer runs in "queue-only" mode: it records
   sync intents to fl_quickbooks_sync_queue and reports a clear
   "not connected" status, so the UI never breaks. Set the env
   vars to go live:
     QB_CLIENT_ID, QB_CLIENT_SECRET, QB_REDIRECT_URI, QB_ENV
   ============================================================ */

const QB_CONFIGURED = !!(process.env.QB_CLIENT_ID && process.env.QB_CLIENT_SECRET);
const QB_BASE = process.env.QB_ENV === "production" ? "https://quickbooks.api.intuit.com" : "https://sandbox-quickbooks.api.intuit.com";

async function getAuth() {
  const r = await pool.query(`SELECT * FROM fl_quickbooks_auth ORDER BY id DESC LIMIT 1`);
  return r.rows[0] || null;
}

async function qbFetch(path, options = {}) {
  const auth = await getAuth();
  if (!auth || !auth.connected || !auth.access_token) {
    throw new Error("QuickBooks is not connected. Complete OAuth first.");
  }
  const res = await fetch(`${QB_BASE}/v3/company/${auth.realm_id}${path}`, {
    ...options,
    headers: { Authorization: `Bearer ${auth.access_token}`, "Content-Type": "application/json", Accept: "application/json", ...(options.headers || {}) }
  });
  if (!res.ok) throw new Error(`QuickBooks API error ${res.status}`);
  return res.json();
}

// Enqueue a sync intent (reliable, retryable)
async function enqueue(entityType, operation, localId, payload) {
  const r = await pool.query(
    `INSERT INTO fl_quickbooks_sync_queue (entity_type, operation, local_id, payload) VALUES ($1,$2,$3,$4) RETURNING id`,
    [entityType, operation, localId || null, JSON.stringify(payload)]
  );
  return Number(r.rows[0].id);
}

// ---------- STATUS ----------
router.get("/status", async (_req, res) => {
  const auth = await getAuth();
  const pending = await pool.query(`SELECT COUNT(*)::int AS n FROM fl_quickbooks_sync_queue WHERE status = 'pending'`);
  res.json({
    success: true,
    configured: QB_CONFIGURED,
    connected: auth?.connected === true,
    realmId: auth?.realm_id || null,
    environment: process.env.QB_ENV || "sandbox",
    pendingSyncItems: pending.rows[0].n
  });
});

// ---------- OAUTH ----------
router.get("/connect", (_req, res) => {
  if (!QB_CONFIGURED) return res.status(400).json({ success: false, error: "QB_CLIENT_ID/QB_CLIENT_SECRET not configured" });
  const scope = "com.intuit.quickbooks.accounting";
  const url = `https://appcenter.intuit.com/connect/oauth2?client_id=${process.env.QB_CLIENT_ID}&redirect_uri=${encodeURIComponent(process.env.QB_REDIRECT_URI || "http://localhost:4000/api/quickbooks/callback")}&response_type=code&scope=${scope}&state=forgelogic`;
  res.json({ success: true, authUrl: url });
});

router.get("/callback", async (req, res) => {
  const { code, realmId } = req.query;
  if (!code) return res.status(400).send("Missing auth code");
  try {
    const tokenRes = await fetch("https://oauth.platform.intuit.com/oauth2/v1/tokens/bearer", {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded", Authorization: "Basic " + Buffer.from(`${process.env.QB_CLIENT_ID}:${process.env.QB_CLIENT_SECRET}`).toString("base64") },
      body: new URLSearchParams({ grant_type: "authorization_code", code, redirect_uri: process.env.QB_REDIRECT_URI || "http://localhost:4000/api/quickbooks/callback" })
    });
    const tokens = await tokenRes.json();
    if (!tokenRes.ok) throw new Error(tokens.error_description || "token exchange failed");
    await pool.query(`DELETE FROM fl_quickbooks_auth`);
    await pool.query(
      `INSERT INTO fl_quickbooks_auth (realm_id, access_token, refresh_token, token_expires_at, connected) VALUES ($1,$2,$3,$4,TRUE)`,
      [realmId, tokens.access_token, tokens.refresh_token, new Date(Date.now() + tokens.expires_in * 1000)]
    );
    res.send("<h2>ForgeLogic AI connected to QuickBooks.</h2><p>You can close this window.</p>");
  } catch (e) {
    res.status(500).send("QuickBooks connection failed: " + e.message);
  }
});

// ---------- SYNC ENDPOINTS (queue + push) ----------
const SYNCABLE = {
  customers: { entity: "customer", table: "fl_customers", qbPath: "/customer" },
  vendors: { entity: "vendor", table: "fl_vendors", qbPath: "/vendor" },
  "purchase-orders": { entity: "purchase_order", table: "fl_purchase_orders", qbPath: "/purchaseorder" },
  bills: { entity: "bill", table: null, qbPath: "/bill" },
  invoices: { entity: "invoice", table: null, qbPath: "/invoice" },
  payments: { entity: "payment", table: null, qbPath: "/payment" },
  "job-costing": { entity: "job_costing", table: "fl_jobs", qbPath: null }
};

router.post("/sync/:entity", async (req, res) => {
  const key = req.params.entity;
  const cfg = SYNCABLE[key];
  if (!cfg) return res.status(404).json({ success: false, error: `Unknown sync entity: ${key}` });
  try {
    const auth = await getAuth();
    // Pull local records to sync
    let records = [];
    if (cfg.table) {
      const r = await pool.query(`SELECT * FROM ${cfg.table} ORDER BY id DESC LIMIT 50`);
      records = r.rows;
    } else if (Array.isArray(req.body?.records)) {
      records = req.body.records;
    }
    const queued = [];
    for (const rec of records) {
      const qid = await enqueue(cfg.entity, "create", rec.id || null, rec);
      queued.push(qid);
    }

    // If connected, attempt an immediate push of the queue
    let pushed = 0;
    if (auth?.connected && cfg.qbPath) {
      const pendingRows = await pool.query(`SELECT * FROM fl_quickbooks_sync_queue WHERE id = ANY($1)`, [queued]);
      for (const row of pendingRows.rows) {
        try {
          await qbFetch(cfg.qbPath, { method: "POST", body: JSON.stringify(mapToQbo(cfg.entity, row.payload)) });
          await pool.query(`UPDATE fl_quickbooks_sync_queue SET status='synced', synced_at=NOW() WHERE id=$1`, [row.id]);
          pushed++;
        } catch (e) {
          await pool.query(`UPDATE fl_quickbooks_sync_queue SET status='failed', attempts=attempts+1, last_error=$1 WHERE id=$2`, [e.message, row.id]);
        }
      }
    }

    res.json({ success: true, entity: key, queued: queued.length, pushed, connected: auth?.connected === true, note: auth?.connected ? "Synced to QuickBooks" : "Queued — connect QuickBooks to push" });
  } catch (e) {
    res.status(500).json({ success: false, error: e.message });
  }
});

// ---------- QUEUE INSPECTION ----------
router.get("/queue", async (_req, res) => {
  const r = await pool.query(`SELECT * FROM fl_quickbooks_sync_queue ORDER BY created_at DESC LIMIT 100`);
  res.json({ success: true, queue: r.rows });
});

// ---------- WEBHOOKS ----------
router.post("/webhook", async (req, res) => {
  // Intuit sends an X-Intuit-Signature; verify in production with the verifier token
  const events = req.body?.eventNotifications || [];
  for (const ev of events) {
    for (const ent of ev.dataChangeEvent?.entities || []) {
      await enqueue(ent.name?.toLowerCase() || "unknown", "update", null, ent);
    }
  }
  res.status(200).json({ received: true, processed: events.length });
});

// Map local entity to a minimal QBO payload
function mapToQbo(entity, payload) {
  if (entity === "customer") return { DisplayName: payload.name || payload.code };
  if (entity === "vendor") return { DisplayName: payload.name || payload.code };
  if (entity === "purchase_order") return { VendorRef: { value: String(payload.vendor_id || "") }, TotalAmt: Number(payload.total_cost || 0) };
  return payload;
}

export default router;
