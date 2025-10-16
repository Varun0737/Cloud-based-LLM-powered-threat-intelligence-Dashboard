import express from "express";
import speakeasy from "speakeasy";
import QRCode from "qrcode";
import { requireAuth } from "../requireAuth.js";
import { User } from "../models/User.js";

const router = express.Router();

/**
 * GET /api/mfa/status
 * Returns whether MFA is enabled for the current user.
 */
router.get("/status", requireAuth, async (req, res) => {
  res.json({ enabled: !!req.user?.mfa?.enabled });
});

/**
 * POST /api/mfa/setup
 * Generates a secret + QR for the current (authenticated) user.
 * Does NOT enable MFA yet. The user must call /enable with a valid code.
 */
router.post("/setup", requireAuth, async (req, res) => {
  const user = await User.findById(req.user.id).select("+mfa.secret");
  if (!user) return res.status(404).json({ error: "User not found" });

  const secret = speakeasy.generateSecret({
    name: `Threat Intel Dashboard (${user.email})`,
    length: 20,
  });

  // stash the secret temporarily (not enabled yet)
  user.mfa = user.mfa || {};
  user.mfa.secret = secret.base32;
  await user.save();

  // return both otpauth URL and a QR (data URL) the UI can render
  const qr = await QRCode.toDataURL(secret.otpauth_url);

  res.json({
    otpauthUrl: secret.otpauth_url,
    qrDataUrl: qr,          // <img src="..." />
    base32: secret.base32,  // for debugging / fallback
  });
});

/**
 * POST /api/mfa/enable
 * Body: { otp: "123456" }
 * Verifies the OTP against the saved secret and flips enabled=true.
 */
router.post("/enable", requireAuth, async (req, res) => {
  const { otp } = req.body || {};
  if (!otp) return res.status(400).json({ error: "Missing otp" });

  const user = await User.findById(req.user.id).select("+mfa.secret");
  if (!user?.mfa?.secret) return res.status(400).json({ error: "Run setup first" });

  const ok = speakeasy.totp.verify({
    secret: user.mfa.secret,
    encoding: "base32",
    token: otp,
    window: 1, // allow +/- 30s drift
  });

  if (!ok) return res.status(401).json({ error: "Invalid OTP" });

  user.mfa.enabled = true;
  await user.save();
  res.json({ ok: true, enabled: true });
});

/**
 * POST /api/mfa/disable
 * Body: { otp: "123456" } (so only the real user can disable)
 */
router.post("/disable", requireAuth, async (req, res) => {
  const { otp } = req.body || {};
  if (!otp) return res.status(400).json({ error: "Missing otp" });

  const user = await User.findById(req.user.id).select("+mfa.secret");
  if (!user) return res.status(404).json({ error: "User not found" });

  const ok = user.mfa?.secret
    ? speakeasy.totp.verify({
        secret: user.mfa.secret,
        encoding: "base32",
        token: otp,
        window: 1,
      })
    : true; // if no secret, allow disable

  if (!ok) return res.status(401).json({ error: "Invalid OTP" });

  user.mfa.enabled = false;
  user.mfa.secret = undefined;
  await user.save();
  res.json({ ok: true, enabled: false });
});

export default router;

