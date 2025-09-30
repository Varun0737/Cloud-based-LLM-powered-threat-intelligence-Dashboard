import os, json, numpy as np, faiss
from openai import OpenAI

client = OpenAI(api_key=os.getenv("OPENAI_API_KEY"))

# load index + meta
index = faiss.read_index("data/index.faiss")
meta = json.load(open("data/meta.json"))

def embed(q):
    resp = client.embeddings.create(
        model="text-embedding-3-small",
        input=q
    )
    return np.array(resp.data[0].embedding, dtype=np.float32)

def answer(question, k=5):
    qv = embed(question)
    qv = qv / np.linalg.norm(qv)
    D,I = index.search(np.array([qv],dtype=np.float32), k)
    context = "\n\n".join(meta[i]["text"][:500] for i in I[0])
    prompt = f"""Answer the question using only the context below:

Context:
{context}

Question: {question}
Answer:"""
    resp = client.responses.create(model="gpt-4.1-mini", input=prompt)
    return resp.output_text

if __name__=="__main__":
    while True:
        q=input("Ask: ")
        if not q.strip(): break
        print(answer(q))

