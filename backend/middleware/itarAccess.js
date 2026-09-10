import { recordComplianceAudit } from "../services/complianceAuditService.js";

export function isUsPerson(user) {
  return Boolean(user?.is_us_citizen_or_permanent_resident || user?.isUsCitizenOrPermanentResident);
}

function actionTypeForRequest(req, fallback) {
  if (fallback) return fallback;
  if (req.method === "GET") return "VIEW";
  if (req.method === "POST") return "CREATE";
  if (["PUT", "PATCH"].includes(req.method)) return "MODIFY";
  if (req.method === "DELETE") return "DELETE";
  return req.method;
}

export function containsItarPayload(value) {
  if (Array.isArray(value)) return value.some(containsItarPayload);
  if (!value || typeof value !== "object") return false;
  if (value.is_itar_controlled === true || value.isItarControlled === true) return true;
  return Object.values(value).some(containsItarPayload);
}

export function requireUsPersonForItarPayload(targetTable) {
  return async (req, res, next) => {
    if (!containsItarPayload(req.body)) return next();

    if (isUsPerson(req.user)) {
      await recordComplianceAudit({
        req,
        actionType: actionTypeForRequest(req),
        targetTable,
        targetRecordId: req.params.id || "new",
        isItarControlled: true,
        decision: "allowed",
        reason: "US person ITAR payload access granted"
      });
      return next();
    }

    await recordComplianceAudit({
      req,
      actionType: actionTypeForRequest(req),
      targetTable,
      targetRecordId: req.params.id || "new",
      isItarControlled: true,
      decision: "blocked",
      reason: "Non-US person attempted ITAR-controlled payload access"
    });
    return res.status(403).json({ error: "ITAR-controlled data requires verified US person access", code: "ITAR_ACCESS_DENIED", requestId: req.requestId });
  };
}

export function requireUsPersonForItarRecord({ targetTable, loadRecord, actionType }) {
  return async (req, res, next) => {
    try {
      const record = await loadRecord(req);
      if (!record?.is_itar_controlled && !record?.isItarControlled) return next();

      if (isUsPerson(req.user)) {
        await recordComplianceAudit({
          req,
          actionType: actionTypeForRequest(req, actionType),
          targetTable,
          targetRecordId: record.id || req.params.id,
          isItarControlled: true,
          decision: "allowed",
          reason: "US person ITAR record access granted"
        });
        return next();
      }

      await recordComplianceAudit({
        req,
        actionType: actionTypeForRequest(req, actionType),
        targetTable,
        targetRecordId: record.id || req.params.id,
        isItarControlled: true,
        decision: "blocked",
        reason: "Non-US person attempted ITAR-controlled record access"
      });
      return res.status(403).json({ error: "ITAR-controlled data requires verified US person access", code: "ITAR_ACCESS_DENIED", requestId: req.requestId });
    } catch (error) {
      return next(error);
    }
  };
}
