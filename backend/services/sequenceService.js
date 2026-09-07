import { pool, withTransaction } from "../db.js";

/* ============================================================
   AUTO-SEQUENCING NEXT-NUMBER SERVICE
   Thread-safe atomic counter for WORK_ORDER / SALES_ORDER /
   PURCHASE_ORDER. Increments the central sequencer table and
   returns a formatted tracking string (e.g. 'WO-1002').
   ============================================================ */

const SEQUENCE_CONFIG = {
  WORK_ORDER: { prefix: "WO" },
  SALES_ORDER: { prefix: "SO" },
  PURCHASE_ORDER: { prefix: "PO" }
};

/**
 * Atomically increment and return the next formatted sequence number.
 * Uses SELECT ... FOR UPDATE inside a transaction to guarantee
 * thread-safety under concurrent requests.
 *
 * @param {"WORK_ORDER"|"SALES_ORDER"|"PURCHASE_ORDER"} sequenceType
 * @returns {Promise<string>} formatted tracking number, e.g. 'WO-1002'
 */
export async function getNextSequenceNumber(sequenceType) {
  const config = SEQUENCE_CONFIG[sequenceType];
  if (!config) {
    throw new Error(`Unknown sequenceType: ${sequenceType}. Expected WORK_ORDER, SALES_ORDER, or PURCHASE_ORDER.`);
  }

  return withTransaction(async (client) => {
    // Lock the counter row for the duration of the transaction
    const lockRes = await client.query(
      `SELECT current_value FROM sequence_counters WHERE sequence_type = $1 FOR UPDATE`,
      [sequenceType]
    );

    let nextValue;
    if (lockRes.rows.length === 0) {
      // First use — create the counter starting at 1000
      const insertRes = await client.query(
        `INSERT INTO sequence_counters (sequence_type, prefix, current_value)
         VALUES ($1, $2, 1001)
         RETURNING current_value`,
        [sequenceType, config.prefix]
      );
      nextValue = insertRes.rows[0].current_value;
    } else {
      nextValue = Number(lockRes.rows[0].current_value) + 1;
      await client.query(
        `UPDATE sequence_counters SET current_value = $1 WHERE sequence_type = $2`,
        [nextValue, sequenceType]
      );
    }

    return `${config.prefix}-${nextValue}`;
  });
}

/**
 * Peek at the current value without incrementing (for display purposes).
 */
export async function peekSequenceNumber(sequenceType) {
  const config = SEQUENCE_CONFIG[sequenceType];
  if (!config) throw new Error(`Unknown sequenceType: ${sequenceType}`);
  const res = await pool.query(
    `SELECT current_value FROM sequence_counters WHERE sequence_type = $1`,
    [sequenceType]
  );
  const current = res.rows.length ? Number(res.rows[0].current_value) : 1000;
  return `${config.prefix}-${current + 1}`;
}
