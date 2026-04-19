import { useState } from "react";

const LOGGER = "https://script.google.com/macros/s/AKfycbwvztxaVKSDYhevhsjQ7LowAMvjBu4ONs2AqXytbNflmEJ_mfBF7mI54fgyhBZzhU8M/exec";

export default function SubscribeBar({ appName = "", url = "", score = "" }) {
  const [firstName, setFirstName] = useState("");
  const [email, setEmail] = useState("");
  const [submitted, setSubmitted] = useState(false);

  const handleSubmit = async () => {
    if (!email.trim()) return;
    try {
      const now = new Date();
      const humanTime = now.toLocaleString("en-US", { month: "long", day: "numeric", year: "numeric", hour: "numeric", minute: "2-digit", hour12: true });
      await fetch(LOGGER, {
        method: "POST", mode: "no-cors",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ timestamp: humanTime, event: "newsletter_footer_submit", app: appName, url, score, firstName: firstName.trim(), email: email.trim(), subscribe: "yes" }),
      });
      setSubmitted(true);
    } catch { /* silent */ }
  };

  return (
    <div className="no-print" style={{ background: "#242422", padding: "2rem clamp(16px,4vw,2rem)" }}>
      <div style={{ maxWidth: 860, margin: "0 auto" }}>
        <div style={{ marginBottom: "1.25rem" }}>
          <div style={{ fontSize: 11, fontWeight: 500, textTransform: "uppercase", letterSpacing: "0.14em", color: "#be3650", marginBottom: "0.5rem" }}>Let's Make Some Noise</div>
          <p style={{ fontSize: 14, fontWeight: 300, fontStyle: "italic", color: "#f0ede8", lineHeight: 1.5, margin: "0 0 0.35rem", fontFamily: "'Fraunces', Georgia, serif" }}>Turn what you know into what you're known for.</p>
          <p style={{ fontSize: 13, fontWeight: 300, color: "var(--muted)", lineHeight: 1.6, margin: 0, fontFamily: "'Plus Jakarta Sans', sans-serif" }}>Subscribe to get weekly ideas on how to use AI to organize, share, and monetize your expertise.</p>
        </div>
        {!submitted ? (
          <>
            <div style={{ display: "flex", gap: 8, marginBottom: 8 }}>
              <input
                type="text"
                value={firstName}
                onChange={(e) => setFirstName(e.target.value)}
                placeholder="First name"
                style={{ flex: 1, background: "#111110", border: "1px solid rgba(255,255,255,0.12)", borderRadius: 8, padding: "9px 12px", fontFamily: "'Plus Jakarta Sans',sans-serif", fontSize: 13, color: "#f0ede8", WebkitTextFillColor: "#f0ede8", outline: "none" }}
              />
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && handleSubmit()}
                placeholder="your@email.com"
                style={{ flex: 2, background: "#111110", border: "1px solid rgba(255,255,255,0.12)", borderRadius: 8, padding: "9px 12px", fontFamily: "'Plus Jakarta Sans',sans-serif", fontSize: 13, color: "#f0ede8", WebkitTextFillColor: "#f0ede8", outline: "none" }}
              />
              <button
                onClick={handleSubmit}
                disabled={!email.trim()}
                style={{ background: "#861442", color: "#fff", border: "none", borderRadius: 8, padding: "9px 20px", fontFamily: "'Plus Jakarta Sans',sans-serif", fontSize: 13, fontWeight: 500, whiteSpace: "nowrap", cursor: email.trim() ? "pointer" : "not-allowed", opacity: email.trim() ? 1 : 0.4, transition: "opacity .18s" }}
              >
                Subscribe Now →
              </button>
            </div>
            <p style={{ fontSize: 11, color: "#5a5a56", lineHeight: 1.6, margin: 0, fontFamily: "'Plus Jakarta Sans', sans-serif" }}>
              By submitting, you'll be subscribed to the Let's Make Some Noise newsletter. You may unsubscribe any time.
            </p>
          </>
        ) : (
          <p style={{ fontSize: 13, color: "#4caf8a", fontWeight: 400, fontFamily: "'Plus Jakarta Sans', sans-serif" }}>✓ You're in! Watch for Let's Make Some Noise.</p>
        )}
      </div>
    </div>
  );
}
