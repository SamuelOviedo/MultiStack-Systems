import { useEffect, useState } from "react";
import { useTheme } from "next-themes";

/**
 * MultiStack "Notion (light) + Kiro (dark)" design tokens.
 *
 * These are the EXACT raw-hex/rgba values from the Claude Design source
 * (MultiStack Systems.dc.html → renderVals). They are deliberately scoped to
 * the landing subtree (and the Navbar) via an inline CSS-variable map instead
 * of the global shadcn HSL tokens, because several names (`--primary`,
 * `--accent`, `--border`, `--muted`, `--success`, `--warning`) collide with the
 * shadcn HSL tokens the dashboard/auth screens rely on. Scoping keeps both
 * systems intact.
 */
export type MsTokens = Record<string, string>;

export const MS_DARK: MsTokens = {
  bg: "#080f1e",
  surface: "#0f1c35",
  "surface-2": "#0b1424",
  text: "#f0f6ff",
  text2: "#94a3b8",
  muted: "#64748b",
  primary: "#0ea5e9",
  accent: "#06b6d4",
  "primary-soft": "rgba(14,165,233,0.1)",
  "warning-soft": "rgba(245,158,11,0.1)",
  "success-soft": "rgba(16,185,129,0.1)",
  border: "#1e3a5f",
  "border-soft": "rgba(255,255,255,0.07)",
  "border-accent": "rgba(14,165,233,0.4)",
  "hover-bg": "rgba(255,255,255,0.05)",
  success: "#10b981",
  warning: "#f59e0b",
  danger: "#ef4444",
  "nav-bg": "rgba(8,15,30,0.65)",
  "chip-bg": "rgba(15,28,53,0.6)",
  "input-bg": "rgba(8,15,30,0.6)",
  "btn-primary-text": "#06121f",
  "track-bg2": "rgba(255,255,255,0.07)",
  overlay: "rgba(0,0,0,0.6)",
  "shadow-card": "0 1px 2px rgba(0,0,0,0.4)",
  "shadow-lift":
    "0 30px 80px -24px rgba(0,0,0,0.85), 0 0 50px rgba(14,165,233,0.07)",
  "glow-soft": "0 0 24px rgba(14,165,233,0.18)",
  "focus-ring": "0 0 0 3px rgba(14,165,233,0.18)",
  hairline: "rgba(255,255,255,0.08)",
  "glow-a": "radial-gradient(circle, rgba(14,165,233,0.18), transparent 70%)",
  "glow-b": "radial-gradient(circle, rgba(6,182,212,0.14), transparent 70%)",
  "glass-bg": "rgba(15,28,53,0.5)",
  "glass-blur": "blur(12px)",
  "page-bg":
    "radial-gradient(1000px 600px at 50% -5%, rgba(14,165,233,0.14), transparent 60%), radial-gradient(700px 500px at 88% 6%, rgba(6,182,212,0.08), transparent 55%), #080f1e",
  "grid-image":
    "linear-gradient(rgba(255,255,255,0.045) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,0.045) 1px, transparent 1px)",
  "grid-size": "46px 46px",
  "grid-mask": "radial-gradient(circle at 50% 28%, black, transparent 72%)",
  "btn-text": "#0ea5e9",
  "btn-bg": "rgba(14,165,233,0.09)",
  "btn-bg-hover": "rgba(14,165,233,0.18)",
  "btn-border": "rgba(14,165,233,0.32)",
  "btn-shadow": "0 0 0 1px rgba(14,165,233,0.16), 0 0 30px rgba(14,165,233,0.12)",
  "track-bg": "rgba(255,255,255,0.08)",
  "track-border": "rgba(255,255,255,0.12)",
  "knob-bg": "#0ea5e9",
  "knob-x": "27px",
  "knob-shadow": "0 0 14px rgba(14,165,233,0.65)",
  "sun-op": "0.3",
  "moon-op": "1",
};

export const MS_LIGHT: MsTokens = {
  bg: "#ffffff",
  surface: "#ffffff",
  "surface-2": "#f7f7f5",
  text: "#191919",
  text2: "#37352f",
  muted: "#9b9a97",
  primary: "#0284c7",
  accent: "#0891b2",
  "primary-soft": "rgba(2,132,199,0.08)",
  "warning-soft": "rgba(217,119,6,0.08)",
  "success-soft": "rgba(5,150,105,0.08)",
  border: "#e9e9e7",
  "border-soft": "#eeeeec",
  "border-accent": "rgba(2,132,199,0.32)",
  "hover-bg": "#f1f1ef",
  success: "#059669",
  warning: "#d97706",
  danger: "#dc2626",
  "nav-bg": "rgba(255,255,255,0.72)",
  "chip-bg": "#ffffff",
  "input-bg": "#ffffff",
  "btn-primary-text": "#ffffff",
  "track-bg2": "#e9e9e7",
  overlay: "rgba(0,0,0,0.4)",
  "shadow-card": "0 1px 2px rgba(15,15,15,0.05)",
  "shadow-lift":
    "0 1px 2px rgba(15,15,15,0.06), 0 24px 50px -20px rgba(15,15,15,0.22)",
  "glow-soft": "none",
  "focus-ring": "0 0 0 3px rgba(2,132,199,0.14)",
  hairline: "#eaeaea",
  "glow-a": "transparent",
  "glow-b": "transparent",
  "glass-bg": "#ffffff",
  "glass-blur": "blur(0px)",
  "page-bg":
    "radial-gradient(900px 620px at 50% -22%, rgba(2,132,199,0.06), transparent 55%), #ffffff",
  "grid-image": "radial-gradient(rgba(15,15,15,0.05) 1px, transparent 1px)",
  "grid-size": "24px 24px",
  "grid-mask": "radial-gradient(circle at 50% 22%, black, transparent 66%)",
  "btn-text": "#ffffff",
  "btn-bg": "#0284c7",
  "btn-bg-hover": "#0369a1",
  "btn-border": "#0284c7",
  "btn-shadow": "0 1px 2px rgba(15,15,15,0.1), 0 8px 22px -10px rgba(2,132,199,0.4)",
  "track-bg": "#e9e9e7",
  "track-border": "#dcdbd8",
  "knob-bg": "#ffffff",
  "knob-x": "2px",
  "knob-shadow": "0 1px 3px rgba(15,15,15,0.25)",
  "sun-op": "1",
  "moon-op": "0.3",
};

/** Turn a token map into an inline-style object of `--token` custom props. */
export function toCssVars(tokens: MsTokens): React.CSSProperties {
  const out: Record<string, string> = {};
  for (const [k, v] of Object.entries(tokens)) out[`--${k}`] = v;
  return out as React.CSSProperties;
}

/**
 * Returns the CSS-variable style object for the active theme. Guarded on
 * `mounted` to avoid a hydration/first-paint flash; defaults to dark (the app
 * default) before mount.
 */
export function useMsThemeVars(): React.CSSProperties {
  const [mounted, setMounted] = useState(false);
  const { resolvedTheme } = useTheme();
  useEffect(() => setMounted(true), []);
  const isLight = mounted && resolvedTheme === "light";
  return toCssVars(isLight ? MS_LIGHT : MS_DARK);
}
