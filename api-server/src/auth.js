import { Router } from "express";
import jwt from "jsonwebtoken";

const router = Router();

// Demo user (replace with real user store later)
const DEMO_USER = {
  id: "u1",
  email: "demo@example.com",
  password: "demo123"  // prototype only!
};

router.post("/login", (req, res) => {
  const { email, password } = req.body || {};
  if (email !== DEMO_USER.email || password !== DEMO_USER.password) {
    return res.status(401).json({ error: "Invalid credentials" });
  }
  const token = jwt.sign(
    { sub: DEMO_USER.id, email: DEMO_USER.email },
    process.env.JWT_SECRET,
    { expiresIn: "2h" }
  );
  res.json({ token });
});

export default router;

