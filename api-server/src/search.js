import { Router } from "express";
import fs from "node:fs";
import { requireAuth } from "./requireAuth.js";

const router = Router();

// --- Load metadata once (titles, text snippets) ---
const META_PATH = process.env.META_PATH || "../llm-reader/data/meta.json";
const meta = JSON.parse(fs.readFileSync(META_PATH, "utf-8"));

// --- Simple local retrieval by asking your existing Python script ---
import { spawn } from "node:child_process";
function retrieveLocal(query, k = 5) {
  return new Promise((resolve, reject) => {
    const py = spawn("python3", ["-c", `
import json, sys, numpy as np, faiss
from fastembed import TextEmbedding

META_PATH="${META_PATH}"
INDEX_PATH="${process.env.INDEX_PATH || '../llm-reader/data/index.faiss'}"
MODEL_NAME="BAAI/bge-small-en-v1.5"

meta=json.load(open(META_PATH, 'r', encoding='utf-8'))
index=faiss.read_index(INDEX_PATH)
model=TextEmbedding(model_name=MODEL_NAME)

def embed(q):
    import numpy as np
    v = np.array(list(model.embed([q]))[0], dtype=np.float32)[None,:]
    v = v / (np.linalg.norm(v, axis=1, keepdims=True) + 1e-12)
    return v

qv = embed(${JSON.stringify(query)})
D,I = index.search(qv, ${k})
items = [meta[i] for i in I[0]]
print(json.dumps(items, ensure_ascii=False))
`]);

    let out = "", err = "";
    py.stdout.on("data", d => out += d.toString());
    py.stderr.on("data", d => err += d.toString());
    py.on("close", code => {
      if (code === 0) {
        try { resolve(JSON.parse(out)); }
        catch (e) { reject(e); }
      } else {
        reject(new Error(err || "Python retrieval failed"));
      }
    });
  });
}

router.get("/", requireAuth, async (req, res) => {
  const q = (req.query.q || "").trim();
  if (!q) return res.status(400).json({ error: "Missing q" });

  try {
    const items = await retrieveLocal(q, Number(req.query.k || 5));
    // Return lightweight results
    const results = items.map(it => ({
      id: it.id,
      source: it.source,
      title: it.title,
      snippet: (it.text || "").slice(0, 400)
    }));
    res.json({ count: results.length, results });
  } catch (e) {
    res.status(500).json({ error: String(e) });
  }
});

export default router;

