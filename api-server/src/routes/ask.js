// api-server/src/routes/ask.js
import { Router } from "express";
import { spawn } from "node:child_process";
import path from "node:path";
import fs from "node:fs";
import { requireAuth } from "../requireAuth.js";

const router = Router();

const META_PATH = process.env.META_PATH || "../llm-reader/data/meta.json";
const INDEX_PATH = process.env.INDEX_PATH || "../llm-reader/data/index.faiss";
const PYTHON_BIN = process.env.PYTHON_BIN || "/usr/bin/python3";

// OpenAI config (optional)
const OPENAI_KEY = process.env.OPENAI_API_KEY || "";
const USE_OPENAI =
  (process.env.MODE || "local").toLowerCase() === "openai" && !!OPENAI_KEY;
const OPENAI_MODEL = process.env.OPENAI_MODEL || "gpt-4o-mini";

/**
 * Run a small python snippet that:
 *  - loads FAISS + fastembed
 *  - searches the existing index
 *  - returns the top-k items as `passages` (no giant raw answer)
 */
function pyAsk(question, k = 6) {
  return new Promise((resolve, reject) => {
    const code = [
      "import json, sys, numpy as np, faiss",
      "from fastembed import TextEmbedding",
      "",
      `META_PATH = "${META_PATH}"`,
      `INDEX_PATH = "${INDEX_PATH}"`,
      `MODEL_NAME = "BAAI/bge-small-en-v1.5"`,
      "",
      "meta = json.load(open(META_PATH, 'r', encoding='utf-8'))",
      "index = faiss.read_index(INDEX_PATH)",
      "model = TextEmbedding(model_name=MODEL_NAME)",
      "",
      "def embed_one(q):",
      "    v = np.array(list(model.embed([q]))[0], dtype=np.float32)[None, :]",
      "    v = v / (np.linalg.norm(v, axis=1, keepdims=True) + 1e-12)",
      "    return v",
      "",
      "if len(sys.argv) < 2:",
      "    raise SystemExit('question required')",
      "q = sys.argv[1]",
      "qv = embed_one(q)",
      "",
      "if qv.shape[1] != index.d:",
      "    raise RuntimeError(f'Dim mismatch: query {qv.shape[1]} vs index {index.d}')",
      "",
      `topk = max(1, min(20, int(${k})))`,
      "D, I = index.search(qv, topk)",
      "items = [meta[int(i)] for i in I[0]]",
      "",
      // Return passages only; Node will build the answer.
      "print(json.dumps({'passages': items}, ensure_ascii=False))",
    ].join("\n");

    const py = spawn(PYTHON_BIN, ["-c", code, question], {
      cwd: path.resolve(process.cwd()),
    });

    let out = "";
    let err = "";

    py.stdout.on("data", (d) => (out += d.toString()));
    py.stderr.on("data", (d) => (err += d.toString()));
    py.on("close", (code) => {
      if (code === 0) {
        try {
          resolve(JSON.parse(out));
        } catch (e) {
          reject(new Error("Bad JSON from python: " + e.message));
        }
      } else {
        reject(new Error(err || "python failed"));
      }
    });
  });
}

// Simple local summarizer fallback (no external API)
function localSummary(passages) {
  const top = passages.slice(0, 4);
  if (!top.length) return "I couldn’t find relevant passages.";
  const sites = [...new Set(top.map((p) => p.site || p.source).filter(Boolean))];

  const bullets = top
    .map((p, i) => {
      const title = p.title || p.url || p.final_url || "Untitled";
      const snip = ((p.text || p.snippet || "").replace(/\s+/g, " ").trim()).slice(0, 220);
      return `- [${i + 1}] ${title} — ${snip}${snip.length === 220 ? "…" : ""}`;
    })
    .join("\n");

  return `Based on ${top.length} retrieved documents from ${sites.join(", ") || "various sources"}, here’s a concise summary:\n\n${bullets}\n\n(See citations [1..${top.length}] below.)`;
}

// OpenAI-based summarizer (only used if OPENAI is configured)
async function openaiSummary(passages, question) {
  const { default: OpenAI } = await import("openai");
  const client = new OpenAI({ apiKey: OPENAI_KEY });

  const context = passages
    .slice(0, 6)
    .map((p, i) => {
      const title = p.title || p.url || p.final_url || "Untitled";
      const url = p.final_url || p.url || "";
      const snip = ((p.text || p.snippet || "").replace(/\s+/g, " ").trim()).slice(0, 800);
      return `[#${i + 1}] ${title}\n${url}\n${snip}`;
    })
    .join("\n\n");

  const system = `You are a security analyst. Write a clear, concise answer (5–8 sentences) to the user's question using only the provided passages.
Cite sources inline as [1], [2], etc., matching the numbers shown before each passage.
If information is insufficient, say so briefly. Keep it non-fluffy, actionable, and accurate.`;

  const user = `Question: ${question}\n\nPassages:\n${context}`;

  const resp = await client.chat.completions.create({
    model: OPENAI_MODEL,
    messages: [
      { role: "system", content: system },
      { role: "user", content: user },
    ],
    temperature: 0.2,
    max_tokens: 600,
  });

  return resp.choices?.[0]?.message?.content?.trim() || "I couldn’t generate a summary.";
}

// POST /api/ask  { question: "..." }
router.post("/", requireAuth, async (req, res) => {
  try {
    const { question } = req.body || {};
    if (!question || !question.trim()) {
      return res.status(400).json({ error: "question required" });
    }

    // [NEW] Fetch Real-Time Context
    const { default: ThreatReport } = await import("../models/ThreatReport.js");
    const { default: CVE } = await import("../models/CVE.js");

    const recentThreats = await ThreatReport.find().sort({ pubDate: -1 }).limit(6);
    const criticalCVEs = await CVE.find({ severity: "CRITICAL" }).sort({ published: -1 }).limit(6);

    // Build Context String
    const threatContext = recentThreats.map((t, i) => `[News-${i + 1}] ${t.title} (${t.source}): ${t.summary}`).join("\n");
    const cveContext = criticalCVEs.map((c, i) => `[CVE-${i + 1}] ${c.id}: ${c.summary.substring(0, 150)}...`).join("\n");

    // 2) Summarize / Answer (Using OpenAI or Local Fallback)
    // We override the default "passage" logic to prefer our fresh data if available
    let answer;
    if (USE_OPENAI) {
      const { default: OpenAI } = await import("openai");
      const client = new OpenAI({ apiKey: OPENAI_KEY });

      const systemPrompt = `You are an elite Cyber Threat Intelligence Analyst (Persona: 'Sentinel'). 
Your instructions:
1. Provide personalized, high-value intelligence reports.
2. ALWAYS analyze the user's question against the provided "LATEST THREAT INTEL" and "CRITICAL VULNERABILITIES".
3. If the user asks about recent threats, cite the provided news/CVEs directly.
4. maintain a professional, slightly urgent, and highly technical tone.
5. If you don't have data, say "No active signals found in the current sector."

Data Sources:
LATEST THREAT INTEL:
${threatContext}

CRITICAL VULNERABILITIES:
${cveContext}
`;

      const userPrompt = `Analyst Request: ${question}`;

      const resp = await client.chat.completions.create({
        model: OPENAI_MODEL,
        messages: [
          { role: "system", content: systemPrompt },
          { role: "user", content: userPrompt },
        ],
        temperature: 0.3,
        max_tokens: 800,
      });
      answer = resp.choices?.[0]?.message?.content?.trim();
    } else {
      // Local Mode Fallback (Simulated Intelligence)
      // Since we can't run a local LLM here easily, we construct a smart template response.
      answer = `**[SENTINEL LOCAL SYSTEM]**\n\n**STATUS**: OFFLINE (OpenAI Key not detected).\n**ANALYSIS**: Query "${question}" acknowledged.\n\n**LATEST INTERCEPTED SIGNALS**:\n\n${threatContext || "No recent news signals intercepted."}\n\n**CRITICAL VULNERABILITIES**:\n${cveContext || "No critical CVEs found locally."}`;
    }

    // Convert our DB items to "citations" format for the UI
    const newsCitations = recentThreats.map((t, i) => ({
      i: i + 1,
      id: "NEWS",
      title: t.title,
      source: t.source,
      url: t.link
    }));

    return res.json({ answer, citations: newsCitations });

    /* 
    // Legacy Code (Disabled for new Intelligence System)
    if (!fs.existsSync(META_PATH)) { ... }
    */
  } catch (e) {
    console.error("[/api/ask] error:", e);
    res.status(500).json({ error: String(e.message || e) });
  }
});

export default router;
