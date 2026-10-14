import { useEffect, useState } from "react";

/**
 * Scroll-spy for in-page navigation: returns the id of the observed section
 * that crosses a reference line at `linePercent` of the viewport height, or
 * null when none does (e.g. the user is in a section that is not in `ids`).
 *
 * @param ids stable list of element ids, in document order
 * @param enabled observe only when true (e.g. only on the landing route)
 * @param linePercent position of the reference line, from the top (default 40%)
 */
export function useScrollSpy(ids: readonly string[], enabled = true, linePercent = 40): string | null {
  const [active, setActive] = useState<string | null>(null);

  useEffect(() => {
    if (!enabled || typeof IntersectionObserver === "undefined") {
      setActive(null);
      return;
    }
    const crossing = new Set<string>();
    const io = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          if (entry.isIntersecting) crossing.add(entry.target.id);
          else crossing.delete(entry.target.id);
        }
        setActive(ids.find((id) => crossing.has(id)) ?? null);
      },
      // ~1px band at linePercent of the viewport height.
      { rootMargin: `-${linePercent}% 0px -${99.9 - linePercent}% 0px` },
    );
    for (const id of ids) {
      const el = document.getElementById(id);
      if (el) io.observe(el);
    }
    return () => io.disconnect();
  }, [ids, enabled, linePercent]);

  return active;
}
