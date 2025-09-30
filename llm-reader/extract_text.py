#!/usr/bin/env python3
import os, json, sys, io
import boto3
from tqdm import tqdm
import chardet
from bs4 import BeautifulSoup
import html2text

# === SETTINGS (change to your bucket name) ===============================
AWS_PROFILE = os.getenv("AWS_PROFILE", "llm-s3")
BUCKET = os.getenv("S3_BUCKET", "project698")
OUT_PATH = "data/docs.jsonl"
MAX_BYTES = 5_000_000  # skip files bigger than ~5 MB for this first pass

# File types we'll try to read/convert
TEXT_TYPES = (".txt", ".md", ".csv", ".xml")
HTML_TYPES = (".html", ".htm")
JSON_TYPES = (".json", ".jsonl")

# Which JSON fields might contain the real text/title/url
TEXT_FIELDS = ["text", "content", "body", "article", "full_text", "textContent", "summary"]
TITLE_FIELDS = ["title", "headline", "name"]
URL_FIELDS = ["url", "link", "canonical_url", "source_url"]

# === HELPERS ==============================================================

def ext_of(key: str) -> str:
    k = key.lower()
    for ext in JSON_TYPES + HTML_TYPES + TEXT_TYPES:
        if k.endswith(ext):
            return ext
    return ""

def safe_decode(raw: bytes) -> str:
    """Try utf-8 first, then detect encoding if needed."""
    try:
        return raw.decode("utf-8")
    except UnicodeDecodeError:
        enc = chardet.detect(raw).get("encoding") or "utf-8"
        try:
            return raw.decode(enc, errors="replace")
        except Exception:
            return raw.decode("utf-8", errors="replace")

def html_to_text(html: str) -> str:
    # Strip scripts/styles, convert to readable markdown-ish text
    soup = BeautifulSoup(html, "lxml")
    for bad in soup(["script", "style", "noscript"]):
        bad.decompose()
    h = html2text.HTML2Text()
    h.ignore_links = False
    h.ignore_images = True
    h.body_width = 0
    return h.handle(str(soup))

def pick(d: dict, fields: list[str]):
    for k in fields:
        if k in d and d[k]:
            return d[k]
    return None

def to_doc(record_id: str, source: str, title: str, url: str, text: str) -> dict:
    return {
        "id": record_id,
        "source": source,
        "title": title or source or "Untitled",
        "url": url,
        "text": text.strip()
    }

# === MAIN =================================================================

def main():
    # Load your Step-2 manifest (from S3 list)
    with open("manifest.json", "r", encoding="utf-8") as f:
        manifest = json.load(f)
    items = manifest.get("Contents", [])
    if not items:
        print("No objects found in manifest.json -> Contents[] is empty", file=sys.stderr)
        sys.exit(1)

    # S3 client using your profile
    session = boto3.Session(profile_name=AWS_PROFILE)
    s3 = session.client("s3")

    os.makedirs(os.path.dirname(OUT_PATH), exist_ok=True)
    out = open(OUT_PATH, "w", encoding="utf-8")

    kept, skipped = 0, 0
    for obj in tqdm(items, desc="Reading S3 objects"):
        key = obj.get("Key")
        size = obj.get("Size") or 0
        if not key:
            continue
        ext = ext_of(key)

        # Skip huge files in the first pass
        if size and size > MAX_BYTES:
            skipped += 1
            continue

        try:
            body = s3.get_object(Bucket=BUCKET, Key=key)["Body"].read()
        except Exception as e:
            skipped += 1
            continue

        text = ""
        title = None
        url = None
        source = key.split("/")[0] if "/" in key else "bucket"

        # Handle by type
        if ext in TEXT_TYPES:
            text = safe_decode(body)

        elif ext in HTML_TYPES:
            html = safe_decode(body)
            text = html_to_text(html)

        elif ext == ".json":
            raw = safe_decode(body)
            try:
                objj = json.loads(raw)
            except Exception:
                skipped += 1
                continue

            # If it's a list of articles
            if isinstance(objj, list):
                for i, item in enumerate(objj):
                    if not isinstance(item, dict):
                        continue
                    t = pick(item, TEXT_FIELDS)
                    if not t:
                        continue
                    ti = pick(item, TITLE_FIELDS)
                    u = pick(item, URL_FIELDS)
                    rid = f"{key}:{i}"
                    doc = to_doc(rid, source, ti, u, str(t))
                    out.write(json.dumps(doc, ensure_ascii=False) + "\n")
                    kept += 1
                continue
            # If it's a single dict
            elif isinstance(objj, dict):
                t = pick(objj, TEXT_FIELDS) or ""
                ti = pick(objj, TITLE_FIELDS)
                u = pick(objj, URL_FIELDS)
                if t:
                    doc = to_doc(key, source, ti, u, str(t))
                    out.write(json.dumps(doc, ensure_ascii=False) + "\n")
                    kept += 1
                else:
                    # if no obvious text field, just store the whole json minified as text
                    doc = to_doc(key, source, ti, u, json.dumps(objj, ensure_ascii=False))
                    out.write(json.dumps(doc, ensure_ascii=False) + "\n")
                    kept += 1

        elif ext == ".jsonl":
            raw = safe_decode(body)
            for i, line in enumerate(raw.splitlines()):
                line = line.strip()
                if not line:
                    continue
                try:
                    rec = json.loads(line)
                except Exception:
                    continue
                t = pick(rec, TEXT_FIELDS) or ""
                ti = pick(rec, TITLE_FIELDS)
                u = pick(rec, URL_FIELDS)
                if not t:
                    # fallback: keep minified record text
                    t = json.dumps(rec, ensure_ascii=False)
                rid = f"{key}:{i}"
                doc = to_doc(rid, source, ti, u, str(t))
                out.write(json.dumps(doc, ensure_ascii=False) + "\n")
                kept += 1

        else:
            # Unknown type for now -> try to decode as text anyway
            text = safe_decode(body)

        if text and ext not in (".json", ".jsonl"):
            doc = to_doc(key, source, None, None, text)
            out.write(json.dumps(doc, ensure_ascii=False) + "\n")
            kept += 1

    out.close()
    print(f"Saved {kept} docs to {OUT_PATH}; skipped {skipped} objects")

if __name__ == "__main__":
    main()

