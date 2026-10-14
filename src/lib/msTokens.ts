import { useEffect, useState } from "react";
import { useTheme } from "next-themes";
import type { CinematicTheme } from "@/types/cinematic";

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

/**
 * Tokens for the cinematic (image-sequence) landing scenes, one set per theme,
 * layered over MS_DARK / MS_LIGHT. `cine-` prefixed so they never shadow
 * global or shadcn variables. Each scene follows the active theme: its
 * imagery, scrims and text tokens switch together.
 */
export const MS_CINEMATIC_DARK: MsTokens = {
  // AA for 11px captions on dark glass over imagery (audit: MS_DARK's #64748b
  // measured 3.6:1). Still quieter than --text2 (#94a3b8).
  muted: "#7d8ca1",
  // Base scrim: lets the imagery breathe at the top, fades into --bg (#080f1e)
  // at the bottom so the scene meets the solid sections without a seam.
  "cine-scrim":
    "linear-gradient(180deg, rgba(8,15,30,0.35) 0%, rgba(8,15,30,0.15) 30%, rgba(8,15,30,0.65) 78%, #080f1e 100%)",
  // Behind left-aligned copy columns.
  "cine-scrim-side": "linear-gradient(90deg, rgba(8,15,30,0.85) 0%, rgba(8,15,30,0.5) 38%, rgba(8,15,30,0) 65%)",
  // Phones: the 16:9 frame is center-cropped behind full-width copy.
  "cine-scrim-mobile": "linear-gradient(180deg, rgba(8,15,30,0.45) 0%, rgba(8,15,30,0.7) 100%)",
  "cine-glass-bg": "rgba(15,28,53,0.55)",
  "cine-glass-bg-hover": "rgba(15,28,53,0.75)",
  "cine-glass-border": "rgba(14,165,233,0.22)",
  "cine-glass-blur": "blur(14px)",
  "cine-glow": "0 0 0 1px rgba(14,165,233,0.35), 0 10px 40px -8px rgba(14,165,233,0.55)",
  "cine-text-shadow": "0 2px 30px rgba(8,15,30,0.55)",
  "cine-card-shadow": "0 30px 80px -30px rgba(0,0,0,0.8)",
  "cine-bubble-bg": "rgba(255,255,255,0.06)",
  "cine-nav-bg": "rgba(8,15,30,0.3)",
};

export const MS_CINEMATIC_LIGHT: MsTokens = {
  // AA over light imagery (contrast vs #fff): MS_LIGHT's #0284c7 / #0891b2 /
  // #9b9a97 fall short for small text, so the scenes use one step darker.
  primary: "#0369a1", // 5.9:1
  accent: "#0e7490", // 5.4:1
  muted: "#64748b", // 4.8:1
  "btn-primary-text": "#ffffff", // on #0369a1: 5.9:1
  "cine-scrim":
    "linear-gradient(180deg, rgba(255,255,255,0.4) 0%, rgba(255,255,255,0.12) 30%, rgba(255,255,255,0.7) 78%, #ffffff 100%)",
  "cine-scrim-side":
    "linear-gradient(90deg, rgba(255,255,255,0.9) 0%, rgba(255,255,255,0.6) 38%, rgba(255,255,255,0) 65%)",
  "cine-scrim-mobile": "linear-gradient(180deg, rgba(255,255,255,0.6) 0%, rgba(255,255,255,0.82) 100%)",
  "cine-glass-bg": "rgba(255,255,255,0.7)",
  "cine-glass-bg-hover": "rgba(255,255,255,0.9)",
  "cine-glass-border": "rgba(3,105,161,0.2)",
  "cine-glass-blur": "blur(14px)",
  "cine-glow": "0 0 0 1px rgba(3,105,161,0.25), 0 10px 30px -10px rgba(3,105,161,0.45)",
  "cine-text-shadow": "0 1px 22px rgba(255,255,255,0.7)",
  "cine-card-shadow": "0 24px 60px -28px rgba(15,23,42,0.35)",
  "cine-bubble-bg": "rgba(15,23,42,0.05)",
  "cine-nav-bg": "rgba(255,255,255,0.5)",
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

const CINEMATIC_VARS_DARK = toCssVars({ ...MS_DARK, ...MS_CINEMATIC_DARK });
const CINEMATIC_VARS_LIGHT = toCssVars({ ...MS_LIGHT, ...MS_CINEMATIC_LIGHT });

/** CSS variables for a cinematic scene in the given theme (stable objects). */
export function cinematicVars(theme: CinematicTheme): React.CSSProperties {
  return theme === "light" ? CINEMATIC_VARS_LIGHT : CINEMATIC_VARS_DARK;
}

/** Raw token lookup for values used outside CSS (e.g. the Navbar overlay glass). */
export function cinematicToken(theme: CinematicTheme, key: string): string {
  return (theme === "light" ? MS_CINEMATIC_LIGHT : MS_CINEMATIC_DARK)[key];
}
