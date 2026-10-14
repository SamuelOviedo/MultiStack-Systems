import { useTheme } from "next-themes";
import type { CinematicTheme } from "@/types/cinematic";

/**
 * Theme for the cinematic scenes. next-themes reads localStorage synchronously
 * in its state initializer, so this is already correct on the first client
 * render (no dark→light swap, no double download of the LCP frame).
 * Defaults to dark — the app default — when there is no provider (tests).
 */
export function useCinematicTheme(): CinematicTheme {
  const { resolvedTheme } = useTheme();
  return resolvedTheme === "light" ? "light" : "dark";
}
