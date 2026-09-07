const requiredProductionVariables = ["DATABASE_URL", "JWT_SECRET", "ERP_ADMIN_PASSWORD"];

export function validateEnvironment() {
  const missing = requiredProductionVariables.filter((name) => process.env.NODE_ENV === "production" && !process.env[name]);
  if (missing.length > 0) {
    throw new Error(`Missing required production environment variables: ${missing.join(", ")}`);
  }

  if (process.env.JWT_SECRET && process.env.JWT_SECRET.length < 32) {
    throw new Error("JWT_SECRET must be at least 32 characters");
  }

  if (process.env.ERP_ADMIN_PASSWORD && process.env.ERP_ADMIN_PASSWORD.length < 8) {
    throw new Error("ERP_ADMIN_PASSWORD must be at least 8 characters");
  }

  if (process.env.FRONTEND_ORIGIN) {
    try {
      new URL(process.env.FRONTEND_ORIGIN);
    } catch {
      throw new Error("FRONTEND_ORIGIN must be a valid URL");
    }
  }
}
