import { verifyToken } from "../auth/authService.js";

export function authenticate(req, res, next) {
  const header = req.get("authorization");
  if (!header?.startsWith("Bearer ")) return res.status(401).json({ error: "Authentication required" });
  try {
    req.user = verifyToken(header.slice(7));
    return next();
  } catch {
    return res.status(401).json({ error: "Invalid or expired token" });
  }
}

export function protectWrites(req, res, next) {
  if (["GET", "HEAD", "OPTIONS"].includes(req.method)) return next();
  return authenticate(req, res, next);
}

export function requireRoles(...roles) {
  return (req, res, next) => {
    if (!req.user || !roles.includes(req.user.role)) return res.status(403).json({ error: "Insufficient permissions" });
    return next();
  };
}

const ROLE_PERMISSIONS = {
  admin: ["*"],
  manager: ["read:*", "write:work-orders", "write:schedules", "write:inventory"],
  operator: ["read:work-orders", "write:labor-log", "read:inventory"],
  finance: ["read:*", "write:accounting", "write:tax"],
  viewer: ["read:*"]
};

export function requirePermission(permission) {
  return (req, res, next) => {
    if (!req.user) return res.status(401).json({ error: "Authentication required" });
    const userRole = req.user.role || "viewer";
    const perms = ROLE_PERMISSIONS[userRole] || [];
    
    if (perms.includes("*") || perms.includes(permission)) {
      return next();
    }
    
    const [action, scope] = permission.split(":");
    if (perms.includes(`${action}:*`) || perms.includes(`*:${scope}`)) {
      return next();
    }

    return res.status(403).json({ error: `Permission denied: ${permission} required` });
  };
}
