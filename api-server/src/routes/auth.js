// src/routes/auth.js
import { Router } from "express";
import jwt from "jsonwebtoken";
import speakeasy from "speakeasy";
import { User } from "../models/User.js";

const router = Router();

const JWT_SECRET = process.env.JWT_SECRET || "dev-secret";
const JWT_TTL = process.env.JWT_TTL || "7d";

const sign = (u) =>
  jwt.sign(
    { sub: u._id.toString(), email: u.email, roles: u.roles || ["user"] },
    JWT_SECRET,
    { expiresIn: JWT_TTL }
  );

/**
 * POST /api/auth/signup
 * Body: { email, password, name }
 */
router.post("/signup", async (req, res) => {
  try {
    const { email, password, name } = req.body || {};
    if (!email || !password) {
      return res.status(400).json({ error: "email and password are required" });
    }
    const user = await User.signup({ email, name, password });
    res.json({
      token: sign(user),
      user: { id: user._id, email: user.email, name: user.name },
    });
  } catch (e) {
    res.status(400).json({ error: e.message || "Signup failed" });
  }
});

/**
 * POST /api/auth/login
 * Body: { email, password, otp? }
 * - If the user has MFA enabled, an `otp` (6-digit TOTP) is required.
 * - If `otp` is missing when required, respond with { mfaRequired: true }.
 */
router.post("/login", async (req, res) => {
  try {
    const { email, password, otp } = req.body || {};
    if (!email || !password) {
      return res.status(400).json({ error: "email and password are required" });
    }

    // 1) Verify password (your model already exposes this)
    const user = await User.verify({ email, password });
    if (!user) {
      return res.status(401).json({ error: "Invalid credentials" });
    }

    // 2) If MFA is enabled, require a valid OTP
    //    We refetch with mfa.secret explicitly selected for verification.
    const withMfa = await User.findById(user._id).select("+mfa.secret mfa.enabled");
    if (withMfa?.mfa?.enabled) {
      if (!otp) {
        return res
          .status(401)
          .json({ error: "OTP required", mfaRequired: true });
      }

      const ok = speakeasy.totp.verify({
        secret: withMfa.mfa.secret,
        encoding: "base32",
        token: otp,
        window: 1, // allow small clock drift (+/- 30s)
      });

      if (!ok) {
        return res.status(401).json({ error: "Invalid OTP" });
      }
    }

    // 3) Issue JWT as usual
    res.json({
      token: sign(user),
      user: { id: user._id, email: user.email, name: user.name },
    });
  } catch (e) {
    res.status(500).json({ error: "Login failed" });
  }
});

export default router;


