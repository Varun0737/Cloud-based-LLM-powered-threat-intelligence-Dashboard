# Cloud-based-LLM-powered-threat-intelligence-Dashboard
final project
# Security Hardening (Prototype)
- Helmet security headers enabled (X-DNS-Prefetch-Control, X-Frame-Options, etc.).
- CORS allow-list via CORS_ORIGINS env var (comma-separated).
- Rate limit: express-rate-limit (window 15m, default 200 req/IP).
- Central JSON error handler and 404.
- Logging (morgan) with password redaction.
- Health: GET /health.
- Docs: GET /api/docs (JSON describing auth and endpoints).

## Env Vars
PORT=8080
JWT_SECRET=...
CORS_ORIGINS=http://localhost:5173
RATE_LIMIT_MAX=200
INDEX_PATH=../llm-reader/data/index.faiss
META_PATH=../llm-reader/data/meta.json
OPENAI_API_KEY=sk-... (optional)

