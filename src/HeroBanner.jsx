export default function HeroBanner({
  titleStrong = "Money Moves",
  titleEm = "Analysis",
  subHeadline = "Are you leaving money on the table?",
  subBody = "Get your free Money Moves analysis — an AI-generated analyis that includes your wow factor, your services, and the revenue opportunity hiding in plain sight.",
  dimLabels = ["About", "Wow Factor", "Services", "Sleeping Giant", "Revenue Moves"],
  heroImage = "/money-moves-hero.png",
  faviconSrc = "/favicon.png",
  faviconAlt = "Money Moves Brief",
}) {
  return (
    <>
      <style>{`
        .hb-hero { width: 100%; background: #111110; display: flex; align-items: stretch; min-height: 220px; max-height: 280px; border-bottom: 1px solid rgba(255,255,255,0.06); }
        .hb-hero-left { flex: 3; padding: 2rem clamp(16px,4vw,2rem); display: flex; flex-direction: column; justify-content: center; gap: 14px; }
        .hb-logo-row { display: flex; align-items: center; gap: 14px; }
        .hb-title { font-family: 'Fraunces', Georgia, serif; font-size: clamp(28px,4vw,42px); color: #f0ede8; line-height: 1; letter-spacing: -0.02em; }
        .hb-title strong { font-weight: 700; color: #f0ede8; }
        .hb-title em { font-weight: 300; font-style: italic; color: #be3650; }
        .hb-sub { font-family: 'Plus Jakarta Sans', sans-serif; font-size: 15px; font-weight: 300; line-height: 24px; color: #c8c4bc; max-width: 520px; }
        .hb-sub-headline { margin-bottom: 0.5rem; font-weight: 600; font-size: 16px; color: #f0ede8; }
        .hb-hero-right { flex: 0 0 230px; min-width: 200px; max-width: 230px; position: relative; overflow: hidden; background: #1a1a18; }
        .hb-hero-right img { width: 100%; height: 100%; object-fit: cover; object-position: center top; display: block; }
        .hb-dim-bar { background: #111110; display: flex; align-items: center; border-top: 1.5px solid rgba(134,20,66,0.5); border-bottom: 1.5px solid rgba(134,20,66,0.5); }
        .hb-dim-col { flex: 1; text-align: center; padding: 8px 4px; font-family: 'Plus Jakarta Sans', sans-serif; font-size: 10px; font-weight: 500; letter-spacing: 0.12em; text-transform: uppercase; color: #f0ede8; }
        .hb-dim-pipe { width: 1px; height: 18px; background: rgba(255,255,255,0.35); flex-shrink: 0; }
        .hb-section-header { background: #1a1a18; padding: 2.5rem clamp(16px,4vw,2rem) 2.5rem 0; }
        .hb-section-header h2 { font-family: 'Fraunces', Georgia, serif; font-size: 24px; font-weight: 300; color: #f0ede8; margin: 0; letter-spacing: -0.01em; text-align: left; }
        .hb-section-header h2 .hb-word-strong { font-weight: 700; color: #f0ede8; }
        .hb-section-header h2 .hb-word-em { font-weight: 300; font-style: italic; color: #be3650; }
        @media (max-width: 500px) { .hb-hero-right { display: none; } }
      `}</style>

      {/* Hero */}
      <div className="hb-hero no-print">
        <div className="hb-hero-left">
          <div className="hb-logo-row">
            <div style={{ flexShrink: 0, lineHeight: 0 }}>
              <img src={faviconSrc} alt={faviconAlt} width="54" height="54" style={{ display: "block" }} />
            </div>
            <div className="hb-title">
              <strong>{titleStrong}</strong> <em>{titleEm}</em>
            </div>
          </div>
          <div className="hb-sub">
            <p className="hb-sub-headline">{subHeadline}</p>
            <p>{subBody}</p>
          </div>
        </div>
        <div className="hb-hero-right">
          <img src={heroImage} alt={faviconAlt} />
        </div>
      </div>

      {/* Dim bar */}
      <div className="hb-dim-bar no-print">
        {dimLabels.map((label, i) => (
          <>
            {i > 0 && <div key={`pipe-${i}`} className="hb-dim-pipe" />}
            <div key={label} className="hb-dim-col">{label}</div>
          </>
        ))}
      </div>

      {/* Section header */}
      <div className="hb-section-header no-print">
        <h2>
          <span style={{ color: "#be3650" }}>Get Your</span>{" "}
          <span className="hb-word-strong">{titleStrong}</span>{" "}
          <span className="hb-word-em">{titleEm}</span>
        </h2>
      </div>
    </>
  );
}
