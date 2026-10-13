import { useEffect, useRef, type ReactNode } from "react";
import { useScroll, useSpring, type MotionValue } from "framer-motion";
import type { CinematicSceneId, ScrubSource } from "@/types/cinematic";

interface ScrollSceneProps {
  /** Anchor id (also observed by useActiveScene in Index). */
  id: string;
  sceneId: CinematicSceneId;
  label: string;
  /** Publishes this scene's smoothed progress so the backdrop can scrub its video. */
  onScrubSource?: (sceneId: CinematicSceneId, source: ScrubSource) => void;
  children: (progress: MotionValue<number>) => ReactNode;
}

/**
 * Tall section with a sticky, viewport-sized panel (desktop). Exposes a
 * spring-smoothed 0..1 progress: 0 when the section's top reaches mid-viewport,
 * 1 when its bottom reaches the viewport bottom. The same value drives the
 * floating copy and, for "scrub" scenes, the background video ("steady
 * gimbal"). On phones the CSS drops the sticky pin and the section flows
 * normally (see .ms-scene in index.css).
 */
const ScrollScene = ({ id, sceneId, label, onScrubSource, children }: ScrollSceneProps) => {
  const ref = useRef<HTMLElement>(null);
  const { scrollYProgress } = useScroll({ target: ref, offset: ["start 0.5", "end end"] });
  const progress = useSpring(scrollYProgress, { stiffness: 120, damping: 30, restDelta: 0.001 });

  useEffect(() => {
    onScrubSource?.(sceneId, progress);
  }, [onScrubSource, sceneId, progress]);

  return (
    <section ref={ref} id={id} aria-label={label} className="ms-scene">
      <div className="ms-scene-pin">
        <div className="ms-scene-inner">{children(progress)}</div>
      </div>
    </section>
  );
};

export default ScrollScene;
