import express from "express";
import rateLimit from "express-rate-limit";
import { login, securityStatus } from "../auth/authService.js";
import { authenticate } from "../middleware/auth.js";

const router = express.Router();
const loginLimiter = rateLimit({ windowMs: 15 * 60 * 1000, limit: 10, standardHeaders: "draft-8", legacyHeaders: false, message: { error: "Too many login attempts. Try again later." } });

router.get("/status", (_req, res) => res.json(securityStatus()));

router.get("/me", authenticate, (req, res) => res.json({ user: req.user }));
router.get("/admin", authenticate, (req, res) => {
  if (req.user.role !== "admin") return res.status(403).json({ error: "Admin role required" });
  return res.json({ admin: true, user: req.user });
});

router.post("/login", loginLimiter, async (req, res) => {
  const { email, password } = req.body || {};
  if (typeof email !== "string" || typeof password !== "string") return res.status(400).json({ error: "email and password are required" });
  const result = await login(email, password);
  if (!result) return res.status(401).json({ error: "Invalid credentials or inactive user" });
  return res.json(result);
});

export default router;
