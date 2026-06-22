/**
 * Animated install terminal (Claude Design hero). Stays dark in both themes —
 * a dark code block on white is a Notion-valid pattern — so it uses literal
 * hex, not design tokens, except the ambient lift shadow.
 */
const TerminalHero = () => (
  <div
    style={{
      animation: "ms-rise .7s ease .24s both",
      width: "100%",
      maxWidth: "680px",
      margin: "54px auto 20px",
      borderRadius: "14px",
      overflow: "hidden",
      background: "rgba(11,20,36,0.92)",
      border: "1px solid rgba(14,165,233,0.18)",
      boxShadow: "var(--shadow-lift, 0 30px 80px -24px rgba(0,0,0,0.85))",
      textAlign: "left",
    }}
  >
    <div
      style={{
        display: "flex",
        alignItems: "center",
        gap: "14px",
        padding: "12px 18px",
        background: "rgba(255,255,255,0.03)",
        borderBottom: "1px solid rgba(14,165,233,0.14)",
      }}
    >
      <div style={{ display: "flex", gap: "8px" }}>
        <span style={{ width: "11px", height: "11px", borderRadius: "50%", background: "#ff5f56" }} />
        <span style={{ width: "11px", height: "11px", borderRadius: "50%", background: "#ffbd2e" }} />
        <span style={{ width: "11px", height: "11px", borderRadius: "50%", background: "#27c93f" }} />
      </div>
      <span style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: "11.5px", letterSpacing: "0.12em", color: "#64748b" }}>
        bash — 80×24
      </span>
    </div>
    <div style={{ padding: "24px 24px 26px", fontFamily: "'JetBrains Mono', monospace", fontSize: "13.5px", lineHeight: 1.9, color: "#c5d1de" }}>
      <div>
        <span style={{ color: "#0ea5e9" }}>➜</span> <span style={{ color: "#64748b" }}>~</span> npm install multistack-success
      </div>
      <div style={{ color: "#0ea5e9" }}># MultiStack Systems Initialized</div>
      <div style={{ color: "#64748b" }}>Installing high_level_engineering...</div>
      <div style={{ margin: "11px 0", height: "6px", borderRadius: "6px", background: "rgba(255,255,255,0.07)", overflow: "hidden" }}>
        <div
          style={{
            height: "100%",
            borderRadius: "6px",
            background: "#0ea5e9",
            boxShadow: "0 0 12px rgba(14,165,233,0.7)",
            animation: "ms-loadbar 3.4s cubic-bezier(.6,.1,.2,1) infinite",
          }}
        />
      </div>
      <div style={{ color: "#10b981" }}>✔ Success: Engineering DNA injected.</div>
      <div style={{ color: "#64748b" }}>
        added 42 packages in 2.1s
        <span style={{ display: "inline-block", width: "7px", height: "14px", marginLeft: "6px", verticalAlign: "-2px", background: "#0ea5e9", animation: "ms-blink 1.1s steps(1) infinite" }} />
      </div>
    </div>
  </div>
);

export default TerminalHero;
