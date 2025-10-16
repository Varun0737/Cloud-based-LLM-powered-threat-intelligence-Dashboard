# llm-reader/build_index_fastembed.py
import json, os
import numpy as np
import faiss
from fastembed import TextEmbedding

DATA_DIR = os.path.join(os.path.dirname(__file__), "data")
META_IN   = os.path.join(DATA_DIR, "meta.json")              # existing meta with "text"
INDEX_OUT = os.path.join(DATA_DIR, "index_local.faiss")
META_OUT  = os.path.join(DATA_DIR, "meta_local.json")
MODEL     = "BAAI/bge-small-en-v1.5"

def load_meta(path):
    with open(path, "r", encoding="utf-8") as f:
        return json.load(f)

def main():
    meta = load_meta(META_IN)
    texts = [(m.get("text") or "") for m in meta]

    model = TextEmbedding(model_name=MODEL)
    vecs = []
    for v in model.embed(texts):
        vecs.append(v)
    X = np.array(vecs, dtype=np.float32)
    X /= (np.linalg.norm(X, axis=1, keepdims=True) + 1e-12)  # cosine via inner-prod

    d = X.shape[1]
    index = faiss.IndexFlatIP(d)
    index.add(X)

    faiss.write_index(index, INDEX_OUT)
    with open(META_OUT, "w", encoding="utf-8") as f:
        json.dump(meta, f, ensure_ascii=False, indent=2)

    print("Built index:", INDEX_OUT, "dims:", d, "items:", len(meta))
    print("Meta:", META_OUT)

if __name__ == "__main__":
    main()

