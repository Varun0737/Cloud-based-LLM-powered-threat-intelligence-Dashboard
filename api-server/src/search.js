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
  if (!q) return res.status(400).json({ error: "Missing q" });

  try {
    const items = await retrieveAdaptive(q, k);
    const results = items.map(it => ({
      id: it.id, source: it.source, title: it.title, snippet: (it.text || "").slice(0, 400)
    }));
    res.json({ count: results.length, results });
  } catch (e) {
    res.status(500).json({ error: String(e) });
  }
});

export default router;

