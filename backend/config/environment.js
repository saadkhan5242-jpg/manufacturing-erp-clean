const requiredProductionVariables = ["DATABASE_URL", "JWT_SECRET", "ERP_ADMIN_PASSWORD"];

function splitOrigins(value) {
  return String(value || "")
    .split(",")
    .map((origin) => origin.trim())
    .filter(Boolean);
}

function validateOriginList(name) {
  for (const origin of splitOrigins(process.env[name])) {
    if (origin !== "development" && origin !== "*") {
      if (origin.endsWith("/")) {
        throw new Error(`${name} entries must not end with a trailing slash`);
      }
      try {
        new URL(origin);
      } catch {
        if (process.env.NODE_ENV === "production") {
          throw new Error(`${name} must contain valid URL entries`);
        }
      }
    }
  }
}

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

  validateOriginList("FRONTEND_ORIGIN");
  validateOriginList("FRONTEND_ORIGINS");
  validateOriginList("VERCEL_PRODUCTION_ORIGIN");

  if (process.env.NODE_ENV === "production" && !process.env.FRONTEND_ORIGIN && !process.env.FRONTEND_ORIGINS && !process.env.VERCEL_PROJECT_SLUG && !process.env.VERCEL_ALLOWED_DOMAINS) {
    throw new Error("Set FRONTEND_ORIGINS, FRONTEND_ORIGIN, VERCEL_PROJECT_SLUG, or VERCEL_ALLOWED_DOMAINS for production CORS");
  }
}
