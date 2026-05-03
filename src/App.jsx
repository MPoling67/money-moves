import { useState } from "react";
import HeroBanner from './HeroBanner.jsx';

import { MONEY_MOVES_SYSTEM_PROMPT } from './prompts.js';
import { REVENUE_SYSTEM_PROMPT } from './prompts.js';

// ── LOGGER ────────────────────────────────────────────────────────────────────
const LOGGER = "https://script.google.com/macros/s/AKfycbwvztxaVKSDYhevhsjQ7LowAMvjBu4ONs2AqXytbNflmEJ_mfBF7mI54fgyhBZzhU8M/exec";


// ── HELPERS ───────────────────────────────────────────────────────────────────
function normalizeUrl(input) {
  let url = input.trim();
  if (!url) return url;
  if (!/^https?:\/\//i.test(url)) url = "https://" + url;
  return url.replace(/\/+$/, "");
}

async function callAPI(system, messages) {
  const body = { model: "claude-sonnet-4-6", max_tokens: 2000, system, messages,
    tools: [{ type: "web_search_20250305", name: "web_search" }] };
  const r = await fetch("/api/anthropic", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  if (!r.ok) throw new Error(`API error ${r.status}: ${await r.text()}`);
  const data = await r.json();
  const textBlocks = data.content?.filter((b) => b.type === "text") || [];
  if (!textBlocks.length) throw new Error("No text block in response.");
  const tb = textBlocks[textBlocks.length - 1];
  const stripped = tb.text.replace(/```json|```/g, "").replace(/<[^>]*cite[^>]*>/gi, "").trim();
  const start = stripped.indexOf("{");
  const end = stripped.lastIndexOf("}");
  if (start === -1 || end === -1) throw new Error("No JSON object found in response.");
  return JSON.parse(stripped.slice(start, end + 1));
}

async function generateReport(rawUrl) {
  const url = normalizeUrl(rawUrl);
  return callAPI(MONEY_MOVES_SYSTEM_PROMPT, [{
    role: "user",
    content: `You MUST use the web_search tool to fetch and read the LIVE website right now. Do not use memory.\n\nREQUIRED SEQUENCE — follow exactly:\n1. Use web_search to fetch: ${url}\n2. Read the FULL returned content carefully.\n3. If content is empty or an error, try these in order:\n   - ${url}/\n   - ${url.replace(/^https:\/\//, "https://www.")}\n   - ${url.replace(/^https:\/\/www\./, "https://")}\n4. Before writing the report, list internally 5+ SPECIFIC details from the page you just read. These details MUST appear in your report.\n5. Write the report using ONLY those fetched details.\n\nWARNING: The URL being analyzed is ${url}. You have NO prior knowledge of this business that is reliable. Your training data about this person or business is FORBIDDEN — it is outdated and inaccurate. Only what you read from the live page right now is valid.\n\nRecord every URL attempted in urlsAttempted. If you truly cannot fetch content after all attempts, set fetchSuccess to false, explain in fetchNote, and score conservatively (8/20 max per dimension). Return the full JSON.`
  }]);
}

async function generateRevenue(powerData) {
  const body = {
    model: "claude-sonnet-4-6",
    max_tokens: 2000,
    system: REVENUE_SYSTEM_PROMPT,
    messages: [{
      role: "user",
      content: `Here is the POWER Score data for your  business:\n\n${JSON.stringify(powerData, null, 2)}\n\nGenerate the Revenue Mapping JSON. Be specific to this business — no generic advice.`
    }]
  };
  const r = await fetch("/api/anthropic", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  if (!r.ok) throw new Error(`API error ${r.status}`);
  const data = await r.json();
  const textBlocks = data.content?.filter((b) => b.type === "text") || [];
  if (!textBlocks.length) throw new Error("No text block in response.");
  const tb = textBlocks[textBlocks.length - 1];
  const stripped = tb.text.replace(/\`\`\`json|\`\`\`/g, "").replace(/<[^>]*cite[^>]*>/gi, "").trim();
  const start = stripped.indexOf("{");
  const end = stripped.lastIndexOf("}");
  if (start === -1 || end === -1) throw new Error("No JSON found.");
  return JSON.parse(stripped.slice(start, end + 1));
}

// ── CONSTANTS ─────────────────────────────────────────────────────────────────
const LOAD_STEPS = [
  "Pulling up your site...",
  "Reading what's actually there...",
  "Finding the wow factor...",
  "Mapping your services...",
  "Almost there...",
  "Putting it together...",
];

// ── SUB-COMPONENTS ────────────────────────────────────────────────────────────
function PulseLoader({ text }) {
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 10, padding: "4px 0" }}>
      <span style={{ width: 5, height: 5, borderRadius: "50%", background: "#861442",
        display: "inline-block", animation: "dot-pulse 1.2s ease-in-out infinite", flexShrink: 0 }} />
      <span style={{ fontSize: 14, color: "#f0ede8", fontStyle: "italic", fontWeight: 300, opacity: 0.6 }}>{text}</span>
    </div>
  );
}

function ScoreBar({ score, max }) {
  const pct = Math.round((Math.min(score, max) / max) * 100);
  return (
    <div style={{ background: "#4a4a46", borderRadius: 2, height: 3, overflow: "hidden" }}>
      <div style={{ height: "100%", width: `${pct}%`, background: "#861442", borderRadius: 2, animation: "dot-bar 1.2s ease forwards" }} />
    </div>
  );
}

// ── MAIN APP ──────────────────────────────────────────────────────────────────
export default function App() {
  const [url, setUrl] = useState("");
  const [loading, setLoading] = useState(false);
  const [progress, setProgress] = useState("");
  const [report, setReport] = useState(null);
  const [error, setError] = useState(null);
  const [debugInfo, setDebugInfo] = useState(null);
  const [debugOpen, setDebugOpen] = useState(false);

  const [firstName, setFirstName] = useState("");
  const [email, setEmail] = useState("");
  const [emailSubmitted, setEmailSubmitted] = useState(false);
  const [emailSubmitting, setEmailSubmitting] = useState(false);
  const [emailError, setEmailError] = useState(null);
  const [emailSubscribe, setEmailSubscribe] = useState(true);

  const [revenue, setRevenue] = useState(null);
  const [revenueLoading, setRevenueLoading] = useState(false);
  const [revenueError, setRevenueError] = useState(null);

  const isMonica = new URLSearchParams(window.location.search).has("monica");

  const handleGenerate = async () => {
    if (!url.trim()) return;
    setLoading(true);
    setError(null);
    setDebugInfo(null);
    setReport(null);
    setEmailSubmitted(false);
    let i = 0;
    setProgress(LOAD_STEPS[0]);
    const interval = setInterval(() => { i = (i + 1) % LOAD_STEPS.length; setProgress(LOAD_STEPS[i]); }, 2200);
    try {
      const result = await generateReport(url);
      setReport(result);
      document.title = `Money Moves Brief — ${result.businessName}`;
      const now = new Date();
      const humanTime = now.toLocaleString("en-US", { month: "long", day: "numeric", year: "numeric", hour: "numeric", minute: "2-digit", hour12: true });
      fetch(LOGGER, {
        method: "POST", mode: "no-cors",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ timestamp: humanTime, event: "report_run", app: "Money Moves", url: url.trim(), score: "", firstName: "", email: "", subscribe: "" }),
      }).catch(() => {});
      if (!result.fetchSuccess || result.fetchNote) {
        setDebugInfo(
          `Fetch status: ${result.fetchSuccess ? "Success" : "Failed"}\n` +
          `URLs attempted: ${result.urlsAttempted?.join(", ") || "unknown"}\n` +
          (result.fetchNote ? `Note: ${result.fetchNote}` : "")
        );
      }
    } catch (e) {
      setError("Oops — looks like AI gremlins are up to no good. Try again.");
      setDebugInfo(e.message);
    } finally {
      clearInterval(interval);
      setLoading(false);
      setProgress("");
    }
  };

  const handleEmailSubmit = async () => {
    if (!email.trim() || !firstName.trim()) return;
    setEmailSubmitting(true);
    setEmailError(null);
    try {
      const now = new Date();
      const humanTime = now.toLocaleString("en-US", { month: "long", day: "numeric", year: "numeric", hour: "numeric", minute: "2-digit", hour12: true });
      await fetch(LOGGER, {
        method: "POST", mode: "no-cors",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ timestamp: humanTime, event: "email_submit", app: "Money Moves", url: url.trim(), score: report?.overallScore || "", firstName: firstName.trim(), email: email.trim(), subscribe: emailSubscribe ? "yes" : "no" }),
      });
      setEmailSubmitted(true);
      setRevenueLoading(true);
      generateRevenue(report)
        .then(result => { setRevenue(result); setRevenueLoading(false); })
        .catch(() => { setRevenueError("Could not load revenue mapping."); setRevenueLoading(false); });
    } catch {
      setEmailError("Something went wrong. Please try again.");
    } finally {
      setEmailSubmitting(false);
    }
  };

  return (
    <div style={{ minHeight: "100vh", background: "#1a1a18", color: "#f0ede8" }}>

      <style>{`
        *, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }
        :root {
          --bg: #1a1a18; --surface: #242422; --surface2: #2e2e2b;
          --border: rgba(255,255,255,0.08); --border2: rgba(255,255,255,0.14);
          --text: #f0ede8; --muted: #c8c4bc;
          --accent: #861442; --accent2: #be3650;
          --font-display: 'Fraunces', Georgia, serif;
          --font-body: 'Plus Jakarta Sans', sans-serif;
          --radius: 10px;
        }
        body { font-family: var(--font-body); background: #1a1a18; }
        @keyframes dot-pulse { 0%,100%{opacity:.25;transform:scale(1)} 50%{opacity:1;transform:scale(1.5)} }
        @keyframes dot-bar { from { width: 0 } }
        @keyframes fadeUp { from { opacity:0; transform:translateY(12px) } to { opacity:1; transform:translateY(0) } }
        .dot-anim { animation: fadeUp 0.5s ease both; }

        .dot-input-zone { background: #111110; padding: 1rem clamp(16px,4vw,2rem); border-bottom: 1px solid rgba(255,255,255,0.06); }
        .dot-input-row { display: flex; gap: 10px; flex-wrap: wrap; }
        .dot-input-field { flex: 1; min-width: 200px; padding: 10px 14px; background: #111110; border: 1px solid rgba(255,255,255,0.12); border-radius: var(--radius); color: #f0ede8; -webkit-text-fill-color: #f0ede8; font-family: var(--font-body); font-size: 14px; font-weight: 300; outline: none; transition: border-color 0.2s; }
        .dot-input-field:focus { border-color: #861442; }
        .dot-input-field::placeholder { color: #5a5a56; opacity: 1; }

        .btn-primary { background: #861442 !important; color: #ffffff !important; border: none; font-family: var(--font-body); font-size: 13px; font-weight: 500; padding: 10px 22px; border-radius: var(--radius); cursor: pointer; letter-spacing: 0.04em; transition: opacity 0.15s, transform 0.1s; white-space: nowrap; }
        .btn-primary:hover { opacity: 0.88; }
        .btn-primary:active { transform: scale(0.97); }
        .btn-primary:disabled { opacity: 0.35; cursor: not-allowed; }
        .btn-ghost { background: transparent; color: var(--text); border: 1px solid var(--border2); font-family: var(--font-body); font-size: 13px; padding: 10px 18px; border-radius: var(--radius); cursor: pointer; transition: color 0.15s, border-color 0.15s; }
        .btn-ghost:hover { color: #be3650; border-color: #be3650; }

        .dot-report-zone { background: var(--bg); padding: 0 clamp(16px,4vw,2rem) 80px; }
        .dot-report-head { padding: 36px 0 24px; border-bottom: 1px solid var(--border); }
        .dot-report-name { font-family: var(--font-display); font-weight: 300; font-size: clamp(22px,4vw,36px); letter-spacing: -0.02em; color: var(--text); margin-bottom: 6px; line-height: 1.1; }
        .dot-report-date { font-family: var(--font-body); font-size: 12px; letter-spacing: 0.12em; text-transform: uppercase; color: #be3650; }

        .card { background: var(--surface); border: 1px solid var(--border); border-radius: var(--radius); padding: clamp(18px,4vw,24px) clamp(18px,4vw,28px); margin-bottom: 14px; }
        .card-label { font-family: var(--font-body); font-size: 11px; font-weight: 500; letter-spacing: 0.14em; text-transform: uppercase; color: #be3650; margin-bottom: 14px; }
        .card-body { font-family: var(--font-body); font-size: 14px; font-weight: 300; line-height: 1.8; color: #f0ede8; }

        .dot-score-num { font-family: var(--font-display); font-weight: 300; font-style: italic; font-size: clamp(72px,13vw,108px); line-height: 1; letter-spacing: -0.04em; color: #be3650; }
        .dot-score-den { font-family: var(--font-display); font-size: 22px; font-weight: 300; color: #c8c4bc; padding-bottom: 8px; }

        .power-row { padding: 18px 0; border-bottom: 1px solid rgba(255,255,255,0.08); }
        .power-row:first-child { padding-top: 0; }
        .power-row:last-child { border-bottom: none; padding-bottom: 0; }
        .power-meta { display: flex; align-items: baseline; justify-content: space-between; gap: 12px; margin-bottom: 8px; }
        .power-title { font-family: var(--font-body); font-size: 14px; font-weight: 500; color: #f0ede8; }
        .power-letter { color: #be3650; margin-right: 4px; }
        .power-score-val { font-family: var(--font-body); font-size: 14px; font-weight: 500; color: var(--muted); white-space: nowrap; }
        .power-content { font-family: var(--font-body); font-size: 14px; font-weight: 300; line-height: 1.8; color: #f0ede8; margin-top: 10px; }

        .dot-field { width: 100%; padding: 10px 14px; background: #111110 !important; border: 1px solid rgba(255,255,255,0.12); border-radius: var(--radius); color: #f0ede8 !important; font-family: var(--font-body); font-size: 14px; font-weight: 300; outline: none; transition: border-color 0.2s; -webkit-text-fill-color: #f0ede8 !important; caret-color: #f0ede8; }
        .dot-field:focus { border-color: #861442; background: #111110 !important; }
        .dot-field::placeholder { color: #5a5a56; opacity: 1; }
        .dot-field:-webkit-autofill,
        .dot-field:-webkit-autofill:hover,
        .dot-field:-webkit-autofill:focus { -webkit-box-shadow: 0 0 0 1000px #111110 inset !important; -webkit-text-fill-color: #f0ede8 !important; caret-color: #f0ede8; border-color: #861442; }

        .dot-debug-pre { padding: 14px; background: var(--surface2); border: 1px solid var(--border); border-radius: 6px; color: var(--muted); font-size: 12px; white-space: pre-wrap; word-break: break-word; line-height: 1.6; font-family: var(--font-body); margin-top: 8px; }

        .page-footer { background: #111110; padding: 1.25rem clamp(16px,4vw,2rem); font-family: var(--font-body); font-size: 12px; font-weight: 300; color: #f0ede8; text-align: center; line-height: 20px; }
        .page-footer a { color: #861442; text-decoration: none; font-weight: 500; }
        .page-footer a:hover { color: #be3650; }

        @media print {
          .no-print { display: none !important; }
          body { background: #fff !important; color: #000 !important; }
          * { -webkit-print-color-adjust: exact; print-color-adjust: exact; }
          h3 { margin: 0.75rem 0 0.35rem !important; font-size: 18px !important; color: #000 !important; }
          .card { background: #f7f7f7 !important; border: 1px solid #ddd !important; padding: 10px 14px !important; margin-bottom: 6px !important; }
          .card-label { margin-bottom: 8px !important; color: #861442 !important; }
          .card-body { color: #111 !important; line-height: 1.5 !important; }
          .dot-report-head { padding: 12px 0 10px !important; border-bottom: 1px solid #ddd !important; }
          .dot-report-name { font-size: 22px !important; color: #000 !important; }
          .dot-report-date { color: #861442 !important; }
          .dot-score-num { font-size: 48px !important; color: #861442 !important; }
          .dot-score-den { color: #444 !important; }
          .power-row { padding: 10px 0 !important; border-bottom: 1px solid #eee !important; }
          .power-title { color: #000 !important; }
          .power-letter { color: #861442 !important; }
          .power-score-val { color: #444 !important; }
          .power-content { color: #111 !important; line-height: 1.5 !important; }
          .dot-report-zone { padding-bottom: 20px !important; background: #fff !important; }
          .dot-dim-bar { background: #f0f0f0 !important; border-bottom: 1px solid #ddd !important; }
          .dot-dim-col { color: #000 !important; }
        }
        @media (max-width: 600px) {
          .dot-input-row { flex-direction: column; }
        }
      `}</style>

      <div style={{ maxWidth: 860, margin: "0 auto", overflow: "hidden" }}>

        {/* SEO hidden h1 */}
        <h1 style={{ position: "absolute", width: 1, height: 1, padding: 0, margin: -1, overflow: "hidden", clip: "rect(0,0,0,0)", whiteSpace: "nowrap", border: 0 }}>
          Money Moves Brief — Free Revenue Intelligence Tool | Data on Tap
        </h1>

        {/* ── HERO BANNER ── */}
        <HeroBanner />

        {/* ── INPUT ZONE ── */}
        <div className="dot-input-zone no-print">
          <div style={{ background: "#111110", border: "1.5px solid rgba(134,20,66,0.5)", borderRadius: 10, padding: "1.25rem clamp(16px,4vw,1.5rem)" }}>
            <div className="dot-input-row">
              <input
                type="url"
                value={url}
                onChange={(e) => setUrl(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && !loading && handleGenerate()}
                placeholder="Enter your business URL"
                className="dot-input-field"
              />
              <button className="btn-primary" onClick={handleGenerate} disabled={loading || !url.trim()}>
                {loading ? "Analyzing..." : "Get My Brief →"}
              </button>
            </div>
            {loading && <div style={{ marginTop: 14 }}><PulseLoader text={progress} /></div>}
            {error && (
              <div style={{ marginTop: 14 }}>
                <p style={{ color: "#c0705a", fontSize: 13, fontFamily: "'Plus Jakarta Sans',sans-serif", marginBottom: 8 }}>{error}</p>
                {debugInfo && (
                  <>
                    <button className="btn-ghost" onClick={() => setDebugOpen(o => !o)} style={{ fontSize: 12, padding: "5px 12px" }}>
                      {debugOpen ? "Hide" : "Show"} debug info
                    </button>
                    {debugOpen && <pre className="dot-debug-pre">{debugInfo}</pre>}
                  </>
                )}
              </div>
            )}
          </div>
        </div>

        {/* ── REPORT ── */}
        {report && (
          <div className="dot-report-zone" style={{ animation: "fadeUp 0.5s ease both" }}>
            <div className="page-footer-rule" style={{ margin: "0" }} />
            <div className="dot-report-head dot-anim">
              <h2 className="dot-report-name">{report.businessName}</h2>
              <p className="dot-report-date">➜ {report.dateGenerated}</p>
            </div>

            {/* Debug (Monica only) */}
            {isMonica && debugInfo && (
              <div style={{ marginTop: 16 }}>
                <button className="btn-ghost" style={{ fontSize: 11, padding: "6px 12px" }} onClick={() => setDebugOpen(!debugOpen)}>
                  {debugOpen ? "Hide" : "Show"} Fetch Debug
                </button>
                {debugOpen && <pre className="dot-debug-pre">{debugInfo}</pre>}
              </div>
            )}

            {/* ── ONE CARD: About + Wow + Services ── */}
            <h3 style={{ fontFamily: "'Fraunces', Georgia, serif", fontSize: 24, fontWeight: 300, color: "#f0ede8", margin: "2rem 0 0.75rem", letterSpacing: "-0.01em" }}>
              About {report.businessName} <span style={{ fontWeight: 300, fontSize: 16, color: "var(--muted)", fontStyle: "normal" }}>| {url}</span>
            </h3>
            <div className="card dot-anim" style={{ animationDelay: "0.1s" }}>

              <p className="card-label">About {report.businessName}</p>
              <p className="card-body">{report.orgParagraph}</p>

              {report.wow && (
                <>
                  <div style={{ height: 1, background: "rgba(255,255,255,0.07)", margin: "20px 0" }} />
                  <p className="card-label">Wow Factor</p>
                  {report.wow.headline && (
                    <p style={{ fontFamily: "var(--font-body)", fontSize: 15, fontWeight: 500, color: "#f0ede8", marginBottom: 8, lineHeight: 1.5 }}>{report.wow.headline}</p>
                  )}
                  <p className="card-body">{report.wow.content}</p>
                </>
              )}

              {report.services?.length > 0 && (
                <>
                  <div style={{ height: 1, background: "rgba(255,255,255,0.07)", margin: "20px 0" }} />
                  <p className="card-label">Services</p>
                  {report.services.map((s, i) => (
                    <div key={i} style={{ display: "flex", gap: 10, marginBottom: 10 }}>
                      <span style={{ fontFamily: "var(--font-body)", fontSize: 16, fontWeight: 400, color: "#be3650", flexShrink: 0, lineHeight: 1.5 }}>→</span>
                      <p style={{ fontFamily: "var(--font-body)", fontSize: 15, fontWeight: 400, lineHeight: 1.6, color: "#c8c4bc", margin: 0 }}>
                        <strong style={{ fontWeight: 500, color: "#f0ede8" }}>{s.name}</strong> — {s.note}
                      </p>
                    </div>
                  ))}
                </>
              )}

            </div>

            {/* ── SLEEPING GIANT ── */}
            {report.sleepingGiant && (
              <>
                <h3 style={{ fontFamily: "'Fraunces', Georgia, serif", fontSize: 24, fontWeight: 300, color: "#f0ede8", margin: "2rem 0 0.75rem", letterSpacing: "-0.01em" }}>Sleeping Giant</h3>
                <div className="card dot-anim" style={{ animationDelay: "0.2s" }}>
                  <p className="card-label">Your Biggest Money Move</p>
                  <p className="card-body">{report.sleepingGiant}</p>
                </div>
              </>
            )}

            {/* ── EMAIL GATE ── */}
            <h3 style={{ fontFamily: "'Fraunces', Georgia, serif", fontSize: 24, fontWeight: 300, color: "#f0ede8", margin: "2rem 0 0.75rem", letterSpacing: "-0.01em" }}>Want Your Money Moves?</h3>

            {!emailSubmitted ? (
              <>
                {/* Box 1 — teaser */}
                <div className="card dot-anim" style={{ animationDelay: "0.3s", marginBottom: 12 }}>
                  <p className="card-label">Get Your Money Moves</p>
                  <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
                    {["Your Sleeping Giant (your most overlooked opportunity)", "Competitor Analysis", "Revenue Moves"].map((item) => (
                      <div key={item} style={{ display: "flex", alignItems: "center", gap: 10 }}>
                        <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
                          <circle cx="8" cy="8" r="8" fill="#2a5c3f"/>
                          <polyline points="4,8 7,11 12,5" stroke="#4caf8a" strokeWidth="1.5" fill="none" strokeLinecap="round" strokeLinejoin="round"/>
                        </svg>
                        <span style={{ fontFamily: "'Plus Jakarta Sans',sans-serif", fontSize: 14, fontWeight: 300, color: "#f0ede8", lineHeight: 1.8 }}>{item}</span>
                      </div>
                    ))}
                  </div>
                </div>

                <h3 style={{ fontFamily: "'Fraunces', Georgia, serif", fontSize: 24, fontWeight: 700, color: "#861442", margin: "0 0 0.75rem", letterSpacing: "-0.01em" }}>Yes! Show Me the Money Moves</h3>

                {/* Box 2 — CTA, crimson */}
                <div className="dot-anim no-print" style={{ animationDelay: "0.4s", background: "rgba(134,20,66,0.08)", border: "1.5px solid #861442", borderRadius: "var(--radius)", padding: "clamp(18px,4vw,24px) clamp(18px,4vw,28px)", marginBottom: 14 }}>
                  <div style={{ display: "flex", gap: 10, flexWrap: "wrap", marginBottom: 12 }}>
                    <input type="text" value={firstName} onChange={(e) => setFirstName(e.target.value)}
                      placeholder="First name" className="dot-field" style={{ flex: 1, minWidth: 140 }} />
                    <input type="email" value={email} onChange={(e) => setEmail(e.target.value)}
                      onKeyDown={(e) => e.key === "Enter" && handleEmailSubmit()}
                      placeholder="Email address" className="dot-field" style={{ flex: 2, minWidth: 200 }} />
                  </div>
                  {emailError && <p style={{ fontFamily: "'Plus Jakarta Sans',sans-serif", fontSize: 13, color: "#c0705a", marginBottom: 10 }}>{emailError}</p>}
                  <button className="btn-primary" onClick={handleEmailSubmit}
                    disabled={emailSubmitting || !email.trim() || !firstName.trim()}
                    style={{ marginBottom: 12, width: "100%" }}>
                    {emailSubmitting ? "Sending..." : "Unlock My Full Report →"}
                  </button>
                  <label style={{ display: "flex", alignItems: "center", gap: 6, cursor: "pointer", fontSize: 11, fontWeight: 300, color: "#f0ede8", lineHeight: 1.6 }}>
                    <input type="checkbox" checked={emailSubscribe} onChange={(e) => setEmailSubscribe(e.target.checked)}
                      style={{ accentColor: "#861442", width: 13, height: 13, cursor: "pointer", flexShrink: 0 }} />
                    I understand I'll be subscribed to Let's Make Some Noise with weekly AI tips. I can unsubscribe any time.
                  </label>
                </div>
              </>
            ) : (
              <p style={{ fontFamily: "'Plus Jakarta Sans',sans-serif", fontSize: 13, color: "#4caf8a", marginBottom: 14 }}>
                ✓ Report unlocked — your full intel is below.
              </p>
            )}

            {/* ── BUCKET 2 — REVENUE MAPPING ── */}
            {emailSubmitted && (
              <>
                <h3 style={{ fontFamily: "'Fraunces', Georgia, serif", fontSize: 24, fontWeight: 300, color: "#f0ede8", margin: "2rem 0 0.75rem", letterSpacing: "-0.01em" }}>Money Moves</h3>
                {revenueLoading && (
                  <div className="card dot-anim">
                    <PulseLoader text="Building your revenue map..." />
                  </div>
                )}
                {revenueError && (
                  <div className="card dot-anim">
                    <p style={{ color: "#c0705a", fontSize: 13 }}>{revenueError}</p>
                  </div>
                )}
                {revenue && (
                  <div className="card dot-anim">

                    {/* Services */}
                    {revenue.services?.length > 0 && (
                      <div style={{ marginBottom: 20 }}>
                        <p style={{ fontFamily: "var(--font-body)", fontSize: 11, fontWeight: 500, letterSpacing: "0.14em", textTransform: "uppercase", color: "#be3650", marginBottom: 10 }}>🛠️ Your Services</p>
                        {revenue.services.map((s, i) => (
                          <div key={i} style={{ display: "flex", gap: 10, marginBottom: 8 }}>
                            <span style={{ fontFamily: "var(--font-body)", fontSize: 16, fontWeight: 400, color: "#be3650", flexShrink: 0, lineHeight: 1.5 }}>→</span>
                            <p style={{ fontFamily: "var(--font-body)", fontSize: 16, fontWeight: 400, lineHeight: 1.5, color: "#c8c4bc", margin: 0 }}>
                              <strong style={{ fontWeight: 500, color: "#f0ede8" }}>{s.name}</strong> — {s.note}
                            </p>
                          </div>
                        ))}
                      </div>
                    )}

                    <div style={{ height: 1, background: "rgba(255,255,255,0.07)", margin: "16px 0" }} />

                    {/* Sleeping Giant */}
                    {revenue.sleepingGiant && (
                      <div style={{ marginBottom: 20 }}>
                        <p style={{ fontFamily: "var(--font-body)", fontSize: 11, fontWeight: 500, letterSpacing: "0.14em", textTransform: "uppercase", color: "#be3650", marginBottom: 10 }}>🎯 Sleeping Giant</p>
                        <p style={{ fontFamily: "var(--font-body)", fontSize: 16, fontWeight: 400, lineHeight: 1.5, color: "#c8c4bc", margin: 0 }}>{revenue.sleepingGiant}</p>
                      </div>
                    )}

                    <div style={{ height: 1, background: "rgba(255,255,255,0.07)", margin: "16px 0" }} />

                    {/* Customer FAQ */}
                    {revenue.faqs?.length > 0 && (
                      <div style={{ marginBottom: 20 }}>
                        <p style={{ fontFamily: "var(--font-body)", fontSize: 11, fontWeight: 500, letterSpacing: "0.14em", textTransform: "uppercase", color: "#be3650", marginBottom: 10 }}>❓ Customer FAQ</p>
                        {revenue.faqs.map((f, i) => (
                          <div key={i} style={{ display: "flex", gap: 10, marginBottom: 12 }}>
                            <span style={{ fontFamily: "var(--font-body)", fontSize: 16, fontWeight: 400, color: "#be3650", flexShrink: 0, lineHeight: 1.5 }}>→</span>
                            <div>
                              <p style={{ fontFamily: "var(--font-body)", fontSize: 16, fontWeight: 500, color: "#f0ede8", margin: "0 0 4px", lineHeight: 1.5 }}>{f.question}</p>
                              <p style={{ fontFamily: "var(--font-body)", fontSize: 14, fontWeight: 400, lineHeight: 1.5, color: "#f0ede8", margin: 0 }}>
                                <strong style={{ fontWeight: 500, color: "#be3650" }}>{f.answered ? "✓ Answered" : "✗ Not answered"}</strong> — {f.note}
                              </p>
                            </div>
                          </div>
                        ))}
                      </div>
                    )}

                    <div style={{ height: 1, background: "rgba(255,255,255,0.07)", margin: "16px 0" }} />

                    {/* Trends */}
                    {revenue.trends?.length > 0 && (
                      <div style={{ marginBottom: 20 }}>
                        <p style={{ fontFamily: "var(--font-body)", fontSize: 11, fontWeight: 500, letterSpacing: "0.14em", textTransform: "uppercase", color: "#be3650", marginBottom: 10 }}>📈 Industry Trends</p>
                        {revenue.trends.map((t, i) => (
                          <div key={i} style={{ display: "flex", gap: 10, marginBottom: 8 }}>
                            <span style={{ fontFamily: "var(--font-body)", fontSize: 16, fontWeight: 400, color: "#be3650", flexShrink: 0, lineHeight: 1.5 }}>→</span>
                            <p style={{ fontFamily: "var(--font-body)", fontSize: 16, fontWeight: 400, lineHeight: 1.5, color: "#c8c4bc", margin: 0 }}>
                              <strong style={{ fontWeight: 500, color: "#f0ede8" }}>{t.title}</strong> — {t.insight}
                            </p>
                          </div>
                        ))}
                      </div>
                    )}

                    <div style={{ height: 1, background: "rgba(255,255,255,0.07)", margin: "16px 0" }} />

                    {/* Competitors */}
                    {revenue.competitors?.length > 0 && (
                      <div style={{ marginBottom: 20 }}>
                        <p style={{ fontFamily: "var(--font-body)", fontSize: 11, fontWeight: 500, letterSpacing: "0.14em", textTransform: "uppercase", color: "#be3650", marginBottom: 10 }}>🏁 Competitors</p>
                        {revenue.competitors.map((c, i) => (
                          <div key={i} style={{ display: "flex", gap: 10, marginBottom: 8 }}>
                            <span style={{ fontFamily: "var(--font-body)", fontSize: 16, fontWeight: 400, color: "#be3650", flexShrink: 0, lineHeight: 1.5 }}>→</span>
                            <p style={{ fontFamily: "var(--font-body)", fontSize: 16, fontWeight: 400, lineHeight: 1.5, color: "#c8c4bc", margin: 0 }}>
                              <strong style={{ fontWeight: 500, color: "#f0ede8" }}>{c.name}</strong> — {c.win}
                            </p>
                          </div>
                        ))}
                      </div>
                    )}

                    <div style={{ height: 1, background: "rgba(255,255,255,0.07)", margin: "16px 0" }} />

                    {/* Revenue Moves */}
                    {revenue.revenueMoves?.length > 0 && (
                      <div>
                        <p style={{ fontFamily: "var(--font-body)", fontSize: 11, fontWeight: 500, letterSpacing: "0.14em", textTransform: "uppercase", color: "#be3650", marginBottom: 10 }}>💰 Revenue Moves</p>
                        {revenue.revenueMoves.map((m, i) => (
                          <div key={i} style={{ display: "flex", gap: 10, marginBottom: 12 }}>
                            <span style={{ fontFamily: "var(--font-body)", fontSize: 16, fontWeight: 400, color: "#be3650", flexShrink: 0, lineHeight: 1.5 }}>→</span>
                            <div>
                              <p style={{ fontFamily: "var(--font-body)", fontSize: 16, fontWeight: 500, color: "#f0ede8", margin: "0 0 4px", lineHeight: 1.5 }}>{m.move}</p>
                              <p style={{ fontFamily: "var(--font-body)", fontSize: 16, fontWeight: 400, lineHeight: 1.5, color: "#c8c4bc", margin: 0 }}>{m.why}</p>
                            </div>
                          </div>
                        ))}
                      </div>
                    )}

                  </div>
                )}
              </>
            )}

            {/* Coaching CTA */}
            <h3 style={{ fontFamily: "'Fraunces', Georgia, serif", fontSize: 24, fontWeight: 300, color: "#f0ede8", margin: "2rem 0 0.75rem", letterSpacing: "-0.01em" }}>Ready to Close the Gap?</h3>
            <div className="card dot-anim" style={{ background: "rgba(134,20,66,0.08)", border: "1.5px solid #861442" }}>
              <p className="card-label" style={{ color: "#861442" }}>Work with Monica</p>
              <p style={{ fontFamily: "'Plus Jakarta Sans', sans-serif", fontSize: 14, fontWeight: 300, lineHeight: 1.8, color: "#f0ede8", marginBottom: 20 }}>
                <strong style={{ fontWeight: 500 }}>Ready to build your money moves?</strong> Strategic growth planning for business owners who are done leaving money on the table. We'll map your revenue strategy and find where to use AI to close the gaps.
              </p>
              <a href="https://monicapoling.com/work-with-monica" target="_blank" rel="noopener noreferrer" className="btn-primary" style={{ display: "inline-block", textDecoration: "none" }}>Work with Monica →</a>
            </div>

            {/* Print */}
            <h3 style={{ fontFamily: "'Fraunces', Georgia, serif", fontSize: 24, fontWeight: 300, color: "#f0ede8", margin: "2rem 0 0.75rem", letterSpacing: "-0.01em" }}>Save This Brief</h3>
            <div className="card dot-anim no-print" style={{ marginTop: 0 }}>
              <p className="card-label">Print / Save This Brief</p>
              <p style={{ fontFamily: "'Plus Jakarta Sans', sans-serif", fontSize: 14, fontWeight: 300, lineHeight: 1.8, color: "#f0ede8", marginBottom: 20 }}>
                Save or print this page before you click away, or you'll lose your results.
              </p>
              <button className="btn-primary" onClick={() => window.print()}>Print / Save as PDF →</button>
              {isMonica && report && (
                <button className="btn-ghost" style={{ marginTop: 12 }}
                  onClick={() => { console.log("Money Moves Brief Data:", JSON.stringify(report, null, 2)); alert("Brief data logged to console (F12 → Console)."); }}>
                  Log Report Data →
                </button>
              )}
            </div>

          </div>
        )}

        {/* ── FOOTER ── */}
        <div className="page-footer-rule" />
        <footer className="page-footer no-print">
          <div>© 2026 Money Moves Brief &nbsp;◆&nbsp; <a href="https://dataontap.dev" target="_blank" rel="noopener noreferrer">Data on Tap</a> &nbsp;◆&nbsp; <a href="https://monicapoling.com" target="_blank" rel="noopener noreferrer">Monica Poling</a></div>
        </footer>

      </div>
    </div>
  );
}
