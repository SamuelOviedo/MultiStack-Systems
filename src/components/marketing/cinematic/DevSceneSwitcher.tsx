import type { CinematicSceneId } from "@/types/cinematic";

const SCENES: CinematicSceneId[] = ["hero", "agent", "automation"];

/**
 * DEV-only control to exercise the A/B crossfade before the scroll-driven
 * scene switching exists (F2). Rendered behind `import.meta.env.DEV`, so it
 * is dead-code-eliminated from production builds. Remove in F2.
 */
const DevSceneSwitcher = ({
  value,
  onChange,
}: {
  value: CinematicSceneId;
  onChange: (id: CinematicSceneId) => void;
}) => (
  <div
    role="group"
    aria-label="Escena cinemática (solo desarrollo)"
    style={{
      position: "fixed",
      left: "16px",
      bottom: "16px",
      zIndex: 60,
      display: "flex",
      gap: "4px",
      padding: "4px",
      borderRadius: "10px",
      background: "rgba(8,15,30,0.85)",
      border: "1px dashed rgba(245,158,11,0.6)",
      fontFamily: "'JetBrains Mono', monospace",
      fontSize: "11px",
    }}
  >
    <span style={{ color: "#f59e0b", padding: "6px 6px 6px 8px" }}>DEV</span>
    {SCENES.map((id) => (
      <button
        key={id}
        type="button"
        onClick={() => onChange(id)}
        aria-pressed={value === id}
        style={{
          padding: "6px 10px",
          borderRadius: "7px",
          border: "none",
          cursor: "pointer",
          color: value === id ? "#06121f" : "#94a3b8",
          background: value === id ? "#0ea5e9" : "transparent",
        }}
      >
        {id}
      </button>
    ))}
  </div>
);

export default DevSceneSwitcher;
