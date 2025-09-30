# ask_fast.py
import os, json, numpy as np, faiss
from fastembed import TextEmbedding

META_PATH  = "data/meta.json"
INDEX_PATH = "data/index.faiss"
MODEL_NAME = "BAAI/bge-small-en-v1.5"

def load():
    meta = json.load(open(META_PATH, "r", encoding="utf-8"))
    index = faiss.read_index(INDEX_PATH)
    model = TextEmbedding(model_name=MODEL_NAME)
    return model, index, meta

def embed_query(model, q: str):
    v = np.array(list(model.embed([q]))[0], dtype=np.float32)[None, :]
    # cosine: normalize query too
    v = v / (np.linalg.norm(v, axis=1, keepdims=True) + 1e-12)
    return v

def retrieve(model, index, meta, q, k=5):
    qv = embed_query(model, q)
    D, I = index.search(qv, k)
    return [meta[i] for i in I[0]]

def format_snippets(question, items):
    parts = []
    for it in items:
        src = it.get("source","")
        title = it.get("title","")
        txt = (it.get("text","") or "")[:600]
        parts.append(f"[{src}] {title}\n{txt}\n")
    return (
        f"Question: {question}\n\nTop relevant snippets (local, no API):\n\n" +
        "\n---\n".join(parts)
    )

if __name__ == "__main__":
    model, index, meta = load()
    while True:
        q = input("Ask: ").strip()
        if not q:
            break
        items = retrieve(model, index, meta, q, k=5)
        print(format_snippets(q, items))

