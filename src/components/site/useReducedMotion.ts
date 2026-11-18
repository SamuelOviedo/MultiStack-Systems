import { useEffect, useState } from "react";

const QUERY = "(prefers-reduced-motion: reduce)";

const matches = (): boolean => typeof window !== "undefined" && typeof window.matchMedia === "function" && window.matchMedia(QUERY).matches;

/** `true` mientras la persona pida movimiento reducido; reacciona si lo cambia con la página abierta. */
export function useReducedMotion(): boolean {
  const [reduced, setReduced] = useState(matches);

  useEffect(() => {
    if (typeof window.matchMedia !== "function") return;
    const list = window.matchMedia(QUERY);
    const onChange = () => setReduced(list.matches);
    onChange();
    list.addEventListener("change", onChange);
    return () => list.removeEventListener("change", onChange);
  }, []);

  return reduced;
}
