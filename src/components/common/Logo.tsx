import { cn } from "@/lib/utils";

/**
 * MultiStack brand mark — the official logo asset.
 * Theme-aware: the white mark (logo-white.png) shows on dark UI and the
 * black mark (logo-black.png) on light UI, driven by the `dark` class on
 * <html> (Tailwind class strategy). Sized by height via `className`
 * (e.g. `h-7`); width auto-tracks the asset's aspect ratio.
 */
const Logo = ({ className, alt = "MultiStack Systems Logo" }: { className?: string; alt?: string }) => (
  <span className={cn("inline-flex w-auto shrink-0", className)}>
    <img
      src="/logo-white.png"
      alt={alt}
      className="hidden h-full w-auto object-contain dark:block"
    />
    <img
      src="/logo-black.png"
      alt=""
      aria-hidden="true"
      className="block h-full w-auto object-contain dark:hidden"
    />
  </span>
);

export default Logo;
