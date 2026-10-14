import { lazy, Suspense, useCallback, useEffect, useRef, useState } from "react";
import type { CinematicScene, CinematicSceneId, CinematicTheme, ScrubSource } from "@/types/cinematic";
import { sceneImages } from "@/lib/cinematicScenes";
import { cinematicVars } from "@/lib/msTokens";
import { preloadImage } from "@/lib/preloadImage";
import { isConstrainedNetwork, useAfterLoadIdle, useCinematicEnabled } from "@/hooks/useCinematicEnabled";
import { useCinematicTheme } from "@/hooks/useCinematicTheme";

// Ken Burns / slideshow / scrub (framer-motion) live in a lazy chunk shared
// with CinematicChapters: this component sits in the entry chunk that
// /dashboard also loads.
const AnimatedSequence = lazy(() => import("./AnimatedSequence"));

type Slot = 0 | 1;
type SlotPair<T> = [T, T];

/** What a buffer shows: a scene, in a theme, resuming at a frame. */
interface LayerSpec {
  key: string;
  sceneId: CinematicSceneId;
  theme: CinematicTheme;
  startIndex: number;
}

const layerKey = (sceneId: CinematicSceneId, theme: CinematicTheme) => `${sceneId}:${theme}`;

interface SceneLayerProps {
  spec: LayerSpec;
  scene: CinematicScene;
  /** Front layer: on top, fully opaque (fades in when it takes over). */
  isFront: boolean;
  /** Hidden buffer preparing the next scene or theme. */
  isPending: boolean;
  /**
   * Mount the animated sequence (motion allowed + after load/idle). Stays
   * mounted on the outgoing layer too, paused: unmounting it mid-crossfade
   * would reveal the static frame 1 underneath (a visible jump).
   */
  animate: boolean;
  playing: boolean;
  scrub?: ScrubSource;
  onReady: (key: string) => void;
  onFrameReport: (sceneId: CinematicSceneId, index: number) => void;
}

/**
 * One buffer of the A/B pair, bound to ONE theme: its frames, its scrims and
 * its token values switch together, so a theme change crossfades the whole
 * look (image + scrim) instead of snapping the scrim over the old image.
 * The static frame is instant/LCP-friendly and is the whole experience under
 * reduced motion; the animated sequence mounts on top when allowed. Ready =
 * that static frame is decoded.
 */
const SceneLayer = ({
  spec,
  scene,
  isFront,
  isPending,
  animate,
  playing,
  scrub,
  onReady,
  onFrameReport,
}: SceneLayerProps) => {
  const imgRef = useRef<HTMLImageElement>(null);
  const [ready, setReady] = useState(false);
  const currentImages = sceneImages(scene, spec.theme);
  const startIndex = scene.mode === "loop" ? spec.startIndex % currentImages.length : 0;

  useEffect(() => {
    const img = imgRef.current;
    if (!img) return;
    let cancelled = false;
    let frame = 0;
    // Two frames after decode: guarantees the hidden (opacity 0) state was
    // painted, so promoting this layer to front always runs the CSS crossfade
    // instead of popping in when the frame came straight from cache.
    const markReady = () => {
      if (cancelled || frame) return;
      frame = requestAnimationFrame(() => {
        frame = requestAnimationFrame(() => {
          if (!cancelled) setReady(true);
        });
      });
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
      cancelAnimationFrame(frame);
      img.removeEventListener("load", decodeThenReady);
      img.removeEventListener("error", markReady);
    };
  }, []);

  useEffect(() => {
    if (ready) onReady(spec.key);
  }, [ready, spec.key, onReady]);

  const reportFrame = useCallback((index: number) => onFrameReport(scene.id, index), [onFrameReport, scene.id]);

  return (
    // Incoming layer fades in on top while the outgoing one stays opaque
    // underneath → no mid-crossfade brightness dip.
    <div
      className="ms-cine-layer"
      data-theme={spec.theme}
      style={{ ...cinematicVars(spec.theme), zIndex: isFront ? 2 : 1, opacity: isFront || !isPending ? 1 : 0 }}
    >
      <img
        ref={imgRef}
        className="ms-cine-media"
        src={currentImages[startIndex]}
        width={1920}
        height={1080}
        alt=""
        decoding="async"
        draggable={false}
      />
      {animate && (
        <Suspense fallback={null}>
          <AnimatedSequence
            images={currentImages}
            mode={scene.mode}
            playing={playing}
            scrub={scrub}
            startIndex={startIndex}
            onFrameChange={isFront ? reportFrame : undefined}
          />
        </Suspense>
      )}
      <div className="ms-cine-scrim" />
      {scene.scrim === "side" && <div className="ms-cine-scrim-side" />}
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
 * Cinematic "steady gimbal" backdrop built from theme-aware .webp sequences.
 *
 * - Fills its positioned parent; decorative (aria-hidden, no pointer events).
 * - Two permanent layers (A/B) keyed by scene + theme. A scene change OR a
 *   theme change loads into the hidden layer and crossfades (0.8s) only once
 *   its frame is decoded → never a blank or half-painted frame. On a theme
 *   change the new layer resumes the frame on screen (same shot, new light).
 * - After `load` + idle (and not on Save-Data) the opposite theme's frame for
 *   the shot on screen is preloaded, so the Navbar theme switch is instant.
 * - Animation (Ken Burns slideshow / scroll scrub + parallax) is lazy and
 *   never runs under reduced motion / Save-Data / 2g.
 * - Advances only while on screen and the tab is visible.
 */
const CinematicBackground = ({
  scenes,
  activeSceneId,
  enabled = true,
  scrubSources,
}: CinematicBackgroundProps) => {
  const rootRef = useRef<HTMLDivElement>(null);
  const theme = useCinematicTheme();
  const motionAllowed = useCinematicEnabled();
  const afterIdle = useAfterLoadIdle();
  const [inView, setInView] = useState(true);
  const [pageVisible, setPageVisible] = useState(() => document.visibilityState !== "hidden");
  const [frameIndex, setFrameIndex] = useState<Partial<Record<CinematicSceneId, number>>>({});

  const activeKey = layerKey(activeSceneId, theme);
  const [slots, setSlots] = useState<SlotPair<LayerSpec | null>>(() => [
    { key: activeKey, sceneId: activeSceneId, theme, startIndex: 0 },
    null,
  ]);
  const [readyKeys, setReadyKeys] = useState<SlotPair<string | null>>([null, null]);
  const [front, setFront] = useState<Slot>(0);
  const back: Slot = front === 0 ? 1 : 0;

  // Queue the active scene/theme into the hidden buffer.
  useEffect(() => {
    if (slots[front]?.key === activeKey || slots[back]?.key === activeKey) return;
    // Theme change on the same scene → keep the shot; new scene → its first frame.
    const sameScene = slots[front]?.sceneId === activeSceneId;
    const startIndex = sameScene ? (frameIndex[activeSceneId] ?? 0) : 0;
    if (!sameScene) setFrameIndex((prev) => ({ ...prev, [activeSceneId]: 0 }));
    setReadyKeys((prev) => {
      const next: SlotPair<string | null> = [...prev];
      next[back] = null;
      return next;
    });
    setSlots((prev) => {
      const next: SlotPair<LayerSpec | null> = [...prev];
      next[back] = { key: activeKey, sceneId: activeSceneId, theme, startIndex };
      return next;
    });
  }, [activeKey, activeSceneId, theme, slots, front, back, frameIndex]);

  // Swap buffers once the pending layer is ready and still the one we want.
  useEffect(() => {
    if (slots[back]?.key === activeKey && readyKeys[back] === activeKey) setFront(back);
  }, [slots, readyKeys, back, activeKey]);

  // Silent preload: the opposite theme's version of the frame on screen.
  const shownIndex = frameIndex[activeSceneId] ?? 0;
  useEffect(() => {
    if (!afterIdle || isConstrainedNetwork()) return;
    const scene = scenes.find((s) => s.id === activeSceneId);
    if (!scene) return;
    const opposite = sceneImages(scene, theme === "light" ? "dark" : "light");
    void preloadImage(opposite[shownIndex % opposite.length]);
  }, [afterIdle, scenes, activeSceneId, theme, shownIndex]);

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

  const readyHandlers = useRef<SlotPair<(key: string) => void>>([
    (key) => setReadyKeys((prev) => [key, prev[1]]),
    (key) => setReadyKeys((prev) => [prev[0], key]),
  ]).current;

  const handleFrameReport = useCallback((sceneId: CinematicSceneId, index: number) => {
    setFrameIndex((prev) => (prev[sceneId] === index ? prev : { ...prev, [sceneId]: index }));
  }, []);

  const animationAllowed = enabled && motionAllowed && afterIdle;

  return (
    <div ref={rootRef} className="ms-cine-bg" aria-hidden="true">
      {([0, 1] as const).map((slot) => {
        const spec = slots[slot];
        const scene = spec ? scenes.find((s) => s.id === spec.sceneId) : undefined;
        if (!spec || !scene) return null;
        const isFront = slot === front;
        const isPending = !isFront && spec.key === activeKey;
        return (
          <SceneLayer
            key={`${slot}-${spec.key}`}
            spec={spec}
            scene={scene}
            isFront={isFront}
            isPending={isPending}
            animate={animationAllowed}
            playing={(isFront || isPending) && inView && pageVisible}
            scrub={scrubSources?.[scene.id]}
            onReady={readyHandlers[slot]}
            onFrameReport={handleFrameReport}
          />
        );
      })}
    </div>
  );
};

export default CinematicBackground;
