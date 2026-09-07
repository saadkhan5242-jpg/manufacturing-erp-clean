import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";
import { loadCollection, saveCollection } from "../storage/jsonStore.js";

const jwtSecret = process.env.JWT_SECRET || (process.env.NODE_ENV === "production" ? null : "development-only-jwt-secret");
const tokenLifetime = process.env.JWT_EXPIRES_IN || "8h";

function users() {
  return loadCollection("users.json", [{ id: 1, name: "Operations Admin", email: "admin@global-shop.local", role: "admin", active: true }]);
}

export async function ensureAdminPassword() {
  const password = process.env.ERP_ADMIN_PASSWORD;
  if (!password) return false;
  if (password.length < 8) throw new Error("ERP_ADMIN_PASSWORD must be at least 8 characters");
  const records = users();
  const admin = records.find((user) => user.role === "admin");
  if (!admin) return false;
  if (!admin.passwordHash || !(await bcrypt.compare(password, admin.passwordHash))) {
    admin.passwordHash = await bcrypt.hash(password, 12);
    saveCollection("users.json", records);
    return true;
  }
  return false;
}

export async function login(email, password) {
  const user = users().find((candidate) => candidate.email.toLowerCase() === String(email).trim().toLowerCase());
  if (!user || !user.active || !user.passwordHash || !(await bcrypt.compare(password, user.passwordHash))) return null;
  const token = jwt.sign({ sub: user.id, email: user.email, role: user.role, name: user.name }, jwtSecret, { expiresIn: tokenLifetime });
  return { token, expiresIn: tokenLifetime, user: { id: user.id, name: user.name, email: user.email, role: user.role } };
}

export function verifyToken(token) {
  return jwt.verify(token, jwtSecret);
}

export function securityStatus() {
  return { passwordConfigured: users().some((user) => Boolean(user.passwordHash)), tokenLifetime };
}
