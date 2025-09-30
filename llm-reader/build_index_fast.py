# build_index_fast.py
import json, os
import numpy as np
import faiss
from tqdm import tqdm
from fastembed import TextEmbedding

DOCS_PATH = "data/docs.jsonl"
INDEX_PATH = "data/index.faiss"
META_PATH  = "data/meta.json"

MODEL_NAME = "BAAI/bge-small-en-v1.5"   # small, fast, high-quality

def chunk(text, n=1500):
    return [text[i:i+n] for i in range(0, len(text), n)]

def main():
    # Load docs and make chunks
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

    # Embed with FastEmbed (no torch needed)
    model = TextEmbedding(model_name=MODEL_NAME)
    texts = [d["text"] for d in docs]

    vecs = []
    B = 256  # local batches can be larger
    for i in tqdm(range(0, len(texts), B)):
        batch = texts[i:i+B]
        # returns a generator of np.float32 vectors
        emb = list(model.embed(batch))
        vecs.append(np.vstack(emb))
    X = np.vstack(vecs).astype(np.float32)

    # Cosine similarity = normalize + inner product
    faiss.normalize_L2(X)
    index = faiss.IndexFlatIP(X.shape[1])
    index.add(X)

    faiss.write_index(index, INDEX_PATH)
    with open(META_PATH, "w", encoding="utf-8") as f:
        json.dump(docs, f)

    print(f"Saved index -> {INDEX_PATH}")
    print(f"Saved meta  -> {META_PATH}")

if __name__ == "__main__":
    main()

