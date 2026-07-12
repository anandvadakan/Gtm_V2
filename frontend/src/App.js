import React, { useState, useEffect, useRef } from "react";
import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";

const API = process.env.REACT_APP_API_URL || "http://localhost:5000";

// ScrambleText component
function ScrambleText({ text, trigger }) {
  const chars = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789!@#$%^&*";
  const [display, setDisplay] = useState(trigger ? text : Array(text.length).fill(" ").join(""));
  const frame = useRef(0);
  const interval = useRef(null);

  useEffect(() => {
    if (!trigger) return;
    frame.current = 0;
    clearInterval(interval.current);
    interval.current = setInterval(() => {
      frame.current += 0.5;
      const revealed = Math.floor(frame.current);
      if (revealed >= text.length) {
        setDisplay(text);
        clearInterval(interval.current);
        return;
      }
      setDisplay(text.split("").map((c, i) => {
        if (c === " ") return " ";
        if (i < revealed) return c;
        if (i < revealed + 3) return chars[Math.floor(Math.random() * chars.length)];
        return " ";
      }).join(""));
    }, 25);
    return () => clearInterval(interval.current);
  }, [trigger, text]);

  return <span>{display}</span>;
}

// Logo SVG
function Logo({ size = 20, opacity = 1 }) {
  const path = "M 1.5,23 L 1.5,33 C 1.5,38.5 6,43 11.5,43 L 16.5,43 C 22,43 26.5,38.5 26.5,33 Q 28,28 33,26.5 C 38.5,26.5 43,22 43,16.5 L 43,11.5 C 43,6 38.5,1.5 33,1.5 L 23,1.5 Q 12,12 1.5,23 Z";
  return (
    <svg width={size} height={size} viewBox="-50 -50 100 100" style={{ opacity }}>
      {[0, 90, 180, 270].map(r => (
        <path key={r} d={path} fill="white" transform={`rotate(${r})`} />
      ))}
    </svg>
  );
}

// Priority badge
function PBadge({ val }) {
  const cls = val?.toLowerCase() === "high" ? "badge-high" : val?.toLowerCase() === "medium" ? "badge-medium" : "badge-low";
  return <span className={`tag ${cls}`} style={{ fontSize: 10 }}>{val}</span>;
}

// Section wrapper
function Section({ title, label, children, delay = 0 }) {
  return (
    <div className="glass" style={{ padding: 24, marginBottom: 16, animationDelay: `${delay}s` }}>
      {label && <div className="section-label">{label}</div>}
      {title && <div className="section-heading">{title}</div>}
      {children}
    </div>
  );
}

// Tag list
function TagList({ items, type = "purple" }) {
  if (!items?.length) return <span style={{ color: "rgba(255,255,255,0.2)", fontSize: 12 }}>No data</span>;
  return (
    <div className="tag-wrap">
      {items.map((t, i) => <span key={i} className={`tag tag-${type}`}>{t}</span>)}
    </div>
  );
}

// Data list with dots
function DataList({ items, color = "#a78bfa" }) {
  if (!items?.length) return null;
  return (
    <div>
      {items.map((item, i) => (
        <div key={i} className="data-row">
          <div className="data-dot" style={{ background: color }} />
          <span style={{ fontSize: 13, color: "rgba(255,255,255,0.65)", lineHeight: 1.6 }}>{item}</span>
        </div>
      ))}
    </div>
  );
}

// Results view
function ResultsView({ data, onReset }) {
  const { meta, executiveSummary, overallSentiment, audienceInsights,
    messagingIntelligence, twitterInsights, competitorGaps,
    channelRecommendations, redditOpportunities, gtmRecommendations,
    marketSignals, launchPlaybook } = data;

  function downloadPDF() {
    const doc = new jsPDF();
    doc.setFont("helvetica", "bold");
    doc.setFontSize(20);
    doc.text("GTM INTELLIGENCE REPORT", 14, 20);
    doc.setFont("helvetica", "normal");
    doc.setFontSize(11);
    doc.text(`Brand: ${meta.brand} | Category: ${meta.category}`, 14, 30);
    doc.text(`Median Sentiment: ${overallSentiment?.score}/100 — ${overallSentiment?.label}`, 14, 38);
    doc.setFontSize(10);
    const lines = doc.splitTextToSize(executiveSummary || "", 180);
    doc.text(lines, 14, 48);
    let y = 48 + lines.length * 6 + 10;

    autoTable(doc, {
      startY: y,
      head: [["Channel", "Priority", "Approach"]],
      body: channelRecommendations?.map(c => [c.channel, c.priority, c.approach]) || [],
      styles: { fontSize: 9, font: "helvetica" },
      headStyles: { fillColor: [124, 58, 237] },
    });
    y = doc.lastAutoTable.finalY + 10;

    autoTable(doc, {
      startY: y,
      head: [["GTM Recommendation", "Impact", "Effort"]],
      body: gtmRecommendations?.map(r => [r.recommendation, r.impact, r.effort]) || [],
      styles: { fontSize: 9 },
      headStyles: { fillColor: [124, 58, 237] },
    });

    if (launchPlaybook) {
      doc.addPage();
      doc.setFont("helvetica", "bold");
      doc.setFontSize(16);
      doc.text("LAUNCH PLAYBOOK", 14, 20);
      doc.setFont("helvetica", "normal");
      doc.setFontSize(10);
      doc.text(`Optimal Timing: ${launchPlaybook.optimalTiming || ""}`, 14, 32);
      let ly = 42;
      doc.setFont("helvetica", "bold");
      doc.text("Pre-Launch Actions:", 14, ly); ly += 8;
      doc.setFont("helvetica", "normal");
      launchPlaybook.prelaunchActions?.forEach(a => {
        const ls = doc.splitTextToSize(`• ${a}`, 180);
        doc.text(ls, 14, ly); ly += ls.length * 6 + 2;
      });
    }
    doc.save(`gtm-intelligence-${meta.brand}.pdf`);
  }

  return (
    <div style={{ maxWidth: 900, margin: "0 auto", padding: "24px 16px 80px" }}>
      {/* Header */}
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 32, flexWrap: "wrap", gap: 12 }}>
        <div>
          <div className="section-label">GTM Intelligence Report</div>
          <h1 style={{ fontSize: "clamp(22px,4vw,36px)", fontWeight: 700, letterSpacing: "-0.02em" }}>
            {meta.brand} <span style={{ color: "rgba(255,255,255,0.3)" }}>/ {meta.category}</span>
          </h1>
        </div>
        <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
          <button className="btn-ghost" onClick={downloadPDF}>↓ Export PDF</button>
          <button className="btn-ghost" onClick={onReset}>← New Analysis</button>
        </div>
      </div>

      {/* Meta stats */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(4,1fr)", gap: 12, marginBottom: 20 }} className="four-col">
        {[
          { num: meta.redditPostsAnalyzed, label: "Reddit Posts" },
          { num: meta.tweetsAnalyzed, label: "Tweets" },
          { num: meta.newsArticlesAnalyzed, label: "News Articles" },
          { num: meta.competitorPostsAnalyzed || 0, label: "Competitor Posts" },
        ].map((m, i) => (
          <div key={i} className="metric-card">
            <div className="metric-num">{m.num}</div>
            <div className="metric-label">{m.label}</div>
          </div>
        ))}
      </div>

      {/* Sentiment + Summary */}
      <div className="glass" style={{ padding: 24, marginBottom: 16, display: "flex", gap: 24, alignItems: "flex-start", flexWrap: "wrap" }}>
        <div style={{ flexShrink: 0 }}>
          <div className="score-ring">
            <div className="score-num">{overallSentiment?.score}</div>
            <div className="score-sub">MEDIAN</div>
          </div>
          <div style={{ textAlign: "center", marginTop: 10, fontSize: 11, color: "rgba(255,255,255,0.4)", letterSpacing: "0.1em" }}>
            {overallSentiment?.label?.toUpperCase()}
          </div>
        </div>
        <div style={{ flex: 1, minWidth: 200 }}>
          <div className="section-label">Executive Summary</div>
          <p style={{ fontSize: 14, lineHeight: 1.8, color: "rgba(255,255,255,0.7)" }}>{executiveSummary}</p>
          <p style={{ fontSize: 12, color: "rgba(255,255,255,0.3)", marginTop: 12 }}>{overallSentiment?.reasoning}</p>
        </div>
      </div>

      {/* Active communities */}
      {meta.topSubreddits?.length > 0 && (
        <Section label="Active Communities" title="Where Your Audience Lives">
          <div style={{ display: "flex", flexWrap: "wrap", gap: 10 }}>
            {meta.topSubreddits.map((s, i) => (
              <div key={i} style={{ padding: "8px 14px", borderRadius: 10, background: "rgba(167,139,250,0.08)", border: "1px solid rgba(167,139,250,0.2)" }}>
                <span style={{ color: "#a78bfa", fontWeight: 700, fontSize: 13 }}>r/{s.name}</span>
                <span style={{ color: "rgba(255,255,255,0.3)", fontSize: 11, marginLeft: 6 }}>{s.count} mentions</span>
              </div>
            ))}
          </div>
        </Section>
      )}

      {/* Pain points + Delight */}
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16, marginBottom: 16 }} className="two-col">
        <Section label="Pain Points" title="What's Broken">
          <TagList items={audienceInsights?.painPoints} type="red" />
        </Section>
        <Section label="Delight Factors" title="What's Working">
          <TagList items={audienceInsights?.delightFactors} type="green" />
        </Section>
      </div>

      {/* Language */}
      <Section label="Audience Language" title="Exact Words They Use">
        <div className="tag-wrap">
          {audienceInsights?.languageTheyUse?.map((l, i) => (
            <span key={i} className="tag tag-purple">"{l}"</span>
          ))}
        </div>
      </Section>

      {/* Messaging intelligence */}
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16, marginBottom: 16 }} className="two-col">
        <Section label="Messaging" title="What Resonates">
          <DataList items={messagingIntelligence?.resonatingThemes} color="#6ee7b7" />
        </Section>
        <Section label="Messaging" title="What to Avoid">
          <DataList items={messagingIntelligence?.avoidThemes} color="#f87171" />
        </Section>
      </div>

      {/* Content angles */}
      <Section label="Content Strategy" title="Angles That Would Land">
        <DataList items={messagingIntelligence?.contentAngles} color="#a78bfa" />
      </Section>

      {/* Twitter insights */}
      {twitterInsights && (
        <Section label="Twitter / X Intelligence" title="Social Signal Analysis">
          <div style={{ marginBottom: 16 }}>
            <div className="section-label">Dominant Sentiment</div>
            <p style={{ fontSize: 13, color: "rgba(255,255,255,0.6)" }}>{twitterInsights.dominantSentiment}</p>
          </div>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16 }} className="two-col">
            <div>
              <div className="section-label" style={{ marginBottom: 10 }}>Viral Angles</div>
              <TagList items={twitterInsights.viralAngles} type="blue" />
            </div>
            <div>
              <div className="section-label" style={{ marginBottom: 10 }}>Hashtag Opportunities</div>
              <TagList items={twitterInsights.hashtagOpportunities} type="yellow" />
            </div>
          </div>
        </Section>
      )}

      {/* Competitor gaps */}
      {competitorGaps && (
        <Section label="Competitor Intelligence" title={`${meta.brand} vs ${meta.competitor}`}>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 12 }} className="three-col">
            <div className="comp-col comp-wins">
              <div className="comp-col-label" style={{ color: "#6ee7b7" }}>Where You Win</div>
              <ul>{competitorGaps.whereBrandWins?.map((w, i) => <li key={i}>{w}</li>)}</ul>
            </div>
            <div className="comp-col comp-loses">
              <div className="comp-col-label" style={{ color: "#f87171" }}>Where They Win</div>
              <ul>{competitorGaps.whereCompetitorWins?.map((w, i) => <li key={i}>{w}</li>)}</ul>
            </div>
            <div className="comp-col comp-opps">
              <div className="comp-col-label" style={{ color: "#fcd34d" }}>Unmet Needs</div>
              <ul>{competitorGaps.unmetNeeds?.map((w, i) => <li key={i}>{w}</li>)}</ul>
            </div>
          </div>
        </Section>
      )}

      {/* Channel recommendations */}
      <Section label="Channel Strategy" title="Where to Show Up">
        <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
          {channelRecommendations?.map((c, i) => (
            <div key={i} style={{ padding: "16px", borderRadius: 12, background: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.06)" }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 8 }}>
                <span style={{ fontWeight: 700, fontSize: 14 }}>{c.channel}</span>
                <PBadge val={c.priority} />
              </div>
              <p style={{ fontSize: 12, color: "rgba(255,255,255,0.5)", marginBottom: 6 }}>{c.reason}</p>
              <p style={{ fontSize: 12, color: "#a78bfa" }}>→ {c.approach}</p>
            </div>
          ))}
        </div>
      </Section>

      {/* Reddit opportunities */}
      <Section label="Reddit Strategy" title="Community Opportunities">
        <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
          {redditOpportunities?.map((r, i) => (
            <div key={i} style={{ padding: 14, borderRadius: 10, background: "rgba(255,255,255,0.02)", border: "1px solid rgba(255,255,255,0.05)" }}>
              <div style={{ color: "#a78bfa", fontWeight: 700, fontSize: 13, marginBottom: 6 }}>r/{r.subreddit}</div>
              <p style={{ fontSize: 12, color: "rgba(255,255,255,0.5)", marginBottom: 4 }}>{r.opportunity}</p>
              <p style={{ fontSize: 12, color: "rgba(255,255,255,0.7)" }}>→ {r.approach}</p>
            </div>
          ))}
        </div>
      </Section>

      {/* GTM Recommendations */}
      <Section label="GTM Recommendations" title="Action Items">
        <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
          {gtmRecommendations?.map((r, i) => (
            <div key={i} style={{ padding: 16, borderRadius: 12, background: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.06)" }}>
              <div style={{ display: "flex", gap: 8, marginBottom: 8, flexWrap: "wrap" }}>
                <span style={{ fontSize: 11, color: "rgba(255,255,255,0.3)" }}>Impact:</span>
                <PBadge val={r.impact} />
                <span style={{ fontSize: 11, color: "rgba(255,255,255,0.3)", marginLeft: 8 }}>Effort:</span>
                <PBadge val={r.effort} />
              </div>
              <p style={{ fontWeight: 700, fontSize: 13, marginBottom: 6 }}>{r.recommendation}</p>
              <p style={{ fontSize: 12, color: "rgba(255,255,255,0.5)" }}>{r.rationale}</p>
            </div>
          ))}
        </div>
      </Section>

      {/* Market signals */}
      <Section label="Market Signals" title="What the Data Says">
        {marketSignals?.map((s, i) => (
          <div key={i} className="signal-bar">{s}</div>
        ))}
      </Section>

      {/* Launch playbook */}
      {launchPlaybook && (
        <div className="glass" style={{ padding: 24, marginBottom: 16, border: "1px solid rgba(167,139,250,0.2)", background: "rgba(167,139,250,0.04)" }}>
          <div className="section-label" style={{ color: "#a78bfa" }}>New Product Launch Playbook</div>
          <div className="section-heading">Your Launch Roadmap</div>

          <div style={{ marginBottom: 20, padding: 14, borderRadius: 10, background: "rgba(167,139,250,0.08)", border: "1px solid rgba(167,139,250,0.15)" }}>
            <div className="section-label">Core Launch Message</div>
            <p style={{ fontSize: 13, color: "#fff", lineHeight: 1.7 }}>"{launchPlaybook.messagingForLaunch}"</p>
          </div>

          <div style={{ marginBottom: 20 }}>
            <div className="section-label">Optimal Timing</div>
            <p style={{ fontSize: 13, color: "rgba(255,255,255,0.7)" }}>{launchPlaybook.optimalTiming}</p>
          </div>

          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 16, marginBottom: 20 }} className="three-col">
            {[
              { label: "Pre-Launch", items: launchPlaybook.prelaunchActions, color: "#93c5fd" },
              { label: "Launch Day", items: launchPlaybook.launchDayPlaybook, color: "#a78bfa" },
              { label: "First Week", items: launchPlaybook.firstWeekActions, color: "#6ee7b7" },
            ].map((phase, pi) => (
              <div key={pi} style={{ padding: 14, borderRadius: 10, background: "rgba(255,255,255,0.02)", border: "1px solid rgba(255,255,255,0.06)" }}>
                <div className="section-label" style={{ color: phase.color, marginBottom: 12 }}>{phase.label}</div>
                {phase.items?.map((item, i) => (
                  <div key={i} className="playbook-step">
                    <div className="step-num" style={{ borderColor: phase.color, color: phase.color }}>{i + 1}</div>
                    <p style={{ fontSize: 12, color: "rgba(255,255,255,0.65)", lineHeight: 1.6 }}>{item}</p>
                  </div>
                ))}
              </div>
            ))}
          </div>

          <div style={{ marginBottom: 16 }}>
            <div className="section-label">Channel Launch Sequence</div>
            <div style={{ display: "flex", flexWrap: "wrap", gap: 8, marginTop: 8 }}>
              {launchPlaybook.launchChannelSequence?.map((c, i) => (
                <div key={i} style={{ display: "flex", alignItems: "center", gap: 8 }}>
                  <span style={{ fontSize: 11, color: "rgba(255,255,255,0.3)" }}>{i + 1}.</span>
                  <span className="tag tag-purple">{c}</span>
                  {i < launchPlaybook.launchChannelSequence.length - 1 && (
                    <span style={{ color: "rgba(255,255,255,0.2)", fontSize: 12 }}>→</span>
                  )}
                </div>
              ))}
            </div>
          </div>

          {launchPlaybook.risksToWatch?.length > 0 && (
            <div>
              <div className="section-label">Risks to Watch</div>
              <DataList items={launchPlaybook.risksToWatch} color="#f87171" />
            </div>
          )}
        </div>
      )}
    </div>
  );
}

// Loading terminal component
function LoadingTerminal({ steps, currentStep }) {
  return (
    <div className="terminal" style={{ maxWidth: 500, margin: "0 auto" }}>
      <div style={{ marginBottom: 16, display: "flex", gap: 6 }}>
        {["#ef4444", "#f59e0b", "#22c55e"].map((c, i) => (
          <div key={i} style={{ width: 10, height: 10, borderRadius: "50%", background: c }} />
        ))}
      </div>
      {steps.map((step, i) => (
        <div key={i} className={`terminal-line ${i < currentStep ? "done" : i === currentStep ? "active" : ""}`}>
          <span>{i < currentStep ? "✓" : i === currentStep ? ">" : " "}</span>
          <span>{step}</span>
          {i === currentStep && <span className="terminal-cursor" />}
        </div>
      ))}
    </div>
  );
}

// Main App
export default function App() {
  const [brand, setBrand] = useState("");
  const [category, setCategory] = useState("");
  const [competitor, setCompetitor] = useState("");
  const [isLaunch, setIsLaunch] = useState(false);
  const [loading, setLoading] = useState(false);
  const [loadingStep, setLoadingStep] = useState(0);
  const [error, setError] = useState("");
  const [result, setResult] = useState(null);
  const [entered, setEntered] = useState(false);

  const terminalSteps = [
    "Expanding keywords with AI...",
    "Scraping Reddit communities and threads...",
    "Pulling Twitter/X signals (20 tweets)...",
    "Fetching Google News...",
    competitor ? `Scraping competitor data for ${competitor}...` : "Processing data sources...",
    "Running median sentiment analysis...",
    "Generating GTM intelligence report...",
    isLaunch ? "Building launch playbook..." : "Finalizing recommendations...",
  ];

  useEffect(() => {
    setTimeout(() => setEntered(true), 100);
  }, []);

  useEffect(() => {
    if (!loading) return;
    let step = 0;
    const durations = [3000, 8000, 5000, 4000, 6000, 2000, 3000, 2000];
    function advance() {
      if (step < terminalSteps.length - 1) {
        step++;
        setLoadingStep(step);
        setTimeout(advance, durations[step] || 3000);
      }
    }
    setTimeout(advance, durations[0]);
  }, [loading]);

  async function handleAnalyze() {
    if (!brand.trim() || !category.trim()) {
      setError("Brand name and category are required.");
      return;
    }
    setError("");
    setLoading(true);
    setLoadingStep(0);
    try {
      const res = await fetch(`${API}/api/analyze`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ brand: brand.trim(), category: category.trim(), competitor: competitor.trim(), isLaunch }),
      });
      const data = await res.json();
      if (data.error) throw new Error(data.error);
      setResult(data);
    } catch (e) {
      setError(e.message || "Analysis failed. Check backend connection.");
    } finally {
      setLoading(false);
    }
  }

  if (result) {
    return (
      <div style={{ fontFamily: "'Space Mono', monospace", background: "#000", minHeight: "100vh" }}>
        <div className="dot-grid" />
        <nav className="navbar">
          <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
            <Logo size={18} />
            <span style={{ fontSize: 14, fontWeight: 700, letterSpacing: "-0.02em" }}>GTM Intelligence</span>
          </div>
        </nav>
        <div style={{ paddingTop: 64, position: "relative", zIndex: 1 }}>
          <ResultsView data={result} onReset={() => { setResult(null); setLoadingStep(0); }} />
        </div>
      </div>
    );
  }

  return (
    <div style={{ fontFamily: "'Space Mono', monospace", background: "#000", minHeight: "100vh", position: "relative" }}>
      <div className="dot-grid" />

      {/* Navbar */}
      <nav className="navbar">
        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
          <Logo size={18} />
          <span style={{ fontSize: 14, fontWeight: 700, letterSpacing: "-0.02em" }}>GTM Intelligence</span>
        </div>
        <div style={{ marginLeft: "auto", fontSize: 11, color: "rgba(255,255,255,0.3)", letterSpacing: "0.1em" }}>
          POWERED BY GROQ + APIFY
        </div>
      </nav>

      {/* Hero */}
      <div className="hero-bg" style={{ position: "relative", zIndex: 1 }}>
        <div className="hero-glow" />
        <div className="hero-watermark">INTELLIGENCE</div>

        <div style={{ textAlign: "center", marginBottom: 48, position: "relative", zIndex: 2 }}>
          <div style={{
            fontSize: 11, letterSpacing: "0.3em", textTransform: "uppercase",
            color: "rgba(255,255,255,0.3)", marginBottom: 20,
            opacity: entered ? 1 : 0, transition: "opacity 0.8s"
          }}>
            Real-time GTM Intelligence
          </div>
          <h1 style={{
            fontSize: "clamp(36px,8vw,80px)", fontWeight: 700,
            letterSpacing: "-0.03em", lineHeight: 0.95, marginBottom: 20,
            opacity: entered ? 1 : 0, transition: "opacity 1s 0.2s"
          }}>
            <ScrambleText text="Know Your" trigger={entered} />
            <br />
            <span style={{ color: "rgba(255,255,255,0.3)" }}>
              <ScrambleText text="Market" trigger={entered} />
            </span>
          </h1>
          <p style={{
            fontSize: "clamp(13px,1.5vw,15px)", color: "rgba(255,255,255,0.4)",
            maxWidth: 460, margin: "0 auto", lineHeight: 1.7,
            opacity: entered ? 1 : 0, transition: "opacity 1s 0.4s"
          }}>
            AI-powered social listening across Reddit, Twitter, and news. Median-scored sentiment.
            Actionable GTM recommendations in under 90 seconds.
          </p>
        </div>

        {/* Input card */}
        <div className="glass" style={{
          width: "100%", maxWidth: 620, padding: 32, position: "relative", zIndex: 2,
          opacity: entered ? 1 : 0, transition: "opacity 1s 0.6s",
        }}>
          {error && (
            <div style={{
              padding: "12px 16px", borderRadius: 8, marginBottom: 16,
              background: "rgba(239,68,68,0.1)", border: "1px solid rgba(239,68,68,0.2)",
              color: "#f87171", fontSize: 12,
            }}>{error}</div>
          )}

          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16, marginBottom: 16 }}>
            <div>
              <label className="field-label">Brand / Product *</label>
              <input className="input-field" placeholder="e.g. boAt, Zepto" value={brand} onChange={e => setBrand(e.target.value)} />
            </div>
            <div>
              <label className="field-label">Category *</label>
              <input className="input-field" placeholder="e.g. TWS Earphones" value={category} onChange={e => setCategory(e.target.value)} />
            </div>
          </div>

          <div style={{ marginBottom: 20 }}>
            <label className="field-label">Competitor (Optional)</label>
            <input className="input-field" placeholder="e.g. Noise, Blinkit" value={competitor} onChange={e => setCompetitor(e.target.value)} />
          </div>

          <label className="launch-check" style={{ marginBottom: 24 }}>
            <input type="checkbox" checked={isLaunch} onChange={e => setIsLaunch(e.target.checked)} />
            <div>
              <div style={{ fontSize: 13, fontWeight: 700, marginBottom: 4 }}>
                I'm launching a new product in this category
              </div>
              <div style={{ fontSize: 11, color: "rgba(255,255,255,0.35)", lineHeight: 1.6 }}>
                Activates launch playbook mode — channel sequence, pre-launch actions, launch day plan, first-week strategy, and risks to watch.
              </div>
            </div>
          </label>

          {loading ? (
            <div>
              <LoadingTerminal steps={terminalSteps} currentStep={loadingStep} />
              <p style={{ textAlign: "center", fontSize: 11, color: "rgba(255,255,255,0.2)", marginTop: 16, letterSpacing: "0.1em" }}>
                ANALYSIS MAY TAKE 60-90 SECONDS
              </p>
            </div>
          ) : (
            <button className="btn-pill btn-primary-pill" style={{ width: "100%", justifyContent: "center" }} onClick={handleAnalyze}>
              Run GTM Intelligence Analysis →
            </button>
          )}
        </div>

        {/* Bottom source indicators */}
        <div style={{
          display: "flex", gap: 20, marginTop: 32, flexWrap: "wrap", justifyContent: "center",
          opacity: entered ? 1 : 0, transition: "opacity 1s 0.8s", position: "relative", zIndex: 2,
        }}>
          {["Reddit Communities", "Twitter / X", "Google News", "AI Keyword Expansion"].map((s, i) => (
            <div key={i} style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 11, color: "rgba(255,255,255,0.25)" }}>
              <div style={{ width: 6, height: 6, borderRadius: "50%", background: "rgba(167,139,250,0.5)" }} />
              {s}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
