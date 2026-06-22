import { cn } from "@/lib/utils";

/**
 * MultiStack brand mark — three stacked isometric layers (Claude Design).
 * Pure SVG so it is crisp at any size and theme-aware: it reads the
 * --primary / --accent design tokens when rendered inside the MS design
 * scope, and falls back to the brand hex elsewhere. Sized by height via
 * `className` (e.g. `h-7`); the viewBox is square so width auto-tracks.
 */
const Logo = ({ className, alt = "MultiStack Systems Logo" }: { className?: string; alt?: string }) => (
  <svg
    viewBox="0 0 32 32"
    fill="none"
    role="img"
    aria-label={alt}
    className={cn("w-auto shrink-0", className)}
  >
    <path d="M4 7 L16 13 L28 7 L16 1 Z" fill="var(--primary,#0ea5e9)" />
    <path d="M4 14.5 L16 20.5 L28 14.5 L16 8.5 Z" fill="var(--accent,#06b6d4)" opacity="0.8" />
    <path d="M4 22 L16 28 L28 22 L16 16 Z" fill="var(--primary,#0ea5e9)" opacity="0.5" />
  </svg>
);

export default Logo;
