import { Router } from "express";
import fs from "node:fs";
import { spawn } from "node:child_process";
import { requireAuth } from "./requireAuth.js";

const router = Router();

const META_PATH = process.env.META_PATH || "../llm-reader/data/meta.json";
const INDEX_PATH = process.env.INDEX_PATH || "../llm-reader/data/index.faiss";
const PY_BIN = process.env.PYTHON_BIN || "python3";
const meta = JSON.parse(fs.readFileSync(META_PATH, "utf-8"));

function retrieveAdaptive(query, k = 5) {
  const code = `
import os, json, numpy as np, faiss
META_PATH = ${JSON.stringify(META_PATH)}
INDEX_PATH = ${JSON.stringify(INDEX_PATH)}
OPENAI_API_KEY = os.getenv("OPENAI_API_KEY")

meta = json.load(open(META_PATH, "r", encoding="utf-8"))
index = faiss.read_index(INDEX_PATH)
dim = index.d

def norm(v):
    return v / (np.linalg.norm(v, axis=1, keepdims=True) + 1e-12)

def embed_openai(q):
    if not OPENAI_API_KEY:
        raise RuntimeError("OPENAI_API_KEY not set, but index dimension is 1536 (OpenAI).")
    from openai import OpenAI
    client = OpenAI(api_key=OPENAI_API_KEY)
    e = client.embeddings.create(model="text-embedding-3-small", input=q).data[0].embedding
    v = np.array(e, dtype=np.float32)[None,:]
    return norm(v)

def embed_fastembed(q):
    from fastembed import TextEmbedding
    model = TextEmbedding(model_name="BAAI/bge-small-en-v1.5")
    v = np.array(list(model.embed([q]))[0], dtype=np.float32)[None,:]
    return norm(v)

if dim == 1536:
    qv = embed_openai(${JSON.stringify(query)})
elif dim == 384:
    qv = embed_fastembed(${JSON.stringify(query)})
else:
    raise RuntimeError(f"Unsupported index dimension: {dim}. Rebuild index or adjust embedder.")

D, I = index.search(qv, ${k})
items = [meta[i] for i in I[0]]
print(json.dumps(items, ensure_ascii=False))
  `;
  return new Promise((resolve, reject) => {
    const py = spawn(PY_BIN, ["-c", code], { env: process.env });
    let out = "", err = "";
    py.stdout.on("data", d => (out += d.toString()));
    py.stderr.on("data", d => (err += d.toString()));
    py.on("close", code => {
      if (code === 0) {
        try { resolve(JSON.parse(out)); } catch (e) { reject(e); }
      } else {
        reject(new Error(err || "Python retrieval failed"));
      }
    });
  });
}

router.get("/", requireAuth, async (req, res) => {
  const q = (req.query.q || "").trim();
  const k = Number(req.query.k || 5);
  const mode = req.query.mode || "local";

  if (!q) return res.status(400).json({ error: "Missing q" });

  try {
    // Standard Local Search (Vector DB)
    const items = await retrieveAdaptive(q, k);
    const results = items.map(it => ({
      id: it.id, source: it.source, title: it.title, snippet: (it.text || "").slice(0, 400)
    }));

    // If Mode is OpenAI, we inject the "Sentinel" intelligence
    let answer = null;
    if (mode === "openai") {
      const { default: OpenAI } = await import("openai");
      const { default: ThreatReport } = await import("./models/ThreatReport.js");
      const { default: CVE } = await import("./models/CVE.js");

      const OPENAI_API_KEY = process.env.OPENAI_API_KEY;
      if (OPENAI_API_KEY) {
        const client = new OpenAI({ apiKey: OPENAI_API_KEY });

        // Fetch Real-time Context
        const recentThreats = await ThreatReport.find().sort({ pubDate: -1 }).limit(5);
        const criticalCVEs = await CVE.find({ severity: "CRITICAL" }).sort({ published: -1 }).limit(5);

        const threatCtx = recentThreats.map((t, i) => `[News-${i + 1}] ${t.title}: ${t.summary}`).join("\n");
        const cveCtx = criticalCVEs.map((c, i) => `[CVE-${i + 1}] ${c.id}: ${c.summary.substring(0, 150)}...`).join("\n");

        // Also use the vector search results as "Internal Database" context
        const vectorCtx = results.map((r, i) => `[DB-${i + 1}] ${r.title}: ${r.snippet}`).join("\n");

        const systemPrompt = `You are 'Sentinel', an elite Threat Intelligence Analyst. 
Analyze the user's SEARCH QUERY based on:
1. LATEST THREAT NEWS (Real-time).
2. CRITICAL VULNERABILITIES (Recent CVEs).
3. INTERNAL DATABASE MATCHES (Vector Search).

Provide a concise, high-impact assessment. Direct the user to specific threats if relevant.
If the query is generic, summarize the current threat landscape based on the news.`;

        const userPrompt = `Query: ${q}\n\nLATEST NEWS:\n${threatCtx}\n\nCRITICAL CVES:\n${cveCtx}\n\nINTERNAL RECORDS:\n${vectorCtx}`;

        const resp = await client.chat.completions.create({
          model: process.env.OPENAI_MODEL || "gpt-4o-mini",
          messages: [
            { role: "system", content: systemPrompt },
            { role: "user", content: userPrompt },
          ],
          temperature: 0.3,
          max_tokens: 600,
        });
        answer = resp.choices?.[0]?.message?.content?.trim();
      } else {
        answer = "ERROR: OpenAI API Key missing on server.";
      }
    }

    res.json({ count: results.length, results, answer });
  } catch (e) {
    console.error(e);
    res.status(500).json({ error: String(e) });
  }
});

export default router;

