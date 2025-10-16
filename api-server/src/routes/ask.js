// api-server/src/routes/ask.js
import { Router } from "express";
import { spawn } from "node:child_process";
import { requireAuth } from "../requireAuth.js";

const router = Router();

// ---- Config (env + sensible defaults) ----
const PY = process.env.PYTHON_BIN || "python3"; // <— THIS is what spawn will use
const META_PATH = process.env.META_PATH || "../llm-reader/data/meta.json";
const INDEX_PATH = process.env.INDEX_PATH || "../llm-reader/data/index.faiss";
const EMBED_MODEL = process.env.EMBED_MODEL || "BAAI/bge-small-en-v1.5";
const K = Number(process.env.ASK_TOP_K || 6);

const OPENAI_API_KEY = process.env.OPENAI_API_KEY || "";
const OPENAI_MODEL = process.env.OPENAI_MODEL || "gpt-4o-mini";

// ---- Local (retrieval-only) helper via Python ----
function retrieveLocal(question, k = K) {
  return new Promise((resolve, reject) => {
    // Single -c Python program. It embeds/normalizes the question, searches FAISS,
    // returns top-k docs as JSON for the Node side to optionally summarize.
    const code = `
import json, numpy as np, faiss, sys
from fastembed import TextEmbedding

META_PATH = ${JSON.stringify(META_PATH)}
INDEX_PATH = ${JSON.stringify(INDEX_PATH)}
MODEL_NAME = ${JSON.stringify(EMBED_MODEL)}
K = ${JSON.stringify(k)}

def load_meta(path):
    with open(path, "r", encoding="utf-8") as f:
        return json.load(f)

def load_index(path):
    return faiss.read_index(path)

def embed_query(model, q):
    v = np.array(list(model.embed([q]))[0], dtype=np.float32)[None, :]
    v /= (np.linalg.norm(v, axis=1, keepdims=True) + 1e-12)
    return v

question = sys.stdin.read().strip()  # read from stdin
meta = load_meta(META_PATH)
index = load_index(INDEX_PATH)
model = TextEmbedding(model_name=MODEL_NAME)

qv = embed_query(model, question)
D, I = index.search(qv, K)

items = []
for idx in I[0]:
    if 0 <= idx < len(meta):
        m = meta[idx]
        # keep payload light
        items.append({
            "id": m.get("id", idx),
            "source": m.get("source", "unknown"),
            "title": m.get("title", ""),
            "snippet": (m.get("text") or "")[:800]
        })

print(json.dumps({"hits": items}, ensure_ascii=False))
    `;

    const py = spawn(PY, ["-c", code], { stdio: ["pipe", "pipe", "pipe"] });
    let out = "", err = "";

    py.stdout.on("data", (d) => (out += d.toString()));
    py.stderr.on("data", (d) => (err += d.toString()));
    py.on("close", (code) => {
      if (code === 0) {
        try {
          resolve(JSON.parse(out));
        } catch (e) {
          reject(new Error("Failed to parse Python output: " + e.message));
        }
      } else {
        reject(new Error(err || "Python retrieval failed"));
      }
    });

    // send the question via stdin
    py.stdin.write(question + "\n");
    py.stdin.end();
  });
}

// ---- Optional: summarize w/ OpenAI (if key is present) ----
async function summarizeWithOpenAI(question, hits) {
  if (!OPENAI_API_KEY) return null; // no key => skip LLM summarization

  // create a short, citation-style prompt
  const context = hits
    .map(
      (h, i) =>
        `[${i + 1}] SOURCE=${h.source} TITLE=${h.title}\nSNIPPET=${(h.snippet || "").slice(
          0,
          500
        )}`
    )
    .join("\n\n");

  const system =
    "You are a security analyst. Answer concisely and include inline citations like [1], [2] mapped to the provided snippets. If you’re unsure, say so.";

  const payload = {
    model: OPENAI_MODEL,
    messages: [
      { role: "system", content: system },
      {
        role: "user",
        content: `Question: ${question}\n\nContext:\n${context}\n\nRespond with a short summary and include [#] citations.`,
      },
    ],
    temperature: 0.2,
  };

  const r = await fetch("https://api.openai.com/v1/chat/completions", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${OPENAI_API_KEY}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(payload),
  });

  if (!r.ok) {
    const t = await r.text();
    throw new Error(`OpenAI error: ${r.status} ${t}`);
  }
  const data = await r.json();
  const answer = data?.choices?.[0]?.message?.content?.trim() || "";
  return answer || null;
}

// ---- Route: POST /api/ask ----
router.post("/", requireAuth, async (req, res) => {
  try {
    const question = (req.body?.question || "").trim();
    if (!question) {
      return res.status(400).json({ error: "Missing 'question' in body" });
    }

    // 1) Retrieve relevant snippets locally
    const { hits } = await retrieveLocal(question, K);

    // 2) If you have OPENAI_API_KEY, create a summarized answer with citations
    let answer = null;
    if (OPENAI_API_KEY) {
      answer = await summarizeWithOpenAI(question, hits);
    }

    return res.json({
      answer,
      citations: hits,
      mode: OPENAI_API_KEY ? "local+openai" : "local-only",
      python: PY, // helpful debug
    });
  } catch (e) {
    console.error("[/api/ask] error:", e);
    return res.status(500).json({ error: String(e.message || e) });
  }
});

export default router;

