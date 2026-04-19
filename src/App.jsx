import { useState } from "react";

// ── LOGGER ────────────────────────────────────────────────────────────────────
const LOGGER = "https://script.google.com/macros/s/AKfycbwvztxaVKSDYhevhsjQ7LowAMvjBu4ONs2AqXytbNflmEJ_mfBF7mI54fgyhBZzhU8M/exec";

// ── SYSTEM PROMPT ─────────────────────────────────────────────────────────────
const POWER_SYSTEM_PROMPT = `You are a strategic analyst running a POWER Score — a differentiation readiness assessment built on Monica Poling's proprietary framework. Your job is to evaluate how distinctly a business is positioned to stand out and win, based entirely on what their website actually says today. Tone: direct, observational, a little dry. Like someone who's seen a thousand business websites and can spot the gap between what a business does and what it wants to be known for. Not cheerleader energy. Not consultant jargon.

MEMORY IS FORBIDDEN. Here's why this matters: the model has training data on real businesses. If you use it, the report reflects who they were, not who they are. That's not a competitive analysis — it's a rumor. Use only what you fetch.

REQUIRED FETCH SEQUENCE — follow exactly:
1. Use web_search to fetch the EXACT URL provided.
2. Read the full returned content.
3. If content is empty or an error, try in order:
   - Add or remove trailing slash
   - Add or remove "www."
   - Try the root domain if a subpage was given
4. Before writing a single word, extract at least 5 specific details from the live page: exact phrases, services listed, people named, CTAs used, page sections. If you can't find 5, the fetch failed.
5. Build the entire report from those fetched details only. Every sentence must be grounded in what you read.

If you cannot fetch real content after 3 attempts: set fetchSuccess to false, explain in fetchNote, score conservatively (8/20 max per dimension).

SCORING RUBRIC (internal only):
18-20: Exceptional | 14-17: Strong with gaps | 10-13: Present but underdeveloped | 6-9: Weak signal | 0-5: Missing or unclear

Return ONLY valid JSON. No markdown, no preamble, no backticks, no citation tags, no XML.

JSON Schema:
{
  "businessName": "string",
  "dateGenerated": "Month YYYY",
  "overallScore": <integer 0-100, sum of five dimension scores>,

  "orgParagraph": "2-3 sentences, 60 words max. Name the business, what they do, one specific thing worth paying attention to. Introduce them like you're telling a smart friend about them. Fetched content only.",

  "scoreParagraph": "2-3 sentences, 60 words max. Sharp one-liner on where they stand, then what's working and what's costing them differentiation. No generics. Fetched content only.",

  "brandPersonality": "2-3 sentences, 60 words max. Start with the business name. What personality comes through, and where does it contradict itself or go flat. Fetched content only.",

  "prestige": { "score": "0-20", "content": "2-3 sentences, 65 words max. Do they own a category or a point of view? Look for: positioning language, niche clarity, whether they've named what they do in a way nobody else would. What's on the page and what's missing." },

  "origin": { "score": "0-20", "content": "2-3 sentences, 65 words max. Is there a story that explains why this business exists? Look for: founder backstory, the problem that started it, anything that makes the origin feel specific and human rather than corporate boilerplate." },

  "wow": { "score": "0-20", "content": "2-3 sentences, 65 words max. What's the thing that makes you stop scrolling? Look for: a bold claim, an unexpected differentiator, proof of something remarkable, or the conspicuous absence of any of that." },

  "expertise": { "score": "0-20", "content": "2-3 sentences, 65 words max. Does the site demonstrate mastery or just assert it? Look for: specific credentials, named frameworks, depth of content, evidence that this business has earned its authority." },

  "reputation": { "score": "0-20", "content": "2-3 sentences, 65 words max. Are others vouching for this business, or is it all self-reported? Look for: testimonials, press, partnerships, social proof — and whether it's specific or generic." },

  "sleepingGiant": "2-3 sentences, 65 words max. The single highest-leverage opportunity hiding in plain sight on their site. Not generic advice — something specific to what you read. The thing they're closest to doing right that would move the needle most if they leaned into it.",

  "mockup": {
    "heroHeadline": "A rewritten hero headline for their site based on the POWER analysis — outcome-focused, specific, under 12 words.",
    "heroSub": "A rewritten hero subheadline, 20-30 words. Answers the buyer question their current site doesn't.",
    "heroCta": "A rewritten CTA button label, 3-6 words.",
    "currentHeroNote": "One sentence: what their current hero says and why it's costing them.",
    "originStory": "A 2-sentence founder/origin statement written as if for their About section. Specific to what you read.",
    "originNote": "One sentence: where the origin story currently lives (or doesn't) and what that costs them.",
    "proofPoints": [
      { "label": "string", "text": "string", "missing": true, "missingNote": "string" }
    ],
    "gapLine": "One sharp sentence summarizing the single biggest gap between what the site says and what buyers need to hear."
  },

  "urlsAttempted": ["https://example.com"],
  "fetchSuccess": true,
  "fetchNote": "Optional — only if fetch issues or sparse content."
}

overallScore = sum of five scores (each /20, total /100).
90-100: Category Leader | 75-89: Strong Foundation, Underloaded Story | 60-74: Solid Presence, Clear Gaps | 45-59: Underdeveloped Positioning | Below 45: Significant Opportunity

For mockup.proofPoints: return exactly 4 items using whatever proof signals exist. Set missing:true if the signal exists but is buried or absent from the homepage. Include missingNote only when missing:true.`;

// ── HELPERS ───────────────────────────────────────────────────────────────────
function normalizeUrl(input) {
  let url = input.trim();
  if (!url) return url;
  if (!/^https?:\/\//i.test(url)) url = "https://" + url;
  return url.replace(/\/+$/, "");
}

async function callAPI(system, messages) {
  const body = { model: "claude-sonnet-4-6", max_tokens: 3000, system, messages,
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
  return callAPI(POWER_SYSTEM_PROMPT, [{
    role: "user",
    content: `You MUST use the web_search tool to fetch and read the LIVE website right now. Do not use memory.

REQUIRED SEQUENCE — follow exactly:
1. Use web_search to fetch: ${url}
2. Read the FULL returned content carefully.
3. If content is empty or an error, try these in order:
   - ${url}/
   - ${url.replace(/^https:\/\//, "https://www.")}
   - ${url.replace(/^https:\/\/www\./, "https://")}
4. Before writing the report, list internally 5+ SPECIFIC details from the page you just read. These details MUST appear in your report.
5. Write the report using ONLY those fetched details.

WARNING: Training memory is FORBIDDEN. Only what is on the page TODAY counts.

Record every URL attempted in urlsAttempted. If you truly cannot fetch content after all attempts, set fetchSuccess to false, explain in fetchNote, and score conservatively (8/20 max per dimension). Return the full JSON.`
  }]);
}

// ── CONSTANTS ─────────────────────────────────────────────────────────────────
const POWER_SECTIONS = [
  { key: "prestige",   letter: "P", label: "Prestige",   sub: "Do You Own Your Category?" },
  { key: "origin",     letter: "O", label: "Ownership",  sub: "What's Your Origin Story?" },
  { key: "wow",        letter: "W", label: "Wow Factor", sub: "What Makes You Unforgettable?" },
  { key: "expertise",  letter: "E", label: "Expertise",  sub: "Do You Demonstrate Clear Expertise?" },
  { key: "reputation", letter: "R", label: "Reputation", sub: "Are You the Voice of Your Industry?" },
];

const LOAD_STEPS = [
  "Pulling up your site...",
  "Wow! This is great stuff...",
  "Evaluating your P·O·W·E·R...",
  "Personality, deconstructed...",
  "Love what you're doing...",
  "Calculating your POWER Score...",
];

// ── SUB-COMPONENTS ────────────────────────────────────────────────────────────
function PulseLoader({ text }) {
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 10, padding: "4px 0" }}>
      <span style={{ width: 5, height: 5, borderRadius: "50%", background: "#861442",
        display: "inline-block", animation: "kot-pulse 1.2s ease-in-out infinite", flexShrink: 0 }} />
      <span style={{ fontSize: 14, color: "#f0ede8", fontStyle: "italic", fontWeight: 300, opacity: 0.6 }}>{text}</span>
    </div>
  );
}

function ScoreBar({ score, max }) {
  const pct = Math.round((Math.min(score, max) / max) * 100);
  return (
    <div style={{ background: "#f0ede8", borderRadius: 2, height: 3, overflow: "hidden" }}>
      <div style={{ height: "100%", width: `${pct}%`, background: "#861442", borderRadius: 2, animation: "kot-bar 1.2s ease forwards" }} />
    </div>
  );
}

function MissingBadge({ note }) {
  return (
    <div style={{ display: "inline-flex", alignItems: "center", gap: 4, background: "rgba(192,112,90,0.12)",
      border: "1px solid rgba(192,112,90,0.25)", borderRadius: 4, padding: "2px 7px",
      fontSize: 10, color: "#c0705a", fontWeight: 500, marginTop: 7 }}>
      ⚠ {note || "Not on homepage"}
    </div>
  );
}

function GapNote({ children }) {
  return (
    <div style={{ fontSize: 11, fontWeight: 300, color: "#5a5a56", lineHeight: 1.6, margin: "10px 0 0",
      padding: "8px 10px", background: "rgba(255,255,255,0.03)", borderLeft: "2px solid #861442", borderRadius: "0 4px 4px 0" }}>
      <strong style={{ color: "#be3650", fontWeight: 500 }}>What's missing now: </strong>{children}
    </div>
  );
}

function WebsiteMockup({ mockup, businessName, url }) {
  if (!mockup) return null;
  const domain = (() => { try { return new URL(normalizeUrl(url)).hostname; } catch { return url; } })();
  return (
    <div style={{ background: "#1a1a18", borderRadius: 12, overflow: "hidden",
      fontFamily: "'Plus Jakarta Sans', sans-serif", border: "1px solid rgba(255,255,255,0.08)" }}>

      {/* Intro */}
      <div style={{ background: "#111110", padding: "1.5rem", borderBottom: "1px solid rgba(255,255,255,0.06)" }}>
        <div style={{ fontSize: 11, fontWeight: 500, letterSpacing: ".14em", textTransform: "uppercase", color: "#be3650", marginBottom: 6 }}>Your Site Through a Buyer's Eyes</div>
        <p style={{ fontSize: 13, fontWeight: 300, color: "rgba(255,255,255,0.6)", lineHeight: 1.7, margin: 0 }}>
          This is what <strong style={{ color: "#f0ede8", fontWeight: 500 }}>{businessName}'s</strong> website{" "}
          <strong style={{ color: "#f0ede8", fontWeight: 500 }}>could say</strong> if your POWER score variables were doing the work. The gaps are where your score is being lost.
        </p>
      </div>

      {/* Browser bar */}
      <div style={{ background: "#0d0d0c", padding: "8px 14px", display: "flex", alignItems: "center", gap: 8, borderBottom: "1px solid rgba(255,255,255,0.06)" }}>
        <div style={{ display: "flex", gap: 5 }}>
          <div style={{ width: 9, height: 9, borderRadius: "50%", background: "#c0705a" }} />
          <div style={{ width: 9, height: 9, borderRadius: "50%", background: "#8a8a84" }} />
          <div style={{ width: 9, height: 9, borderRadius: "50%", background: "#4caf8a" }} />
        </div>
        <div style={{ flex: 1, background: "rgba(255,255,255,0.06)", borderRadius: 5, padding: "4px 10px", fontSize: 11, color: "#5a5a56", fontFamily: "monospace" }}>{domain}</div>
      </div>

      {/* Hero section */}
      <div style={{ padding: "1.25rem 1.5rem", borderBottom: "1px solid rgba(255,255,255,0.06)" }}>
        <div style={{ fontSize: 10, fontWeight: 500, letterSpacing: ".14em", textTransform: "uppercase", color: "#5a5a56", marginBottom: 10, display: "flex", alignItems: "center", gap: 6 }}>
          Hero Section <span style={{ background: "#861442", color: "#fff", fontSize: 9, padding: "2px 6px", borderRadius: 3, letterSpacing: ".08em" }}>PRESTIGE + WOW</span>
        </div>
        {mockup.currentHeroNote && (
          <div style={{ display: "inline-flex", alignItems: "center", gap: 6, background: "rgba(190,54,80,0.12)",
            border: "1px solid rgba(190,54,80,0.25)", borderRadius: 6, padding: "4px 10px",
            fontSize: 11, color: "#be3650", fontWeight: 500, marginBottom: 10 }}>
            <div style={{ width: 6, height: 6, borderRadius: "50%", background: "#be3650" }} />
            Currently: {mockup.currentHeroNote}
          </div>
        )}
        <div style={{ fontFamily: "'Fraunces',Georgia,serif", fontSize: "clamp(18px,3vw,26px)", fontWeight: 600,
          color: "#f0ede8", lineHeight: 1.3, margin: "0 0 8px" }}>{mockup.heroHeadline}</div>
        <div style={{ fontSize: 13, fontWeight: 300, color: "rgba(255,255,255,0.55)", lineHeight: 1.7, margin: "0 0 14px", maxWidth: 520 }}>{mockup.heroSub}</div>
        <div style={{ display: "inline-block", background: "#861442", color: "#fff", fontSize: 12, fontWeight: 500, padding: "8px 18px 10px", borderRadius: 8 }}>{mockup.heroCta}</div>
      </div>

      {/* Origin */}
      {mockup.originStory && (
        <div style={{ padding: "1.25rem 1.5rem", borderBottom: "1px solid rgba(255,255,255,0.06)" }}>
          <div style={{ fontSize: 10, fontWeight: 500, letterSpacing: ".14em", textTransform: "uppercase", color: "#5a5a56", marginBottom: 10, display: "flex", alignItems: "center", gap: 6 }}>
            About / Origin <span style={{ background: "#861442", color: "#fff", fontSize: 9, padding: "2px 6px", borderRadius: 3, letterSpacing: ".08em" }}>OWNERSHIP</span>
          </div>
          <div style={{ background: "#242422", border: "1px solid rgba(255,255,255,0.08)", borderRadius: 8, padding: 14, display: "flex", gap: 12 }}>
            <div style={{ width: 38, height: 38, borderRadius: "50%", background: "#861442", flexShrink: 0,
              display: "flex", alignItems: "center", justifyContent: "center",
              fontFamily: "'Fraunces',Georgia,serif", fontSize: 14, color: "#fff", fontStyle: "italic" }}>
              {businessName?.[0] || "B"}
            </div>
            <div>
              <p style={{ fontSize: 12, fontWeight: 300, color: "rgba(255,255,255,0.65)", lineHeight: 1.65, margin: 0 }}>{mockup.originStory}</p>
              <p style={{ fontSize: 11, fontWeight: 500, color: "#be3650", margin: "6px 0 0" }}>{businessName}</p>
            </div>
          </div>
          {mockup.originNote && <GapNote>{mockup.originNote}</GapNote>}
        </div>
      )}

      {/* Proof points */}
      {mockup.proofPoints?.length > 0 && (
        <div style={{ padding: "1.25rem 1.5rem", borderBottom: "1px solid rgba(255,255,255,0.06)" }}>
          <div style={{ fontSize: 10, fontWeight: 500, letterSpacing: ".14em", textTransform: "uppercase", color: "#5a5a56", marginBottom: 10, display: "flex", alignItems: "center", gap: 6 }}>
            Proof / Reputation <span style={{ background: "#861442", color: "#fff", fontSize: 9, padding: "2px 6px", borderRadius: 3, letterSpacing: ".08em" }}>REPUTATION</span>
          </div>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
            {mockup.proofPoints.map((pt, i) => (
              <div key={i} style={{ background: "#242422", border: "1px solid rgba(255,255,255,0.08)", borderRadius: 8, padding: 12 }}>
                <div style={{ fontSize: 10, fontWeight: 500, letterSpacing: ".12em", textTransform: "uppercase", color: "#be3650", margin: "0 0 5px" }}>{pt.label}</div>
                <p style={{ fontSize: 12, fontWeight: 300, color: "rgba(255,255,255,0.65)", lineHeight: 1.6, margin: 0 }}>{pt.text}</p>
                {pt.missing && pt.missingNote && <MissingBadge note={pt.missingNote} />}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Gap line */}
      {mockup.gapLine && (
        <div style={{ padding: "1rem 1.5rem", background: "#111110", borderTop: "1px solid rgba(255,255,255,0.06)" }}>
          <div style={{ fontSize: 11, fontWeight: 500, letterSpacing: ".14em", textTransform: "uppercase", color: "#be3650", marginBottom: 4 }}>The gap in one line</div>
          <p style={{ fontSize: 13, fontWeight: 300, color: "rgba(255,255,255,0.5)", lineHeight: 1.7, margin: 0 }}>{mockup.gapLine}</p>
        </div>
      )}
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

  const [newsletterEmail, setNewsletterEmail] = useState("");
  const [newsletterFirstName, setNewsletterFirstName] = useState("");
  const [newsletterSubmitted, setNewsletterSubmitted] = useState(false);

  const isMonica = new URLSearchParams(window.location.search).has("monica");
  const sc = report?.overallScore || 0;

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
      document.title = `POWER Score — ${result.businessName}`;
      const now = new Date();
      const humanTime = now.toLocaleString("en-US", { month: "long", day: "numeric", year: "numeric", hour: "numeric", minute: "2-digit", hour12: true });
      fetch(LOGGER, {
        method: "POST", mode: "no-cors",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ timestamp: humanTime, event: "report_run", app: "PWR Score", url: url.trim(), score: result.overallScore || "", firstName: "", email: "", subscribe: "" }),
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
        body: JSON.stringify({ timestamp: humanTime, event: "email_submit", app: "PWR Score", url: url.trim(), score: report?.overallScore || "", firstName: firstName.trim(), email: email.trim(), subscribe: emailSubscribe ? "yes" : "no" }),
      });
      setEmailSubmitted(true);
    } catch {
      setEmailError("Something went wrong. Please try again.");
    } finally {
      setEmailSubmitting(false);
    }
  };

  const handleNewsletterSubmit = async () => {
    if (!newsletterEmail.trim()) return;
    try {
      const now = new Date();
      const humanTime = now.toLocaleString("en-US", { month: "long", day: "numeric", year: "numeric", hour: "numeric", minute: "2-digit", hour12: true });
      await fetch(LOGGER, {
        method: "POST", mode: "no-cors",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ timestamp: humanTime, event: "newsletter_footer_submit", app: "PWR Score", url: url.trim(), score: report?.overallScore || "", firstName: newsletterFirstName.trim(), email: newsletterEmail.trim(), subscribe: "yes" }),
      });
      setNewsletterSubmitted(true);
    } catch { /* silent */ }
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
        @keyframes kot-pulse { 0%,100%{opacity:.25;transform:scale(1)} 50%{opacity:1;transform:scale(1.5)} }
        @keyframes kot-bar { from { width: 0 } }
        @keyframes fadeUp { from { opacity:0; transform:translateY(12px) } to { opacity:1; transform:translateY(0) } }
        .kot-anim { animation: fadeUp 0.5s ease both; }

        .kot-hero { width: 100%; background: #111110; display: flex; align-items: stretch; min-height: 220px; max-height: 280px; }
        .kot-hero-left { flex: 3; padding: 2rem clamp(16px,4vw,2rem); display: flex; flex-direction: column; justify-content: center; gap: 14px; }
        .kot-hero-logo { display: flex; align-items: center; gap: 14px; }
        .kot-hero-title { font-family: var(--font-display); font-size: clamp(36px,6vw,52px); color: #f0ede8; line-height: 1; letter-spacing: -0.02em; }
        .kot-hero-title strong { font-weight: 600; color: #f0ede8; }
        .kot-hero-title em { font-weight: 300; font-style: italic; color: #be3650; }
        .kot-hero-sub { font-family: var(--font-body); font-size: 14px; font-weight: 300; line-height: 1.4; color: var(--muted); max-width: 520px; }
        .kot-hero-right { flex: 0 0 230px; min-width: 200px; max-width: 230px; position: relative; overflow: hidden; background: #1a1a18; }
        .kot-hero-right img { width: 100%; height: 100%; object-fit: cover; object-position: center top; display: block; }
        .kot-hero-right-placeholder { width: 100%; height: 100%; background: #1a1a18; border-left: 1px solid rgba(255,255,255,0.06); }

        .kot-dim-bar { background: #111110; display: flex; align-items: center; border-bottom: 1px solid rgba(255,255,255,0.06); }
        .kot-dim-col { flex: 1; text-align: center; padding: 10px 4px; font-family: var(--font-body); font-size: 10px; font-weight: 500; letter-spacing: 0.12em; text-transform: uppercase; color: #f0ede8; }
        .kot-dim-pipe { width: 1px; height: 18px; background: rgba(255,255,255,0.12); flex-shrink: 0; }

        @media (max-width: 500px) { .kot-hero-right { display: none; } }

        .page-footer-rule { width: 100%; height: 1.5px; background: rgba(134,20,66,0.5); margin: 1.75rem 0 0; }

        .kot-section-header { background: #1a1a18; padding: 1.75rem clamp(16px,4vw,2rem) 0.75rem; }
        .kot-section-header h2 { font-family: var(--font-display); font-size: 24px; font-weight: 300; color: #f0ede8; margin: 0; letter-spacing: -0.01em; }
        .kot-section-header h2 .power-word { font-weight: 600; color: #f0ede8; }
        .kot-section-header h2 .score-word { font-weight: 300; font-style: italic; color: #be3650; }

        .kot-input-zone { background: #1a1a18; padding: 1rem clamp(16px,4vw,2rem) 1.75rem; border-bottom: 1px solid rgba(255,255,255,0.06); }
        .kot-input-row { display: flex; gap: 10px; flex-wrap: wrap; }
        .kot-input-field { flex: 1; min-width: 200px; padding: 10px 14px; background: #111110; border: 1px solid rgba(255,255,255,0.4); border-radius: var(--radius); color: #f0ede8; -webkit-text-fill-color: #f0ede8; font-family: var(--font-body); font-size: 14px; font-weight: 300; outline: none; transition: border-color 0.2s; }
        .kot-input-field:focus { border-color: #861442; }
        .kot-input-field::placeholder { color: #5a5a56; opacity: 1; }

        .btn-primary { background: #861442 !important; color: #ffffff !important; border: none; font-family: var(--font-body); font-size: 13px; font-weight: 500; padding: 10px 22px; border-radius: var(--radius); cursor: pointer; letter-spacing: 0.04em; transition: opacity 0.15s, transform 0.1s; white-space: nowrap; }
        .btn-primary:hover { opacity: 0.88; }
        .btn-primary:active { transform: scale(0.97); }
        .btn-primary:disabled { opacity: 0.35; cursor: not-allowed; }
        .btn-ghost { background: transparent; color: var(--text); border: 1px solid var(--border2); font-family: var(--font-body); font-size: 13px; padding: 10px 18px; border-radius: var(--radius); cursor: pointer; transition: color 0.15s, border-color 0.15s; }
        .btn-ghost:hover { color: #be3650; border-color: #be3650; }

        .kot-report-zone { background: var(--bg); padding: 0 clamp(16px,4vw,2rem) 80px; }
        .kot-report-head { padding: 36px 0 24px; border-bottom: 1px solid var(--border); }
        .kot-report-name { font-family: var(--font-display); font-weight: 300; font-size: clamp(22px,4vw,36px); letter-spacing: -0.02em; color: var(--text); margin-bottom: 6px; line-height: 1.1; }
        .kot-report-date { font-family: var(--font-body); font-size: 12px; letter-spacing: 0.12em; text-transform: uppercase; color: #be3650; }

        .card { background: var(--surface); border: 1px solid var(--border); border-radius: var(--radius); padding: clamp(18px,4vw,24px) clamp(18px,4vw,28px); margin-bottom: 14px; }
        .card-label { font-family: var(--font-body); font-size: 12px; letter-spacing: 0.14em; text-transform: uppercase; color: #be3650; margin-bottom: 14px; }
        .card-body { font-family: var(--font-body); font-size: 14px; font-weight: 300; line-height: 1.8; color: #f0ede8; }

        .kot-score-num { font-family: var(--font-display); font-weight: 300; font-style: italic; font-size: clamp(72px,13vw,108px); line-height: 1; letter-spacing: -0.04em; color: #861442 !important; }
        .kot-score-den { font-family: var(--font-display); font-size: 22px; font-weight: 300; color: #f0ede8; padding-bottom: 8px; }

        .power-row { padding: 18px 0; border-bottom: 1px solid var(--border); }
        .power-row:first-child { padding-top: 0; }
        .power-row:last-child { border-bottom: none; padding-bottom: 0; }
        .power-meta { display: flex; align-items: baseline; justify-content: space-between; gap: 12px; margin-bottom: 8px; }
        .power-title { font-family: var(--font-body); font-size: 14px; font-weight: 500; color: #f0ede8; }
        .power-letter { color: #be3650; margin-right: 4px; }
        .power-score-val { font-family: var(--font-body); font-size: 14px; font-weight: 500; color: var(--muted); white-space: nowrap; }
        .power-content { font-family: var(--font-body); font-size: 14px; font-weight: 300; line-height: 1.8; color: #f0ede8; margin-top: 10px; }

        .kot-field { width: 100%; padding: 10px 14px; background: #111110 !important; border: 1px solid rgba(255,255,255,0.4); border-radius: var(--radius); color: #f0ede8 !important; font-family: var(--font-body); font-size: 14px; font-weight: 300; outline: none; transition: border-color 0.2s; -webkit-text-fill-color: #f0ede8 !important; caret-color: #f0ede8; }
        .kot-field:focus { border-color: #861442; background: #111110 !important; }
        .kot-field::placeholder { color: #5a5a56; opacity: 1; }
        .kot-field:-webkit-autofill,
        .kot-field:-webkit-autofill:hover,
        .kot-field:-webkit-autofill:focus { -webkit-box-shadow: 0 0 0 1000px #111110 inset !important; -webkit-text-fill-color: #f0ede8 !important; caret-color: #f0ede8; border-color: #861442; }

        .kot-debug-pre { padding: 14px; background: var(--surface2); border: 1px solid var(--border); border-radius: 6px; color: var(--muted); font-size: 12px; white-space: pre-wrap; word-break: break-word; line-height: 1.6; font-family: var(--font-body); margin-top: 8px; }

        .page-footer { background: #111110; padding: 1.25rem clamp(16px,4vw,2rem); font-family: var(--font-body); font-size: 11px; font-weight: 400; color: rgba(255,255,255,0.25); text-align: left; line-height: 1.8; }
        .page-footer a { color: rgba(255,255,255,0.3); text-decoration: none; }
        .page-footer a:hover { color: #be3650; }

        @media print {
          .no-print { display: none !important; }
          body { background: #fff !important; color: #000 !important; }
          * { -webkit-print-color-adjust: exact; print-color-adjust: exact; }
          h3 { margin: 0.75rem 0 0.35rem !important; font-size: 18px !important; color: #000 !important; }
          .card { background: #f7f7f7 !important; border: 1px solid #ddd !important; padding: 10px 14px !important; margin-bottom: 6px !important; }
          .card-label { margin-bottom: 8px !important; color: #861442 !important; }
          .card-body { color: #111 !important; line-height: 1.5 !important; }
          .kot-report-head { padding: 12px 0 10px !important; border-bottom: 1px solid #ddd !important; }
          .kot-report-name { font-size: 22px !important; color: #000 !important; }
          .kot-report-date { color: #861442 !important; }
          .kot-score-num { font-size: 48px !important; color: #861442 !important; }
          .kot-score-den { color: #444 !important; }
          .power-row { padding: 10px 0 !important; border-bottom: 1px solid #eee !important; }
          .power-title { color: #000 !important; }
          .power-letter { color: #861442 !important; }
          .power-score-val { color: #444 !important; }
          .power-content { color: #111 !important; line-height: 1.5 !important; }
          .kot-report-zone { padding-bottom: 20px !important; background: #fff !important; }
          .kot-dim-bar { background: #f0f0f0 !important; border-bottom: 1px solid #ddd !important; }
          .kot-dim-col { color: #000 !important; }
        }
        @media (max-width: 600px) {
          .kot-input-row { flex-direction: column; }
        }
      `}</style>

      <div style={{ maxWidth: 860, margin: "0 auto", overflow: "hidden" }}>

        {/* SEO hidden h1 */}
        <h1 style={{ position: "absolute", width: 1, height: 1, padding: 0, margin: -1, overflow: "hidden", clip: "rect(0,0,0,0)", whiteSpace: "nowrap", border: 0 }}>
          POWER Score — Free Competitive Analysis Tool | Data on Tap
        </h1>

        {/* ── HERO ── */}
        <div className="kot-hero no-print">
          <div className="kot-hero-left">
            <div className="kot-hero-logo">
              <div style={{ flexShrink: 0, lineHeight: 0 }}>
                <svg width="36" height="36" viewBox="0 0 54 54" fill="none">
                  <rect x="0"  y="0"  width="24" height="24" fill="#861442"/>
                  <rect x="30" y="0"  width="24" height="24" fill="#ffffff" opacity="0.6"/>
                  <rect x="0"  y="30" width="24" height="24" fill="#ffffff" opacity="0.25"/>
                  <rect x="30" y="30" width="24" height="24" fill="#861442" opacity="0.25"/>
                </svg>
              </div>
              <div className="kot-hero-title"><strong>POWER</strong> <em>Score</em></div>
            </div>
            <div className="kot-hero-sub" style={{ lineHeight: 1.4 }}>
              <p style={{ marginBottom: "0.5rem", fontWeight: 500, color: "#f0ede8" }}>Is your website working as hard as you do?</p>
              <p>Your website should make people want to work with you — not just tell them what you do. The POWER Score is an AI-generated competitive analysis — a deep dive into your website to help you identify the bragging points you might be overlooking.</p>
            </div>
          </div>
          <div className="kot-hero-right">
            <img src="/power-score-hero.png" alt="POWER Score" />
          </div>
        </div>

        <div className="page-footer-rule no-print" />

        <div className="kot-dim-bar no-print">
          <div className="kot-dim-col">Prestige</div>
          <div className="kot-dim-pipe" />
          <div className="kot-dim-col">Ownership</div>
          <div className="kot-dim-pipe" />
          <div className="kot-dim-col">Wow Factor</div>
          <div className="kot-dim-pipe" />
          <div className="kot-dim-col">Expertise</div>
          <div className="kot-dim-pipe" />
          <div className="kot-dim-col">Reputation</div>
        </div>

        <div className="page-footer-rule no-print" />

        <div className="kot-section-header no-print">
          <h2><span style={{ color: "#be3650" }}>Get Your</span> <span className="power-word">POWER</span> <span className="score-word">Score</span></h2>
        </div>

        {/* ── INPUT ZONE ── */}
        <div className="kot-input-zone no-print">
          <div className="kot-input-row">
            <input
              type="url"
              value={url}
              onChange={(e) => setUrl(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && !loading && handleGenerate()}
              placeholder="Enter your business URL"
              className="kot-input-field"
            />
            <button className="btn-primary" onClick={handleGenerate} disabled={loading || !url.trim()}>
              {loading ? "Analyzing..." : "Get My Score →"}
            </button>
          </div>
          {loading && <div style={{ marginTop: 18 }}><PulseLoader text={progress} /></div>}
          {error && (
            <div style={{ marginTop: 16 }}>
              <p style={{ color: "#c0705a", fontSize: 13, fontFamily: "'Plus Jakarta Sans',sans-serif", marginBottom: 8 }}>{error}</p>
              {debugInfo && (
                <>
                  <button className="btn-ghost" onClick={() => setDebugOpen(o => !o)} style={{ fontSize: 12, padding: "5px 12px" }}>
                    {debugOpen ? "Hide" : "Show"} debug info
                  </button>
                  {debugOpen && <pre className="kot-debug-pre">{debugInfo}</pre>}
                </>
              )}
            </div>
          )}
        </div>

        {/* ── REPORT ── */}
        {report && (
          <div className="kot-report-zone" style={{ animation: "fadeUp 0.5s ease both" }}>
            <div className="page-footer-rule" style={{ margin: "0" }} />
            <div className="kot-report-head kot-anim">
              <h2 className="kot-report-name">{report.businessName}</h2>
              <p className="kot-report-date">➜ {report.dateGenerated}</p>
            </div>

            {/* Debug (Monica only) */}
            {isMonica && debugInfo && (
              <div style={{ marginTop: 16 }}>
                <button className="btn-ghost" style={{ fontSize: 11, padding: "6px 12px" }} onClick={() => setDebugOpen(!debugOpen)}>
                  {debugOpen ? "Hide" : "Show"} Fetch Debug
                </button>
                {debugOpen && <pre className="kot-debug-pre">{debugInfo}</pre>}
              </div>
            )}

            {/* Score */}
            <h3 style={{ fontFamily: "'Fraunces', Georgia, serif", fontSize: 24, fontWeight: 300, color: "#f0ede8", margin: "2rem 0 0.75rem", letterSpacing: "-0.01em" }}>Your POWER Score</h3>
            <div className="card kot-anim" style={{ animationDelay: "0.05s" }}>
              <p className="card-label">Your POWER Score</p>
              <div style={{ display: "flex", alignItems: "baseline", gap: 6, marginBottom: 8 }}>
                <span className="kot-score-num">{sc}</span>
                <span className="kot-score-den">/100</span>
              </div>
              <div style={{ background: "#f0ede8", borderRadius: 2, height: 3, overflow: "hidden" }}>
                <div style={{ height: "100%", width: `${sc}%`, background: "#861442", borderRadius: 2, animation: "kot-bar 1.2s ease forwards" }} />
              </div>
            </div>

            {/* About */}
            <h3 style={{ fontFamily: "'Fraunces', Georgia, serif", fontSize: 24, fontWeight: 300, color: "#f0ede8", margin: "2rem 0 0.75rem", letterSpacing: "-0.01em" }}>About {report.businessName}</h3>
            <div className="card kot-anim" style={{ animationDelay: "0.1s" }}>
              <p className="card-label">About {report.businessName}</p>
              <p className="card-body">{report.orgParagraph}</p>
              {report.brandPersonality && (
                <>
                  <div style={{ height: 1, background: "rgba(255,255,255,0.07)", margin: "20px 0" }} />
                  <p className="card-label">Brand Personality</p>
                  <p className="card-body">{report.brandPersonality}</p>
                </>
              )}
              <div style={{ height: 1, background: "rgba(255,255,255,0.07)", margin: "20px 0" }} />
              <p className="card-label">About Your Score</p>
              <p className="card-body">{report.scoreParagraph}</p>
            </div>

            {/* POWER Breakdown */}
            <h3 style={{ fontFamily: "'Fraunces', Georgia, serif", fontSize: 24, fontWeight: 300, color: "#f0ede8", margin: "2rem 0 0.75rem", letterSpacing: "-0.01em" }}>P·O·W·E·R Score Breakdown</h3>
            <div className="card kot-anim" style={{ animationDelay: "0.15s" }}>
              <p className="card-label">P·O·W·E·R Score Breakdown</p>
              {POWER_SECTIONS.map(({ key, letter, label, sub }) => {
                const section = report[key];
                if (!section) return null;
                return (
                  <div key={key} className="power-row">
                    <div className="power-meta">
                      <span className="power-title"><span className="power-letter">{letter}</span>— {label}: {sub}</span>
                      <span className="power-score-val">{section.score}/20</span>
                    </div>
                    <ScoreBar score={section.score} max={20} />
                    <p className="power-content">{section.content}</p>
                  </div>
                );
              })}
            </div>

            {/* ── EMAIL GATE ── */}
            <h3 style={{ fontFamily: "'Fraunces', Georgia, serif", fontSize: 24, fontWeight: 300, color: "#f0ede8", margin: "2rem 0 0.75rem", letterSpacing: "-0.01em" }}>Unlock Your Full Report</h3>

            {!emailSubmitted ? (
              <div className="kot-anim no-print" style={{ animationDelay: "0.35s", background: "#1e1c1b", border: "1px solid rgba(134,20,66,0.35)", borderRadius: "var(--radius)", padding: "clamp(18px,4vw,24px) clamp(18px,4vw,28px)", marginBottom: 14 }}>
                <p className="card-label">Unlock Your Full Report</p>
                <p style={{ fontFamily: "'Plus Jakarta Sans', sans-serif", fontSize: 14, fontWeight: 300, lineHeight: 1.8, color: "#f0ede8", marginBottom: 16 }}>
                  Drop your name and email to unlock the rest of your report:
                </p>
                <div style={{ display: "flex", flexDirection: "column", gap: 8, marginBottom: 20 }}>
                  {["Your Sleeping Giant opportunity", "Your site through a buyer's eyes — with rewrites"].map((item) => (
                    <div key={item} style={{ display: "flex", alignItems: "center", gap: 10 }}>
                      <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
                        <circle cx="8" cy="8" r="8" fill="#2a5c3f"/>
                        <polyline points="4,8 7,11 12,5" stroke="#4caf8a" strokeWidth="1.5" fill="none" strokeLinecap="round" strokeLinejoin="round"/>
                      </svg>
                      <span style={{ fontFamily: "'Plus Jakarta Sans',sans-serif", fontSize: 14, fontWeight: 300, color: "#f0ede8" }}>{item}</span>
                    </div>
                  ))}
                </div>
                <div style={{ display: "flex", gap: 10, flexWrap: "wrap", marginBottom: 16 }}>
                  <input type="text" value={firstName} onChange={(e) => setFirstName(e.target.value)}
                    placeholder="First name" className="kot-field" style={{ flex: 1, minWidth: 140 }} />
                  <input type="email" value={email} onChange={(e) => setEmail(e.target.value)}
                    onKeyDown={(e) => e.key === "Enter" && handleEmailSubmit()}
                    placeholder="Email address" className="kot-field" style={{ flex: 2, minWidth: 200 }} />
                </div>
                {emailError && <p style={{ fontFamily: "'Plus Jakarta Sans',sans-serif", fontSize: 13, color: "#c0705a", marginBottom: 10 }}>{emailError}</p>}
                <label style={{ display: "flex", alignItems: "center", gap: 6, cursor: "pointer", fontSize: 11, fontWeight: 300, color: "#f0ede8", marginBottom: 12 }}>
                  <input type="checkbox" checked={emailSubscribe} onChange={(e) => setEmailSubscribe(e.target.checked)}
                    style={{ accentColor: "#861442", width: 13, height: 13, cursor: "pointer" }} />
                  Yes, add me to Let's Make Some Noise
                </label>
                <button className="btn-primary" onClick={handleEmailSubmit}
                  disabled={emailSubmitting || !email.trim() || !firstName.trim()}
                  style={{ marginBottom: 12 }}>
                  {emailSubmitting ? "Sending..." : "Unlock My Full Report →"}
                </button>
                <p style={{ fontFamily: "'Plus Jakarta Sans',sans-serif", fontSize: 11, color: "#5a5a56", lineHeight: 1.6 }}>
                  By submitting, you understand you'll be subscribed to the Let's Make Some Noise newsletter. You may unsubscribe any time.
                </p>
              </div>
            ) : (
              <p style={{ fontFamily: "'Plus Jakarta Sans',sans-serif", fontSize: 13, color: "#4caf8a", marginBottom: 14 }}>
                ✓ Report unlocked — your full intel is below.
              </p>
            )}

            {/* ── BUCKET 2 ── */}
            {emailSubmitted && (
              <>
                {report.sleepingGiant && (
                  <>
                    <h3 style={{ fontFamily: "'Fraunces', Georgia, serif", fontSize: 24, fontWeight: 300, color: "#f0ede8", margin: "2rem 0 0.75rem", letterSpacing: "-0.01em" }}>Your Sleeping Giant</h3>
                    <div className="card kot-anim">
                      <p className="card-label">Highest-Leverage Opportunity</p>
                      <p className="card-body">{report.sleepingGiant}</p>
                    </div>
                  </>
                )}
                {report.mockup && (
                  <>
                    <h3 style={{ fontFamily: "'Fraunces', Georgia, serif", fontSize: 24, fontWeight: 300, color: "#f0ede8", margin: "2rem 0 0.75rem", letterSpacing: "-0.01em" }}>Your Site, Rewritten</h3>
                    <div className="kot-anim" style={{ marginBottom: 14 }}>
                      <WebsiteMockup mockup={report.mockup} businessName={report.businessName} url={url} />
                    </div>
                  </>
                )}
              </>
            )}

            {/* About These Results */}
            <h3 style={{ fontFamily: "'Fraunces', Georgia, serif", fontSize: 24, fontWeight: 300, color: "#f0ede8", margin: "2rem 0 0.75rem", letterSpacing: "-0.01em" }}>About These Results</h3>
            <div className="card kot-anim">
              <p className="card-label">About These Results</p>
              <p style={{ fontFamily: "'Plus Jakarta Sans', sans-serif", fontSize: 14, fontWeight: 300, lineHeight: 1.8, color: "#f0ede8", marginBottom: 12 }}>
                These results were generated using Monica Poling's proprietary Revenue Mapping framework, developed over 20+ years of helping businesses turn what they know into what they're known for.
              </p>
              <p style={{ fontFamily: "'Plus Jakarta Sans', sans-serif", fontSize: 14, fontWeight: 300, lineHeight: 1.8, color: "#f0ede8", margin: 0 }}>
                Learn More: <a href="https://monicapoling.com/revenue-mapping/" target="_blank" rel="noopener noreferrer" style={{ color: "#be3650", textDecoration: "none", fontWeight: 500 }}>monicapoling.com/revenue-mapping</a>
              </p>
            </div>

            {/* Print */}
            <div className="card kot-anim no-print" style={{ marginTop: 14 }}>
              <p className="card-label">Print This Page</p>
              <p style={{ fontFamily: "'Plus Jakarta Sans', sans-serif", fontSize: 14, fontWeight: 300, lineHeight: 1.8, color: "#f0ede8", marginBottom: 20 }}>
                Your report lives right here. Not in a database.<br />Print this page before you click away, or you'll lose your results.
              </p>
              <button className="btn-primary" onClick={() => window.print()}>Print / Save as PDF →</button>
              {isMonica && report && (
                <button className="btn-ghost" style={{ marginTop: 12 }}
                  onClick={() => { console.log("POWER Score Report Data:", JSON.stringify(report, null, 2)); alert("Report data logged to console (F12 → Console)."); }}>
                  Log Report Data →
                </button>
              )}
            </div>

          </div>
        )}

        {/* ── FOOTER ── */}
        <div className="page-footer-rule" style={{ margin: "2rem 0 0" }} />

        <div className="no-print" style={{ background: "#1a1a18", padding: "2rem clamp(16px,4vw,2rem)" }}>
          <div style={{ background: "#242422", border: "1px solid rgba(255,255,255,0.08)", borderRadius: 10, padding: "1.5rem", display: "flex", gap: "1.25rem", alignItems: "flex-start", flexWrap: "wrap" }}>
            <div style={{ flex: 1, minWidth: 200 }}>
              <div style={{ fontSize: 11, fontWeight: 500, textTransform: "uppercase", letterSpacing: "0.14em", color: "#be3650", marginBottom: "0.4rem" }}>Let's Make Some Noise</div>
              <p style={{ fontSize: 12, color: "var(--muted)", lineHeight: 1.6, margin: 0 }}>Turn what you know into what you're known for. Weekly ideas on using AI to organize, share, and monetize your expertise.</p>
            </div>
            <div style={{ display: "flex", flexDirection: "column", gap: 8, minWidth: 220, flex: "0 0 260px" }}>
              {!newsletterSubmitted ? (
                <>
                  <input type="text" value={newsletterFirstName} onChange={(e) => setNewsletterFirstName(e.target.value)}
                    placeholder="First name"
                    style={{ background: "#111110", border: "1px solid rgba(255,255,255,0.12)", borderRadius: 8, padding: "9px 12px", fontFamily: "'Plus Jakarta Sans',sans-serif", fontSize: 13, color: "#f0ede8", WebkitTextFillColor: "#f0ede8", outline: "none" }} />
                  <input type="email" value={newsletterEmail} onChange={(e) => setNewsletterEmail(e.target.value)}
                    onKeyDown={(e) => e.key === "Enter" && handleNewsletterSubmit()}
                    placeholder="your@email.com"
                    style={{ background: "#111110", border: "1px solid rgba(255,255,255,0.12)", borderRadius: 8, padding: "9px 12px", fontFamily: "'Plus Jakarta Sans',sans-serif", fontSize: 13, color: "#f0ede8", WebkitTextFillColor: "#f0ede8", outline: "none" }} />
                  <button onClick={handleNewsletterSubmit} disabled={!newsletterEmail.trim()}
                    style={{ background: "#861442", color: "#fff", border: "none", borderRadius: 10, padding: "10px 22px", fontFamily: "'Plus Jakarta Sans',sans-serif", fontSize: 13, fontWeight: 500, cursor: newsletterEmail.trim() ? "pointer" : "not-allowed", opacity: newsletterEmail.trim() ? 1 : 0.4, transition: "opacity .18s" }}>
                    Subscribe Now
                  </button>
                  <p style={{ fontSize: 11, color: "#5a5a56", lineHeight: 1.6, margin: 0 }}>By submitting, you understand you'll be subscribed to the Let's Make Some Noise newsletter. You may unsubscribe any time.</p>
                </>
              ) : (
                <p style={{ fontSize: 13, color: "#4caf8a", fontWeight: 400 }}>✓ You're in! Watch for Let's Make Some Noise.</p>
              )}
            </div>
          </div>
        </div>

        <div className="page-footer-rule" />
        <footer className="page-footer no-print">
          <div>© 2026 POWER Score &nbsp;·&nbsp; Data on Tap &nbsp;·&nbsp; <a href="https://monicapoling.com/data-on-tap" target="_blank" rel="noopener noreferrer">monicapoling.com</a></div>
        </footer>

      </div>
    </div>
  );
}
