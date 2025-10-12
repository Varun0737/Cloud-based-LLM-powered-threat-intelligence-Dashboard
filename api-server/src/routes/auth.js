// src/routes/auth.js
import { Router } from "express";
import jwt from "jsonwebtoken";
import { User } from "../models/User.js";

const router = Router();
const JWT_SECRET = process.env.JWT_SECRET || "dev-secret";
const JWT_TTL = process.env.JWT_TTL || "7d";

const sign = (u) =>
  jwt.sign(
    { sub: u._id.toString(), email: u.email, roles: u.roles },
    JWT_SECRET,
    { expiresIn: JWT_TTL }
  );

// POST /api/auth/signup
router.post("/signup", async (req, res) => {
  try {
    const { email, password, name } = req.body || {};
    const user = await User.signup({ email, name, password });
    res.json({
      token: sign(user),
      user: { id: user._id, email: user.email, name: user.name },
    });
  } catch (e) {
    res.status(400).json({ error: e.message || "Signup failed" });
  }
});

// POST /api/auth/login
router.post("/login", async (req, res) => {
  try {
    const { email, password } = req.body || {};
    const user = await User.verify({ email, password });
    if (!user) return res.status(401).json({ error: "Invalid credentials" });
    res.json({
      token: sign(user),
      user: { id: user._id, email: user.email, name: user.name },
    });
  } catch (e) {
    res.status(500).json({ error: "Login failed" });
  }
});

export default router;  // <-- REQUIRED

