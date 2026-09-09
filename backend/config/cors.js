const localOrigins = new Set([
  "http://localhost:5173",
  "http://127.0.0.1:5173",
  "http://localhost:4173",
  "http://127.0.0.1:4173"
]);

function splitOrigins(value) {
  return String(value || "")
    .split(",")
    .map((origin) => origin.trim().replace(/\/+$/, ""))
    .filter(Boolean);
}

function hostnameMatchesVercelProject(hostname, projectSlug) {
  if (!projectSlug || !hostname.endsWith(".vercel.app")) return false;
  const label = hostname.slice(0, -".vercel.app".length);
  return label === projectSlug || label.startsWith(`${projectSlug}-`);
}

function hostnameMatchesAllowedDomain(hostname, allowedDomain) {
  const normalized = allowedDomain.toLowerCase().replace(/^\*\./, "");
  return hostname === normalized || hostname.endsWith(`.${normalized}`);
}

export function getAllowedOrigins() {
  return new Set([
    ...localOrigins,
    ...splitOrigins(process.env.FRONTEND_ORIGIN),
    ...splitOrigins(process.env.FRONTEND_ORIGINS),
    ...splitOrigins(process.env.VERCEL_PRODUCTION_ORIGIN)
  ]);
}

export function isOriginAllowed(origin) {
  if (!origin) return true;

  const normalizedOrigin = origin.replace(/\/+$/, "");
  if (getAllowedOrigins().has(normalizedOrigin)) return true;

  let parsed;
  try {
    parsed = new URL(normalizedOrigin);
  } catch {
    return false;
  }

  if (parsed.protocol !== "https:") return false;

  const vercelProjectSlug = process.env.VERCEL_PROJECT_SLUG || process.env.VERCEL_PROJECT_NAME;
  if (hostnameMatchesVercelProject(parsed.hostname, vercelProjectSlug)) return true;

  const allowedDomains = splitOrigins(process.env.VERCEL_ALLOWED_DOMAINS).map((domain) => domain.replace(/^https?:\/\//, ""));
  return allowedDomains.some((domain) => hostnameMatchesAllowedDomain(parsed.hostname, domain));
}

export function corsOptionsDelegate(req, callback) {
  const origin = req.header("Origin");
  if (isOriginAllowed(origin)) {
    callback(null, {
      origin: origin || false,
      credentials: true,
      methods: ["GET", "HEAD", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],
      allowedHeaders: ["Content-Type", "Authorization", "X-Supervisor-Pin", "X-Request-ID"],
      exposedHeaders: ["X-Request-ID"]
    });
    return;
  }

  callback(null, { origin: false });
}
