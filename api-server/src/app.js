import { requireAuth } from "./requireAuth.js";
import express from "express";
import cors from "cors";
import morgan from "morgan";
import helmet from "helmet";
import rateLimit from "express-rate-limit";
import searchRoutes from "./search.js";
import statsRoutes from "./routes/stats.js";
import askRoutes from "./routes/ask.js";
import authRouter from "./routes/auth.js";
import adminRoutes from "./routes/admin.js";
import mfaRoutes from "./routes/mfa.js";
import cveRouter from "./routes/cve.js";
import mapRouter from "./routes/map.js";

// ----- App & Parsers -----
const app = express();
app.use(express.json({ limit: "1mb" }));

// ----- Security headers (helmet) -----
app.use(
  helmet({
    crossOriginResourcePolicy: { policy: "cross-origin" }, // allow images/fonts if needed
  })
);

// ----- CORS allow-list -----
const origins = (process.env.CORS_ORIGINS || "")
  .split(",")
  .map(s => s.trim())
  .filter(Boolean);

app.use(
  cors({
    origin: (origin, cb) => {
      if (!origin) return cb(null, true); // curl/Postman
      if (origins.length === 0 || origins.includes(origin)) return cb(null, true);
      return cb(new Error("Not allowed by CORS"));
    },
    credentials: false,
    methods: ["GET", "POST", "OPTIONS"],
    allowedHeaders: ["Content-Type", "Authorization"]
  })
);

// ----- Logging (avoid secrets) -----
morgan.token("safe-body", (req) => {
  const clone = { ...(req.body || {}) };
  if (clone.password) clone.password = "***";
  return JSON.stringify(clone);
});
app.use(morgan(':method :url :status :response-time ms - :res[content-length] :safe-body'));

// ----- Rate limit -----
const limiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: Number(process.env.RATE_LIMIT_MAX || 200),
  standardHeaders: true,
  legacyHeaders: false,
});
app.use(limiter);

// ----- Health -----
app.get("/health", (_req, res) => res.json({ ok: true }));

// ----- Docs -----
app.get("/api/docs", (_req, res) => {
  res.json({
    name: "Threat Intel API (Prototype)",
    version: "1.0",
    auth: {
      type: "Bearer JWT",
      login: { method: "POST", path: "/api/auth/login", body: { email: "string", password: "string" } }
    },
    endpoints: [
      {
        method: "GET",
        path: "/api/search",
        query: {
          q: "string (required)",
          k: "int (default 5)",
          mode: "snippets | openai (default snippets)"
        },
        headers: { Authorization: "Bearer <token>" },
        responses: {
          snippets: { mode: "snippets", count: "number", results: [{ id: "string", source: "string", title: "string", snippet: "string" }] },
          openai: { mode: "openai", answer: "string", used: [{ id: "string", source: "string", title: "string" }] }
        }
      }
    ]
  });
});

// ----- Routers -----
app.use("/api/stats", statsRoutes);
app.use("/api/auth", authRouter);
app.use("/api/search", searchRoutes);
app.use("/api/ask", askRoutes);
app.use("/api/admin", adminRoutes);
app.use("/api/mfa", mfaRoutes);
app.use("/api/cve", cveRouter);
app.use("/api/map", requireAuth, mapRouter);

// mount routers BEFORE 404
app.use("/api/auth", authRouter);

// ----- 404 -----
app.use((req, res) => {
  res.status(404).json({ error: "Not found", path: req.path });
});

// ----- Central error handler -----
app.use((err, _req, res, _next) => {
  const code = err.status || 500;
  res.status(code).json({ error: err.message || "Server error" });
});

export default app;

