import { useEffect, useState } from "react";
import { useTheme } from "next-themes";
import { Moon, Sun } from "lucide-react";

/**
 * Dual-mode theme toggle — track + knob switch (Notion light ⟷ Kiro dark).
 * Gated on `mounted` to avoid hydration/first-paint flash.
 */
const ThemeToggle = () => {
  const [mounted, setMounted] = useState(false);
  const { theme, setTheme } = useTheme();

  useEffect(() => setMounted(true), []);

  if (!mounted) {
    // Reserve layout space; no icon until theme is resolved.
    return <span className="h-[29px] w-[56px] shrink-0" aria-hidden />;
  }

  const isDark = theme === "dark";

  return (
    <button
      type="button"
      onClick={() => setTheme(isDark ? "light" : "dark")}
      aria-label={isDark ? "Activar modo claro" : "Activar modo oscuro"}
      className="relative h-[29px] w-[56px] shrink-0 rounded-full border border-border bg-secondary/60 transition-colors"
    >
      <Sun
        className={`absolute left-[8px] top-1/2 h-3 w-3 -translate-y-1/2 transition-opacity ${
          isDark ? "opacity-30 text-muted-foreground" : "opacity-100 text-warning"
        }`}
      />
      <Moon
        className={`absolute right-[8px] top-1/2 h-3 w-3 -translate-y-1/2 transition-opacity ${
          isDark ? "opacity-100 text-primary" : "opacity-30 text-muted-foreground"
        }`}
      />
      <span
        className="absolute left-0 top-[3px] h-[21px] w-[21px] rounded-full bg-primary transition-transform duration-300 ease-[cubic-bezier(.4,1.3,.5,1)]"
        style={{
          transform: isDark ? "translateX(27px)" : "translateX(6px)",
          boxShadow: isDark ? "var(--glow-primary)" : "var(--glow-primary-light)",
        }}
      />
    </button>
  );
};

export default ThemeToggle;
