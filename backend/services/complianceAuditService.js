import { query } from "../db.js";
import { loadCollection, saveCollection } from "../storage/jsonStore.js";

function userIdFromRequest(req) {
  const id = Number(req.user?.sub || req.user?.id);
  return Number.isInteger(id) && id > 0 ? id : null;
}

function ipFromRequest(req) {
  return req.ip || req.get?.("x-forwarded-for")?.split(",")[0]?.trim() || null;
}

export async function recordComplianceAudit({ req, actionType, targetTable, targetRecordId, targetFileId = null, isItarControlled = false, decision = "allowed", severity, reason = "" }) {
  const record = {
    userId: userIdFromRequest(req),
    actionType,
    targetTable,
    targetRecordId: String(targetRecordId),
    targetFileId: targetFileId ? String(targetFileId) : null,
    isItarControlled: Boolean(isItarControlled),
    decision,
    severity: severity || (decision === "blocked" ? "critical" : "info"),
    reason,
    ipAddress: ipFromRequest(req),
    userAgent: req.get?.("user-agent") || "",
    createdAt: new Date().toISOString()
  };

  try {
    await query(
      `INSERT INTO compliance_audit_logs
        (user_id, action_type, target_table, target_record_id, target_file_id, is_itar_controlled, decision, severity, reason, ip_address, user_agent)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10::inet, $11)`,
      [record.userId, record.actionType, record.targetTable, record.targetRecordId, record.targetFileId, record.isItarControlled, record.decision, record.severity, record.reason, record.ipAddress, record.userAgent]
    );
  } catch (error) {
    const audits = loadCollection("complianceAuditLogs.json", []);
    audits.push({ id: audits.length + 1, ...record, databaseWriteError: error.message });
    saveCollection("complianceAuditLogs.json", audits);
  }

  return record;
}
