import { useEffect, useState } from "react";
import type { CinematicSceneId } from "@/types/cinematic";

/**
 * Scroll-spy for the cinematic backdrop: the active scene is the one whose
 * section crosses the viewport's horizontal midline. Plain IntersectionObserver
 * (no animation library) so it can live in the eager landing chunk.
 *
 * @param sections stable map of section element id → scene id
 * @param refreshKey change it to re-observe once lazy sections have mounted
 */
export function useActiveScene(
  sections: Readonly<Record<string, CinematicSceneId>>,
  refreshKey?: unknown,
): CinematicSceneId {
  const [active, setActive] = useState<CinematicSceneId>(() => Object.values(sections)[0]);

  useEffect(() => {
    if (typeof IntersectionObserver === "undefined") return;
    const io = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          const scene = sections[entry.target.id];
          if (entry.isIntersecting && scene) setActive(scene);
        }
      },
      // 1px-tall band at the vertical center of the viewport.
      { rootMargin: "-50% 0px -49.9% 0px" },
    );
    for (const id of Object.keys(sections)) {
      const el = document.getElementById(id);
      if (el) io.observe(el);
    }
    return () => io.disconnect();
  }, [sections, refreshKey]);

  return active;
}
