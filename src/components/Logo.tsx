import { useEffect, useState } from "react";
import { useTheme } from "next-themes";
import { cn } from "@/lib/utils";

/**
 * Theme-aware logo. `logo-white.png` is invisible on white, so light mode
 * swaps to `logo-black.png`. Defaults to the white logo before mount
 * (app default theme is dark) to avoid a flash.
 */
const Logo = ({ className, alt = "MultiStack Systems Logo" }: { className?: string; alt?: string }) => {
  const [mounted, setMounted] = useState(false);
  const { resolvedTheme } = useTheme();
  useEffect(() => setMounted(true), []);

  const src = mounted && resolvedTheme === "light" ? "/logo-black.png" : "/logo-white.png";

  return <img src={src} alt={alt} className={cn("w-auto object-contain shrink-0", className)} />;
};

export default Logo;
