import { cn } from "@/lib/utils";

/**
 * Unified brand loading indicator — replaces the legacy Terminal-icon pulse.
 * Always renders the white logo (every app surface is dark terminal-themed).
 */
export default function BrandLoader({ className }: { className?: string }) {
  return (
    <img
      src="/logo-white.png"
      alt="MultiStack Systems Logo"
      className={cn("h-8 w-auto object-contain animate-pulse", className)}
    />
  );
}
