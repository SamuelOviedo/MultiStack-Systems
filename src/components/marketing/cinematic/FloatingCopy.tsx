import { useRef, useState, type CSSProperties, type ReactNode } from "react";
import { m, useReducedMotion, useScroll, useTransform, type MotionValue } from "framer-motion";

/** Must match the media query where .ms-scene drops its sticky pin (index.css). */
const STACKED_QUERY = "(max-width: 1023px), (max-height: 620px)";
/** Fraction of scene progress a block takes to fully appear. */
const APPEAR_SPAN = 0.12;

const isStackedViewport = () =>
  typeof window.matchMedia === "function" && window.matchMedia(STACKED_QUERY).matches;

interface FloatingCopyProps {
  /** Scene progress from ScrollScene. */
  progress: MotionValue<number>;
  /** Scene progress (0..1) at which this block starts to appear. */
  appearAt: number;
  className?: string;
  style?: CSSProperties;
  children: ReactNode;
}

/**
 * Text/card block that rises into place in sync with its scene's scroll
 * progress and then holds. Only opacity + transform (compositor-only).
 * - Stacked layouts (no sticky pin): driven by the block's own position in the viewport.
 * - Reduced motion: rendered static and fully visible.
 */
const FloatingCopy = ({ progress, appearAt, className, style, children }: FloatingCopyProps) => {
  const ref = useRef<HTMLDivElement>(null);
  const reduce = useReducedMotion();
  const [stacked] = useState(isStackedViewport);
  const { scrollYProgress: own } = useScroll({ target: ref, offset: ["start 0.95", "start 0.65"] });

  const source = stacked ? own : progress;
  const range = stacked ? [0, 1] : [appearAt, appearAt + APPEAR_SPAN];
  const opacity = useTransform(source, range, [0, 1]);
  const y = useTransform(source, range, [28, 0]);

  if (reduce) {
    return (
      <div ref={ref} className={className} style={style}>
        {children}
      </div>
    );
  }
  return (
    <m.div ref={ref} className={className} style={{ ...style, opacity, y }}>
      {children}
    </m.div>
  );
};

export default FloatingCopy;
