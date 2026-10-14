import { lazy, Suspense, useEffect, useRef, useState } from "react";
import type { CinematicScene, CinematicSceneId, ScrubSource } from "@/types/cinematic";
import { imageSrcSet } from "@/lib/cinematicScenes";
import { useAfterLoadIdle, useCinematicEnabled } from "@/hooks/useCinematicEnabled";

// Ken Burns / slideshow / scrub (framer-motion) live in a lazy chunk shared
// with CinematicChapters: this component sits in the entry chunk that
// /dashboard also loads.
const AnimatedSequence = lazy(() => import("./AnimatedSequence"));

type Slot = 0 | 1;
type SlotPair<T> = [T, T];

interface SceneLayerProps {
  scene: CinematicScene;
  /** Front layer: on top, fully opaque (fades in when it takes over). */
  isFront: boolean;
  /** Hidden buffer preparing the next scene. */
  isPending: boolean;
  /** Mount the animated sequence (motion allowed + after load/idle + front or pending). */
  animate: boolean;
  playing: boolean;
  scrub?: ScrubSource;
  onReady: (id: CinematicSceneId) => void;
}

/**
 * One buffer of the A/B pair. The scene's first frame is a plain <img>
 * (instant, LCP-friendly, the whole experience under reduced motion); the
 * animated sequence mounts on top of it when allowed. The layer reports ready
 * once that first frame is decoded, so a scene change never reveals a
 * half-painted image.
 */
const SceneLayer = ({ scene, isFront, isPending, animate, playing, scrub, onReady }: SceneLayerProps) => {
  const imgRef = useRef<HTMLImageElement>(null);
  const [ready, setReady] = useState(false);
  const first = scene.images[0];

  useEffect(() => {
    const img = imgRef.current;
    if (!img) return;
    let cancelled = false;
    const markReady = () => {
      if (!cancelled) setReady(true);
    };
    // decode() resolves once the bitmap can be painted (immediately if cached).
    const decodeThenReady = () => {
      if (typeof img.decode === "function") img.decode().then(markReady, markReady);
      else markReady();
    };
    if (img.complete) decodeThenReady();
    else img.addEventListener("load", decodeThenReady, { once: true });
    img.addEventListener("error", markReady, { once: true });
    return () => {
      cancelled = true;
      img.removeEventListener("load", decodeThenReady);
      img.removeEventListener("error", markReady);
    };
  }, []);

  useEffect(() => {
    if (ready) onReady(scene.id);
  }, [ready, scene.id, onReady]);

  return (
    // Incoming layer fades in on top while the outgoing one stays opaque
    // underneath → no mid-crossfade brightness dip.
    <div className="ms-cine-layer" style={{ zIndex: isFront ? 2 : 1, opacity: isFront || !isPending ? 1 : 0 }}>
      <img
        ref={imgRef}
        className="ms-cine-media"
        src={first.desktop}
        srcSet={imageSrcSet(first)}
        sizes="100vw"
        width={1920}
        height={1080}
        alt=""
        decoding="async"
        draggable={false}
      />
      {animate && (
        <Suspense fallback={null}>
          <AnimatedSequence scene={scene} playing={playing} scrub={scrub} />
        </Suspense>
      )}
    </div>
  );
};

interface CinematicBackgroundProps {
  scenes: CinematicScene[];
  activeSceneId: CinematicSceneId;
  /** Extra kill switch, AND-ed with reduced-motion / Save-Data detection. */
  enabled?: boolean;
  /** Progress sources for scenes in "scrub" mode, keyed by scene id. */
  scrubSources?: Partial<Record<CinematicSceneId, ScrubSource>>;
}

/**
 * Cinematic "steady gimbal" backdrop built from .webp image sequences.
 *
 * - Fills its positioned parent; decorative (aria-hidden, no pointer events).
 * - Two permanent layers (A/B). A scene change loads into the hidden layer and
 *   crossfades only when its first frame is decoded.
 * - Animation (Ken Burns slideshow / scroll scrub + parallax) is lazy and
 *   starts only after `load` + idle; never under reduced motion / Save-Data /
 *   2g, where the static first frame is the whole experience.
 * - Advances only while on screen and the tab is visible.
 */
const CinematicBackground = ({
  scenes,
  activeSceneId,
  enabled = true,
  scrubSources,
}: CinematicBackgroundProps) => {
  const rootRef = useRef<HTMLDivElement>(null);
  const motionAllowed = useCinematicEnabled();
  const afterIdle = useAfterLoadIdle();
  const [inView, setInView] = useState(true);
  const [pageVisible, setPageVisible] = useState(() => document.visibilityState !== "hidden");

  const [slots, setSlots] = useState<SlotPair<CinematicSceneId | null>>([activeSceneId, null]);
  const [readyIds, setReadyIds] = useState<SlotPair<CinematicSceneId | null>>([null, null]);
  const [front, setFront] = useState<Slot>(0);
  const back: Slot = front === 0 ? 1 : 0;

  // Queue a new active scene into the hidden buffer.
  useEffect(() => {
    if (slots[front] === activeSceneId || slots[back] === activeSceneId) return;
    setReadyIds((prev) => {
      const next: SlotPair<CinematicSceneId | null> = [...prev];
      next[back] = null;
      return next;
    });
    setSlots((prev) => {
      const next: SlotPair<CinematicSceneId | null> = [...prev];
      next[back] = activeSceneId;
      return next;
    });
  }, [activeSceneId, slots, front, back]);

  // Swap buffers once the pending scene is ready and still the one we want.
  useEffect(() => {
    if (slots[back] === activeSceneId && readyIds[back] === activeSceneId) setFront(back);
  }, [slots, readyIds, back, activeSceneId]);

  useEffect(() => {
    const el = rootRef.current;
    if (!el || typeof IntersectionObserver === "undefined") return;
    const io = new IntersectionObserver(([entry]) => setInView(entry.isIntersecting));
    io.observe(el);
    return () => io.disconnect();
  }, []);

  useEffect(() => {
    const onVisibility = () => setPageVisible(document.visibilityState !== "hidden");
    document.addEventListener("visibilitychange", onVisibility);
    return () => document.removeEventListener("visibilitychange", onVisibility);
  }, []);

  const readyHandlers = useRef<SlotPair<(id: CinematicSceneId) => void>>([
    (id) => setReadyIds((prev) => [id, prev[1]]),
    (id) => setReadyIds((prev) => [prev[0], id]),
  ]).current;

  const animationAllowed = enabled && motionAllowed && afterIdle;
  const activeScene = scenes.find((s) => s.id === slots[front]);

  return (
    <div ref={rootRef} className="ms-cine-bg" aria-hidden="true">
      {([0, 1] as const).map((slot) => {
        const id = slots[slot];
        const scene = id ? scenes.find((s) => s.id === id) : undefined;
        if (!scene) return null;
        const isFront = slot === front;
        const isPending = !isFront && id === activeSceneId;
        return (
          <SceneLayer
            key={`${slot}-${scene.id}`}
            scene={scene}
            isFront={isFront}
            isPending={isPending}
            animate={animationAllowed && (isFront || isPending)}
            playing={(isFront || isPending) && inView && pageVisible}
            scrub={scrubSources?.[scene.id]}
            onReady={readyHandlers[slot]}
          />
        );
      })}
      <div className="ms-cine-scrim" />
      <div className="ms-cine-scrim-side" style={{ opacity: activeScene?.scrim === "side" ? 1 : 0 }} />
    </div>
  );
};

export default CinematicBackground;
