// api-server/src/routes/admin.js
import { Router } from "express";
import { requireAuth } from "../requireAuth.js";
import { requireRole } from "../requireRole.js";
const router = Router();

router.get("/whoami", requireAuth, requireRole(["admin"]), (req, res) => {
  res.json({ ok: true, me: req.user });
});

export default router;

