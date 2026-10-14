import { useEffect, useState } from "react";
import { LazyMotion, m, useTransform, type MotionValue } from "framer-motion";
import { preloadImage } from "@/lib/preloadImage";
import type { SceneMode } from "@/types/cinematic";

const loadMotionFeatures = () => import("./motionFeatures").then((mod) => mod.default);

/** Time each frame stays on screen before the next one starts to fade in. */
const FRAME_MS = 6500;
/** Crossfade between frames of the same scene. */
const CROSSFADE_MS = 1400;
/** Ken Burns runs across the whole visible life of a frame (hold + fade-out). */
const KEN_BURNS_S = (FRAME_MS + CROSSFADE_MS) / 1000;

/**
 * Camera moves, cycled per frame: slow push-ins and one pull-out, small pans.
 * Translations stay inside the extra margin given by the scale, so edges never
 * show. `transform` strings (not x/scale) let framer-motion hand the animation
 * to WAAPI → runs on the compositor, off the main thread.
 */
const KEN_BURNS = [
  { from: "scale(1) translate(0%, 0%)", to: "scale(1.06) translate(-1.5%, -1%)" },
  { from: "scale(1.06) translate(1.5%, 0.5%)", to: "scale(1.01) translate(0%, 0%)" },
  { from: "scale(1.01) translate(0%, 1%)", to: "scale(1.06) translate(1.5%, -1%)" },
];

const KenBurnsFrame = ({ src, index, onTop }: { src: string; index: number; onTop: boolean }) => {
  const kb = KEN_BURNS[index % KEN_BURNS.length];
  return (
    <m.img
      className="ms-cine-media"
      src={src}
      alt=""
      draggable={false}
      style={{ zIndex: onTop ? 2 : 1 }}
      initial={{ opacity: 0, transform: kb.from }}
      animate={{ opacity: 1, transform: kb.to }}
      transition={{
        opacity: { duration: CROSSFADE_MS / 1000, ease: "easeOut" },
        transform: { duration: KEN_BURNS_S, ease: "linear" },
      }}
    />
  );
};

interface LoopSequenceProps {
  images: string[];
  playing: boolean;
  startIndex: number;
  onFrameChange?: (index: number) => void;
}

/**
 * Dynamic slideshow with an internal double buffer: the outgoing frame stays
 * fully opaque underneath while the next one (already decoded) fades in on
 * top, so there is no brightness dip. Advances only while `playing`.
 */
const LoopSequence = ({ images, playing, startIndex, onFrameChange }: LoopSequenceProps) => {
  const count = images.length;
  const [current, setCurrent] = useState(() => startIndex % count);
  const [previous, setPrevious] = useState<number | null>(null);

  useEffect(() => {
    onFrameChange?.(current);
  }, [current, onFrameChange]);

  useEffect(() => {
    if (!playing || count < 2) return;
    let cancelled = false;
    let timer: number | undefined;
    const next = (current + 1) % count;
    const startedAt = performance.now();
    preloadImage(images[next]).then(() => {
      if (cancelled) return;
      const wait = Math.max(0, FRAME_MS - (performance.now() - startedAt));
      timer = window.setTimeout(() => {
        setPrevious(current);
        setCurrent(next);
      }, wait);
    });
    return () => {
      cancelled = true;
      window.clearTimeout(timer);
    };
  }, [current, playing, count, images]);

  // Drop the outgoing frame once it is fully covered.
  useEffect(() => {
    if (previous === null) return;
    const timer = window.setTimeout(() => setPrevious(null), CROSSFADE_MS + 100);
    return () => window.clearTimeout(timer);
  }, [previous]);

  return (
    <>
      {previous !== null && (
        <KenBurnsFrame key={`frame-${previous}`} src={images[previous]} index={previous} onTop={false} />
      )}
      <KenBurnsFrame key={`frame-${current}`} src={images[current]} index={current} onTop />
    </>
  );
};

/**
 * Frame i fades in on top of frames < i as progress crosses its slot; earlier
 * frames stay opaque (cumulative crossfade → no brightness dip when scrubbing
 * backwards or forwards).
 */
const ScrubFrame = ({
  src,
  index,
  count,
  progress,
}: {
  src: string;
  index: number;
  count: number;
  progress: MotionValue<number>;
}) => {
  const opacity = useTransform(progress, (p) =>
    index === 0 ? 1 : Math.min(1, Math.max(0, p * (count - 1) - (index - 1))),
  );
  return <m.img className="ms-cine-media" src={src} alt="" draggable={false} style={{ opacity }} />;
};

/** Scroll-driven sequence + parallax ("steady gimbal"); the spring smoothing comes from ScrollScene. */
const ScrubSequence = ({ images, progress }: { images: string[]; progress: MotionValue<number> }) => {
  const y = useTransform(progress, [0, 1], ["2.5%", "-2.5%"]);
  return (
    // Scaled up so the parallax travel never reveals the edges.
    <m.div className="ms-cine-media" style={{ y, scale: 1.08 }}>
      {images.map((src, i) => (
        <ScrubFrame key={src} src={src} index={i} count={images.length} progress={progress} />
      ))}
    </m.div>
  );
};

interface AnimatedSequenceProps {
  /** Frames for the layer's theme (already resolved by CinematicBackground). */
  images: string[];
  mode: SceneMode;
  playing: boolean;
  scrub?: MotionValue<number>;
  /** Loop mode: frame to resume at (keeps the shot when the theme changes). */
  startIndex?: number;
  /** Loop mode: reports the frame on screen. */
  onFrameChange?: (index: number) => void;
}

/**
 * Animated layer of a cinematic scene, lazy-loaded by CinematicBackground once
 * motion is allowed (after `load` + idle; never under reduced motion /
 * Save-Data). It paints over the static frame, which keeps carrying LCP.
 * Shares the framer-motion chunk with CinematicChapters, so /dashboard pays 0.
 */
const AnimatedSequence = ({ images, mode, playing, scrub, startIndex = 0, onFrameChange }: AnimatedSequenceProps) => (
  <LazyMotion features={loadMotionFeatures} strict>
    {mode === "scrub" && scrub ? (
      <ScrubSequence images={images} progress={scrub} />
    ) : (
      <LoopSequence images={images} playing={playing} startIndex={startIndex} onFrameChange={onFrameChange} />
    )}
  </LazyMotion>
);

export default AnimatedSequence;
