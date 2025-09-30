# build_index_local.py
import json, os
import numpy as np
import faiss
from tqdm import tqdm
from sentence_transformers import SentenceTransformer

DOCS_PATH = "data/docs.jsonl"
INDEX_PATH = "data/index.faiss"
META_PATH  = "data/meta.json"

# Small, fast, good quality
MODEL_NAME = "sentence-transformers/all-MiniLM-L6-v2"

def chunk(text, n=1500):
    return [text[i:i+n] for i in range(0, len(text), n)]

def main():
    model = SentenceTransformer(MODEL_NAME)

    docs = []
    with open(DOCS_PATH, "r", encoding="utf-8") as f:
        for line in f:
            d = json.loads(line)
            t = d.get("text") or ""
            if not t: 
                continue
            for j, ch in enumerate(chunk(t, 1500)):
                docs.append({
                    "id": f'{d.get("id","doc")}:{j}',
                    "source": d.get("source") or "bucket",
                    "title": d.get("title") or "Untitled",
                    "text": ch
                })

    print(f"Loaded {len(docs)} chunks")
    texts = [d["text"] for d in docs]

    vecs = []
    B = 64
    for i in tqdm(range(0, len(texts), B)):
        emb = model.encode(texts[i:i+B], normalize_embeddings=True, convert_to_numpy=True)
        vecs.append(emb.astype(np.float32))
    X = np.vstack(vecs) if vecs else np.zeros((0,384), dtype=np.float32)

    index = faiss.IndexFlatIP(X.shape[1])  # cosine if vectors are normalized
    index.add(X)

    faiss.write_index(index, INDEX_PATH)
    with open(META_PATH, "w", encoding="utf-8") as f:
        json.dump(docs, f)

    print(f"Saved index -> {INDEX_PATH}")
    print(f"Saved meta  -> {META_PATH}")

if __name__ == "__main__":
    main()

