import time
import os, json
import numpy as np
import faiss
from tqdm import tqdm
from openai import OpenAI

client = OpenAI(api_key=os.getenv("OPENAI_API_KEY"))

def embed_texts(texts):
    resp = client.embeddings.create(
        model="text-embedding-3-small",
        input=texts
    )
    return [np.array(e.embedding, dtype=np.float32) for e in resp.data]

docs = []
with open("data/docs.jsonl","r",encoding="utf-8") as f:
    for line in f:
        d = json.loads(line)
        text = d["text"]
        if not text: continue
        # split long text into ~500 word chunks
        chunks = [text[i:i+1500] for i in range(0, len(text), 1500)]
        for j, ch in enumerate(chunks):
            docs.append({"id": f'{d["id"]}:{j}', "source": d["source"], "title": d["title"], "text": ch})

print(f"Loaded {len(docs)} chunks")

vecs = []
BATCH = 20   # smaller batches
PAUSE = 1.0  # 1 second between batches
for i in tqdm(range(0,len(docs),20)):
    batch = [d["text"] for d in docs[i:i+20]]
    vecs.extend(embed_texts(batch))
    time.sleep(1) 

index = faiss.IndexFlatIP(len(vecs[0]))
faiss.normalize_L2(np.array(vecs))
index.add(np.stack(vecs))

faiss.write_index(index, "data/index.faiss")
with open("data/meta.json","w",encoding="utf-8") as f:
    json.dump(docs,f)

print("Index built & saved.")

