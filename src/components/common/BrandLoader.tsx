import { cn } from "@/lib/utils";
import Logo from "@/components/common/Logo";

/**
 * Unified brand loading indicator — theme-aware pulsing logo
 * (white on dark, black on light).
 */
export default function BrandLoader({ className }: { className?: string }) {
  return <Logo className={cn("h-8 animate-pulse", className)} />;
}
