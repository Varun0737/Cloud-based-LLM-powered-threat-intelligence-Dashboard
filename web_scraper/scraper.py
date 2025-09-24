import os, time, json, hashlib, logging
from datetime import datetime, timezone
from urllib.parse import urljoin, urlparse
import urllib.robotparser as rp

import boto3
import requests
from bs4 import BeautifulSoup
import os
print("[DEBUG] DASH_BUCKET (env):", repr(os.getenv("DASH_BUCKET")))
from sites import SITES

UA = "Masters-DashboardBot/0.1 (+contact: shyamala002@gannon.edu)"
TIMEOUT = 15
SLEEP = 1.0
PAGES_PER_SITE = 250           
REGION = os.getenv("AWS_DEFAULT_REGION", "us-east-1")
BUCKET = os.getenv("DASH_BUCKET") 
OVERWRITE_PREFIX = os.getenv("OVERWRITE_PREFIX", "latest")  # or "" to put at root
CLEAN_OLD_PREFIXES = os.getenv("CLEAN_OLD_PREFIXES", "0") == "1"

log = logging.getLogger("scraper")
logging.basicConfig(level=logging.INFO, format="%(levelname)s: %(message)s")
s3 = boto3.client("s3", region_name=REGION)

def get_robots(base_url: str) -> rp.RobotFileParser:
    robots_url = urljoin(base_url, "/robots.txt")
    p = rp.RobotFileParser()
    try:
        r = requests.get(robots_url, headers={"User-Agent": UA}, timeout=TIMEOUT)
        if r.status_code == 200:
            p.parse(r.text.splitlines())
        else:
            # if robots not present/blocked, default to cautious allow of the seeds only
            p.parse(["User-agent: *", "Allow: /"])
    except Exception:
        p.parse(["User-agent: *", "Allow: /"])
    return p

def same_host(base: str, url: str) -> bool:
    return urlparse(base).netloc == urlparse(url).netloc

def fetch(url: str) -> dict:
    r = requests.get(url, headers={"User-Agent": UA}, timeout=TIMEOUT)
    html = r.content
    return {
        "url": url,
        "timestamp": datetime.now(timezone.utc).isoformat(),
        "http_status": r.status_code,
        "headers": dict(r.headers),
        "sha256": hashlib.sha256(html).hexdigest(),
        "html": html.decode("utf-8", errors="ignore"),
    }

def extract_signals(record: dict) -> dict:
    """Non-intrusive hints only: headers, mixed content, basic lib hints, a11y counts."""
    soup = BeautifulSoup(record["html"], "html.parser")

    # title + short text sample
    title = (soup.title.string.strip() if soup.title and soup.title.string else "")
    text_sample = " ".join(soup.get_text(" ").split())[:800]

    # headers present?
    hdrs = {k.lower(): v for k, v in record["headers"].items()}
    sec = {
        "strict-transport-security": "strict-transport-security" in hdrs,
        "content-security-policy": "content-security-policy" in hdrs,
        "x-frame-options": "x-frame-options" in hdrs,
        "x-content-type-options": "x-content-type-options" in hdrs,
        "referrer-policy": "referrer-policy" in hdrs,
        "permissions-policy": "permissions-policy" in hdrs,
    }

    # mixed content (http:// subresources on an https page)
    mixed = "https://" in record["url"] and ("http://" in record["html"])

    # crude outdated lib hints
    scripts = [s.get("src", "") for s in soup.find_all("script")]
    hints = []
    if any("jquery-1." in (s or "") for s in scripts):
        hints.append("jquery 1.x referenced")

    # a11y: <img> without alt
    no_alt = sum(1 for i in soup.find_all("img") if not i.get("alt"))

    return {
        "title": title,
        "text_sample": text_sample,
        "http_security_headers": sec,
        "mixed_content": mixed,
        "tech_hints": hints,
        "accessibility_flags": [f"img without alt ({no_alt})"] if no_alt else [],
    }

def write_jsonl_s3(key: str, rows: list[dict]):
    body = "\n".join(json.dumps(r, ensure_ascii=False) for r in rows).encode("utf-8")
    s3.put_object(Bucket=BUCKET, Key=key, Body=body, ContentType="application/json")

def crawl_site(site_name: str, category: str, seeds: list[str]) -> tuple[list[dict], list[dict]]:
    base = seeds[0]
    robots = get_robots(base)
    seen, queue = set(), list(seeds)
    raw_rows, clean_rows = [], []

    while queue and len(raw_rows) < PAGES_PER_SITE:
        url = queue.pop(0)
        if url in seen: 
            continue
        seen.add(url)
        # robots check
        if not robots.can_fetch(UA, url):
            log.info(f"[{site_name}] blocked by robots.txt: {url}")
            continue

        try:
            rec = fetch(url)
        except Exception as e:
            log.warning(f"[{site_name}] fetch failed: {url} ({e})")
            continue

        raw_row = {
            "site": site_name, "category": category, **{k: rec[k] for k in ("url","timestamp","http_status","headers","sha256")}
        }
        raw_rows.append(raw_row)

        # signals
        sig = extract_signals(rec)
        clean_rows.append({**raw_row, **sig})

        # naive in-domain link discovery (first 20 links)
        soup = BeautifulSoup(rec["html"], "html.parser")
        for a in soup.select("a[href]")[:20]:
            href = a["href"]
            if href.startswith("/"):
                href = urljoin(base, href)
            if href.startswith("http") and same_host(base, href):
                queue.append(href)

        time.sleep(SLEEP)  # be polite

    return raw_rows, clean_rows

def main():
    assert BUCKET, "Set your bucket: export DASH_BUCKET=<your-bucket-name>"

    for s in SITES:
        name, cat, seeds = s["name"], s["category"], s["seeds"]
        log.info(f"==> Crawling {name} ({cat})")
        raw_rows, clean_rows = crawl_site(name, cat, seeds)

        # ✅ Overwrite the same object every run (no date folder)
        sub = f"/{OVERWRITE_PREFIX}" if OVERWRITE_PREFIX else ""
        raw_key   = f"raw/{name}{sub}/items.jsonl"
        clean_key = f"clean/{name}{sub}/items.jsonl"

        write_jsonl_s3(raw_key, raw_rows)
        write_jsonl_s3(clean_key, clean_rows)
        log.info(f"Uploaded {len(raw_rows)} raw  → s3://{BUCKET}/{raw_key}")
        log.info(f"Uploaded {len(clean_rows)} clean → s3://{BUCKET}/{clean_key}")

if __name__ == "__main__":
    main()

