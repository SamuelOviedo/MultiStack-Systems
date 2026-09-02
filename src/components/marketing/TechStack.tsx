import MsIcon from "@/components/marketing/MsIcon";

const LAYERS = [
  {
    name: "Frontend",
    icon: '<rect x="2" y="3" width="20" height="14" rx="2"/><line x1="8" y1="21" x2="16" y2="21"/><line x1="12" y1="17" x2="12" y2="21"/>',
    techs: ["React", "TypeScript", "Vite", "TailwindCSS", "Flutter"],
  },
  {
    name: "Backend & Datos",
    icon: '<ellipse cx="12" cy="5" rx="9" ry="3"/><path d="M3 5v14c0 1.66 4 3 9 3s9-1.34 9-3V5"/><path d="M3 12c0 1.66 4 3 9 3s9-1.34 9-3"/>',
    techs: ["Node.js", "Supabase", "PostgreSQL"],
  },
  {
    name: "Cloud & Despliegue",
    icon: '<path d="M17.5 19a4.5 4.5 0 0 0 0-9 6.5 6.5 0 0 0-12.3 1.5A4 4 0 0 0 6 19Z"/>',
    techs: ["AWS", "Vercel", "Render", "Windows Server", "Linux"],
  },
  {
    name: "Seguridad",
    icon: '<path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/>',
    techs: ["Kali Linux", "Kaspersky"],
  },
  {
    name: "IA & Diseño",
    icon: '<path d="M12 5a3 3 0 1 0-5.997.125 4 4 0 0 0-2.526 5.77 4 4 0 0 0 .556 6.588A4 4 0 1 0 12 18Z"/><path d="M12 5a3 3 0 1 1 5.997.125 4 4 0 0 1 2.526 5.77 4 4 0 0 1-.556 6.588A4 4 0 1 1 12 18Z"/>',
    techs: ["Claude", "Claude design", "Figma"],
  },
  {
    name: "Colaboración",
    icon: '<line x1="6" y1="3" x2="6" y2="15"/><circle cx="18" cy="6" r="3"/><circle cx="6" cy="18" r="3"/><path d="M18 9a9 9 0 0 1-9 9"/>',
    techs: ["Git", "GitHub", "Notion", "Trello", "Discord"],
  },
];

const TechStack = () => (
  <section id="stack" style={{ position: "relative", overflow: "hidden", padding: "112px 0", background: "var(--bg)" }}>
    <div style={{ position: "absolute", bottom: "-140px", left: "50%", transform: "translateX(-50%)", width: "680px", height: "520px", borderRadius: "50%", pointerEvents: "none", background: "var(--glow-a)" }} />
    <div style={{ position: "relative", maxWidth: "1100px", margin: "0 auto", padding: "0 32px" }}>
      <div style={{ display: "flex", alignItems: "flex-end", justifyContent: "space-between", gap: "20px", marginBottom: "42px", flexWrap: "wrap" }}>
        <div>
          <div style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: "13px", letterSpacing: "0.1em", color: "var(--accent)", marginBottom: "14px" }}>
            tech.stack
          </div>
          <h2 style={{ fontFamily: "'Sora', sans-serif", fontWeight: 600, fontSize: "clamp(30px,3.6vw,44px)", letterSpacing: "-0.025em", color: "var(--text)" }}>
            Stack Tecnológico
          </h2>
        </div>
        <div style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: "12px", letterSpacing: "0.04em", color: "var(--muted)" }}>
          06 capas · 23 tecnologías
        </div>
      </div>

      <div
        style={{
          border: "1px solid var(--hairline)",
          borderRadius: "16px",
          overflow: "hidden",
          background: "var(--glass-bg)",
          backdropFilter: "var(--glass-blur)",
          WebkitBackdropFilter: "var(--glass-blur)",
          boxShadow: "var(--shadow-card)",
        }}
      >
        {LAYERS.map((L) => (
          <div
            key={L.name}
            className="ms-stack-row ms-stack-rowgrid"
            style={{ padding: "24px 28px", borderBottom: "1px solid var(--hairline)" }}
          >
            <div style={{ display: "flex", alignItems: "center", gap: "15px" }}>
              <div style={{ width: "42px", height: "42px", borderRadius: "10px", flex: "none", display: "flex", alignItems: "center", justifyContent: "center", background: "var(--primary-soft)", color: "var(--primary)" }}>
                <MsIcon path={L.icon} />
              </div>
              <div>
                <div style={{ fontFamily: "'Sora', sans-serif", fontWeight: 600, fontSize: "16px", color: "var(--text)" }}>{L.name}</div>
                <div style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: "11px", color: "var(--muted)", marginTop: "3px" }}>
                  {L.techs.length} tecnologías
                </div>
              </div>
            </div>
            <div style={{ display: "flex", flexWrap: "wrap", gap: "9px" }}>
              {L.techs.map((t) => (
                <span
                  key={t}
                  className="ms-techchip"
                  style={{ display: "inline-flex", alignItems: "center", gap: "8px", fontFamily: "'JetBrains Mono', monospace", fontSize: "12.5px", color: "var(--text2)", padding: "8px 13px", borderRadius: "8px", background: "var(--bg)", border: "1px solid var(--hairline)", whiteSpace: "nowrap" }}
                >
                  <span style={{ width: "5px", height: "5px", borderRadius: "50%", background: "var(--primary)", flex: "none" }} />
                  {t}
                </span>
              ))}
            </div>
          </div>
        ))}
      </div>
    </div>
  </section>
);

export default TechStack;
