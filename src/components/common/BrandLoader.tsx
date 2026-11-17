import { cn } from "@/lib/utils";
import Logo, { type LogoVariant } from "@/components/common/Logo";

/**
 * Unified brand loading indicator: the official mark, pulsing. Theme-aware (the `dark` class on <html>) and quiet:
 * with reduced motion it stays still. The logo is the only accessible name, so no extra text is announced.
 * Use `variant="isotipo"` when the box is under 24 px tall (the lockup starts at 24 px).
 */
export default function BrandLoader({ className, variant }: { className?: string; variant?: LogoVariant }) {
  return <Logo priority variant={variant} className={cn("h-8 animate-pulse motion-reduce:animate-none", className)} />;
}
