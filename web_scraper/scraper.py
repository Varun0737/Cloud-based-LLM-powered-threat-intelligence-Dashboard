import os, time, json, hashlib, logging, re
from datetime import datetime, timezone
from urllib.parse import urljoin, urlparse
import urllib.robotparser as rp

import boto3
import requests
from bs4 import BeautifulSoup

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

QUEUE_API_ENDPOINTS = os.getenv("QUEUE_API_ENDPOINTS", "1") == "1"  # enable API discovery
MAX_API_DISCOVER = int(os.getenv("MAX_API_DISCOVER", "10"))         # API links/page cap
HSTS_MIN_SECONDS = 15552000  # 180 days

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
            p.parse(["User-agent: *", "Allow: /"])
            # if robots not present/blocked, default to cautious allow of the seeds only

    except Exception:
        p.parse(["User-agent: *", "Allow: /"])
    return p

def same_host(base: str, url: str) -> bool:
    return urlparse(base).netloc == urlparse(url).netloc

def fetch(url: str) -> dict:
    r = requests.get(url, headers={"User-Agent": UA}, timeout=TIMEOUT, allow_redirects=True)
    html = r.content
    chain = [{"status": h.status_code, "url": h.url} for h in r.history]
    final_url = r.url
    return {
        "url": url,
        "final_url": final_url,
        "redirect_chain": chain,
        "timestamp": datetime.now(timezone.utc).isoformat(),
        "http_status": r.status_code,
        "headers": dict(r.headers),
        "sha256": hashlib.sha256(html).hexdigest(),
        "html": html.decode("utf-8", errors="ignore"),
    }

LIB_REGEXES = [
    (r"jquery[-.]?(\d+\.\d+(?:\.\d+)?)\.min\.js", "jquery"),
    (r"angular(?:\.min)?\.js", "angularjs"),
    (r"react(?:\.production)?[-.]?(\d+\.\d+(?:\.\d+)?)?\.?min?\.js", "react"),
    (r"vue(?:\.min)?\.js", "vue"),
]

SENSITIVE_WORDS = ("login", "signin", "password", "passwd", "token", "reset", "2fa", "mfa")

def parse_set_cookie(headers: dict) -> list[dict]:
    sc = []
    items = []
    for k, v in headers.items():
        if k.lower() == "set-cookie":
            if isinstance(v, list): items.extend(v)
            else: items.append(v)
    for cookie in items:
        parts = [p.strip() for p in cookie.split(";")]
        name_val = parts[0] if parts else ""
        attrs = {p.split("=",1)[0].lower(): (p.split("=",1)[1] if "=" in p else True) for p in parts[1:]}
        sc.append({"raw": cookie, "name": name_val.split("=")[0], "attrs": attrs})
    return sc

def analyze_cookies(cookies: list[dict]) -> list[str]:
    flags = []
    for c in cookies:
        a = {k.lower(): (v if isinstance(v, str) else "") for k, v in c["attrs"].items()}
        low = {k.lower(): k for k in c["attrs"].keys()}
        if "secure" not in low: flags.append(f"cookie {c['name']}: missing Secure")
        if "httponly" not in low: flags.append(f"cookie {c['name']}: missing HttpOnly")
        if "samesite" not in low: flags.append(f"cookie {c['name']}: missing SameSite")
        else:
            ss = a.get("samesite","").lower()
            if ss not in ("strict","lax"): flags.append(f"cookie {c['name']}: SameSite ≠ Strict/Lax ({ss or 'unset'})")
        if a.get("domain","").startswith("."): flags.append(f"cookie {c['name']}: Domain is wildcard ({a.get('domain')})")
        if a.get("path","") in ("", "/"): flags.append(f"cookie {c['name']}: Path too broad ({a.get('path','/')})")
    return flags

def parse_hsts(hsts: str) -> dict:
    res = {"present": bool(hsts), "max_age": None, "includeSubDomains": False, "preload": False}
    if not hsts: return res
    for part in hsts.split(";"):
        p = part.strip()
        if p.lower().startswith("max-age"):
            try:
                res["max_age"] = int(p.split("=",1)[1])
            except Exception:
                res["max_age"] = None
        elif p.lower() == "includesubdomains":
            res["includeSubDomains"] = True
        elif p.lower() == "preload":
            res["preload"] = True
    return res

def analyze_hsts(h: dict) -> list[str]:
    flags = []
    if not h.get("present"):
        flags.append("HSTS missing")
        return flags
    if h.get("max_age") is None or h["max_age"] < HSTS_MIN_SECONDS:
        flags.append(f"HSTS max-age too low ({h.get('max_age')})")
    if not h.get("includeSubDomains"):
        flags.append("HSTS missing includeSubDomains")
    return flags

def parse_csp(csp: str) -> dict:
    out = {}
    if not csp: return out
    for d in csp.split(";"):
        d = d.strip()
        if not d: continue
        if " " in d:
            k, v = d.split(" ", 1)
        else:
            k, v = d, ""
        out[k.lower()] = v.strip()
    return out

def analyze_csp(csp_map: dict) -> list[str]:
    flags = []
    if not csp_map:
        flags.append("CSP missing")
        return flags
    for k in ("script-src","style-src"):
        v = csp_map.get(k,"")
        if "'unsafe-inline'" in v: flags.append(f"CSP: {k} allows 'unsafe-inline'")
        if "'unsafe-eval'" in v: flags.append(f"CSP: {k} allows 'unsafe-eval'")
    if "object-src" not in csp_map or " 'none'" not in (" " + csp_map.get("object-src","")):
        flags.append("CSP: object-src 'none' missing")
    if "base-uri" not in csp_map or " 'none'" not in (" " + csp_map.get("base-uri","")):
        flags.append("CSP: base-uri 'none' missing")
    wild_dirs = [d for d,v in csp_map.items() if "*" in v and d not in ("img-src","media-src","font-src")]
    for d in wild_dirs:
        flags.append(f"CSP: wildcard in {d} ({csp_map[d]})")
    if "report-to" not in csp_map and "report-uri" not in csp_map:
        flags.append("CSP: no reporting (report-to/report-uri) configured")
    if "frame-ancestors" not in csp_map:
        flags.append("CSP: frame-ancestors missing")
    return flags

def analyze_cors(hdrs: dict) -> tuple[dict, list[str]]:
    cors = {k:v for k,v in hdrs.items() if k.startswith("access-control-")}
    flags = []
    o = cors.get("access-control-allow-origin")
    c = (cors.get("access-control-allow-credentials","") or "").lower() == "true"
    if o == "*" and c:
        flags.append("CORS: ACAO '*' with credentials=true")
    if o and o not in ("*", "null") and "," in o:
        flags.append(f"CORS: multiple origins in ACAO ({o})")
    return cors, flags

def find_lib_versions(scripts: list[str]) -> list[str]:
    found = []
    for s in scripts:
        for pat, name in LIB_REGEXES:
            m = re.search(pat, s, flags=re.I)
            if m:
                ver = m.group(1) if m.groups() else ""
                tag = f"{name} {ver}".strip()
                found.append(tag)
    flags = []
    if any(s.startswith("jquery 1.") for s in found):
        flags.append("Library: jQuery 1.x (EOL)")
    return found, flags

def analyze_forms(soup, base_url: str) -> tuple[list[dict], list[str]]:
    flags, forms = [], []
    for f in soup.find_all("form"):
        method = (f.get("method","get") or "get").lower()
        action = f.get("action","") or ""
        action_abs = urljoin(base_url, action) if action else base_url
        action_parsed = urlparse(action_abs)
        inputs = f.find_all(["input","textarea","select"])
        names = {i.get("name","").lower() for i in inputs if i.get("name")}
        has_csrf = any(n in names for n in ("csrf","xsrf","token","authenticity_token","_csrf","_token"))
        has_password = any((i.get("type","").lower() == "password") for i in inputs)
        autocomplete_flags = []
        for i in inputs:
            if i.get("type","").lower() in ("password","email","text"):
                ac = (i.get("autocomplete","") or "").lower()
                if has_password and ac and ac not in ("off","new-password","current-password"):
                    autocomplete_flags.append(f"autocomplete={ac}")
        local = []
        if method == "get" and any(w in (action.lower() + " " + " ".join(names)) for w in SENSITIVE_WORDS):
            local.append("Form uses GET for sensitive action")
        if action_parsed.scheme != "https":
            local.append("Form action not HTTPS")
        if has_password and not has_csrf:
            local.append("Password form missing CSRF token field (heuristic)")
        if autocomplete_flags:
            local.append("Password form has permissive autocomplete (" + ", ".join(set(autocomplete_flags)) + ")")
        forms.append({"method": method, "action": action_abs, "has_password": has_password, "has_csrf_hint": has_csrf})
        flags.extend(local)
    return forms, flags

API_HINT = re.compile(r"""(?:
    ["'](/api/[^"']+)["'] |
    ["'](https?://[^"']+\.json)["'] |
    (?:fetch|axios|xhr)\(["']([^"']+)["']
)""", re.I | re.X)

def discover_api_endpoints(html: str, base: str, same_host_only: bool=True, cap: int=10) -> list[str]:
    urls = set()
    for m in API_HINT.finditer(html):
        cand = next((g for g in m.groups() if g), None)
        if not cand: continue
        u = urljoin(base, cand)
        if same_host_only and urlparse(u).netloc != urlparse(base).netloc:
            continue
        if u.startswith("http"):
            urls.add(u)
        if len(urls) >= cap:
            break
    return list(urls)

def extract_signals(record: dict) -> dict:
    """Non-intrusive hints only: headers, mixed content, basic lib hints, a11y counts."""

    soup = BeautifulSoup(record["html"], "html.parser")
    # title + short text sample

    title = (soup.title.string.strip() if soup.title and soup.title.string else "")
    text_sample = " ".join(soup.get_text(" ").split())[:800]
    
    # headers present?
    hdrs = {k.lower(): v for k, v in record["headers"].items()}
    sec_presence = {
        "strict-transport-security": "strict-transport-security" in hdrs,
        "content-security-policy": "content-security-policy" in hdrs,
        "x-frame-options": "x-frame-options" in hdrs,
        "x-content-type-options": "x-content-type-options" in hdrs,
        "referrer-policy": "referrer-policy" in hdrs,
        "permissions-policy": "permissions-policy" in hdrs,
        "coop": "cross-origin-opener-policy" in hdrs,
        "coep": "cross-origin-embedder-policy" in hdrs,
        "corp": "cross-origin-resource-policy" in hdrs,
    }

    hsts_info = parse_hsts(hdrs.get("strict-transport-security",""))
    hsts_flags = analyze_hsts(hsts_info) if hsts_info["present"] else ["HSTS missing"]

    csp_map = parse_csp(hdrs.get("content-security-policy",""))
    csp_flags = analyze_csp(csp_map)

    cors_info, cors_flags = analyze_cors(hdrs)

    cookies = parse_set_cookie(record["headers"])
    cookie_flags = analyze_cookies(cookies)

    mixed = record.get("final_url","").startswith("https://") and ("http://" in record["html"])

    scripts = [s.get("src", "") for s in soup.find_all("script") if s.get("src")]
    libs, lib_flags = find_lib_versions(scripts)

    no_alt = sum(1 for i in soup.find_all("img") if not i.get("alt"))

    forms, form_flags = analyze_forms(soup, record.get("final_url") or record["url"])

    flags_extra = []
    rp = (hdrs.get("referrer-policy","") or "").lower()
    if not rp or rp in {"origin","unsafe-url","no-referrer-when-downgrade"}:
        flags_extra.append(f"Weak/missing Referrer-Policy ({rp or 'missing'})")
    cc = (hdrs.get("cache-control","") or "").lower()
    if any(w in (record.get("final_url") or record["url"]).lower() for w in ("login","account","settings")) and "no-store" not in cc:
        flags_extra.append("Sensitive page without Cache-Control: no-store")
    for a in soup.find_all("a", target="_blank"):
        rel = a.get("rel") or []
        if "noopener" not in rel and "noreferrer" not in rel:
            flags_extra.append("External link with target=_blank missing rel=noopener")

    header_suggestions = []
    if not sec_presence["permissions-policy"]:
        header_suggestions.append("Add Permissions-Policy e.g. camera=(), microphone=(), geolocation=(), usb=()")
    if not sec_presence["coop"]:
        header_suggestions.append("Add Cross-Origin-Opener-Policy (COOP)")
    if not sec_presence["coep"]:
        header_suggestions.append("Add Cross-Origin-Embedder-Policy (COEP)")
    if not sec_presence["corp"]:
        header_suggestions.append("Add Cross-Origin-Resource-Policy (CORP)")

    risk_flags = []
    risk_flags.extend(hsts_flags)
    risk_flags.extend(csp_flags)
    risk_flags.extend(cors_flags)
    risk_flags.extend(cookie_flags)
    risk_flags.extend(lib_flags)
    risk_flags.extend(form_flags)
    risk_flags.extend(flags_extra)
    if mixed:
        risk_flags.append("Mixed content detected")

    return {
        "title": title,
        "text_sample": text_sample,
        "http_security_headers_present": sec_presence,
        "hsts": hsts_info,
        "csp": csp_map,
        "cors": cors_info,
        "cookies": cookies,
        "libraries_detected": libs,
        "forms": forms,
        "header_suggestions": header_suggestions,
        "mixed_content": mixed,
        "accessibility_flags": [f"img without alt ({no_alt})"] if no_alt else [],
        "redirect_chain": record.get("redirect_chain", []),
        "final_url": record.get("final_url", record["url"]),
        "risk_flags": sorted(set(risk_flags)),
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
        if not robots.can_fetch(UA, url):
            log.info(f"[{site_name}] blocked by robots.txt: {url}")
            continue

        try:
            rec = fetch(url)
        except Exception as e:
            log.warning(f"[{site_name}] fetch failed: {url} ({e})")
            continue

        raw_row = {
            "site": site_name, "category": category,
            **{k: rec[k] for k in ("url","final_url","redirect_chain","timestamp","http_status","headers","sha256")}
        }
        raw_rows.append(raw_row)

        sig = extract_signals(rec)
        clean_rows.append({**raw_row, **sig})

        soup = BeautifulSoup(rec["html"], "html.parser")
        for a in soup.select("a[href]")[:20]:
            href = a["href"]
            if href.startswith("/"):
                href = urljoin(base, href)
            if href.startswith("http") and same_host(base, href):
                queue.append(href)

        if QUEUE_API_ENDPOINTS:
            for api_url in discover_api_endpoints(rec["html"], base, same_host_only=True, cap=MAX_API_DISCOVER):
                if same_host(base, api_url):
                    queue.append(api_url)

        time.sleep(SLEEP)

    return raw_rows, clean_rows

def main():
    assert BUCKET, "Set your bucket: export DASH_BUCKET=<your-bucket-name>"

    for s in SITES:
        name, cat, seeds = s["name"], s["category"], s["seeds"]
        log.info(f"==> Crawling {name} ({cat})")
        raw_rows, clean_rows = crawl_site(name, cat, seeds)

        sub = f"/{OVERWRITE_PREFIX}" if OVERWRITE_PREFIX else ""
        raw_key   = f"raw/{name}{sub}/items.jsonl"
        clean_key = f"clean/{name}{sub}/items.jsonl"

        write_jsonl_s3(raw_key, raw_rows)
        write_jsonl_s3(clean_key, clean_rows)
        log.info(f"Uploaded {len(raw_rows)} raw  → s3://{BUCKET}/{raw_key}")
        log.info(f"Uploaded {len(clean_rows)} clean → s3://{BUCKET}/{clean_key}")

if __name__ == "__main__":
    main()
