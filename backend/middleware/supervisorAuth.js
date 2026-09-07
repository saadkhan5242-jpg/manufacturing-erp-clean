// Module 6: Role-Based Supervisor Locks & PIN Code Authorization
// Intercepts critical floor operations and demands a 4-digit quality manager
// master verification passkey before allowing PostgreSQL writes to commit.

export const SUPERVISOR_PIN_HEADER = "x-supervisor-pin";

function configuredPin() {
  return String(process.env.SUPERVISOR_PIN || "2468");
}

export function isValidSupervisorPin(pin) {
  if (pin === undefined || pin === null) return false;
  const candidate = String(pin).trim();
  return /^\d{4}$/.test(candidate) && candidate === configuredPin();
}

/**
 * Express middleware: halts the workflow unless a valid supervisor PIN
 * is presented in the x-supervisor-pin request header.
 * Responds 403 with { supervisorRequired: true } so the frontend can
 * render the full-screen PIN-pad authorization overlay and retry.
 */
export function requireSupervisorPin(reason = "Critical floor operation requires supervisor override") {
  return (req, res, next) => {
    if (isValidSupervisorPin(req.get(SUPERVISOR_PIN_HEADER))) {
      return next();
    }
    return res.status(403).json({
      error: "GSS Supervisor Lock: quality manager verification passkey required.",
      supervisorRequired: true,
      reason
    });
  };
}

/**
 * Verification endpoint handler: validates a PIN without performing a write,
 * letting the PIN-pad overlay confirm the passkey before re-dispatching.
 */
export function verifySupervisorPinHandler(req, res) {
  const { pin } = req.body || {};
  if (isValidSupervisorPin(pin)) {
    return res.status(200).json({ verified: true });
  }
  return res.status(403).json({ verified: false, error: "Invalid supervisor PIN." });
}
