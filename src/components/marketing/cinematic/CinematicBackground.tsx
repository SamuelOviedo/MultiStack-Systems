import { useEffect, useRef, useState } from "react";
import type { CinematicScene, CinematicSceneId } from "@/types/cinematic";
import { useAfterLoadIdle, useCinematicEnabled } from "@/hooks/useCinematicEnabled";

/** Max time a pending scene waits for its first video frame before crossfading on its poster. */
const VIDEO_WAIT_MS = 1200;
const MOBILE_QUERY = "(max-width: 768px)";

type Slot = 0 | 1;
type SlotPair<T> = [T, T];

let webmSupport: boolean | undefined;
function canPlayWebm(): boolean {
  if (webmSupport === undefined) {
    webmSupport = document.createElement("video").canPlayType('video/webm; codecs="vp9"') !== "";
  }
  return webmSupport;
}

const isMobileViewport = () =>
  typeof window.matchMedia === "function" && window.matchMedia(MOBILE_QUERY).matches;

interface SceneLayerProps {
  scene: CinematicScene;
  /** Front layer: on top, fully opaque (fades in when it takes over). */
  isFront: boolean;
  /** Hidden buffer preparing the next scene. */
  isPending: boolean;
  /** Layer may request its video (global gates passed + layer is front or pending). */
  loadVideo: boolean;
  playing: boolean;
  mobile: boolean;
  onReady: (id: CinematicSceneId) => void;
}

type VideoState = "loading" | "shown" | "failed";

/**
 * One buffer of the A/B pair. The poster <img> is always painted underneath;
 * the <video> sits on top at opacity 0 and is revealed only once a real frame
 * has been presented, so neither a black frame nor a src swap is ever visible.
 */
const SceneLayer = ({ scene, isFront, isPending, loadVideo, playing, mobile, onReady }: SceneLayerProps) => {
  const imgRef = useRef<HTMLImageElement>(null);
  const videoRef = useRef<HTMLVideoElement>(null);
  const [posterLoaded, setPosterLoaded] = useState(false);
  const [videoState, setVideoState] = useState<VideoState>("loading");
  const [waitExpired, setWaitExpired] = useState(false);

  const wantsVideo = loadVideo && scene.videoReady && videoState !== "failed";
  const sources = mobile ? scene.video.mobile : scene.video.desktop;
  const src = canPlayWebm() ? sources.webm : sources.mp4;

  // Cached posters can finish before React attaches onLoad.
  useEffect(() => {
    if (imgRef.current?.complete) setPosterLoaded(true);
  }, []);

  // Video mount: force muted state (React does not reflect `muted` as an
  // attribute, and iOS checks it for inline autoplay) + cap the wait.
  useEffect(() => {
    const el = videoRef.current;
    if (!wantsVideo || !el) return;
    el.muted = true;
    el.defaultMuted = true;
    el.setAttribute("muted", "");
    el.setAttribute("disableremoteplayback", "");
    const timer = window.setTimeout(() => setWaitExpired(true), VIDEO_WAIT_MS);
    return () => window.clearTimeout(timer);
  }, [wantsVideo]);

  useEffect(() => {
    const el = videoRef.current;
    if (!wantsVideo || !el) return;
    if (playing) {
      el.play().catch((err: DOMException) => {
        // Autoplay blocked / unsupported → keep the poster. AbortError just
        // means a pause() interrupted play(); not a failure.
        if (err.name === "NotAllowedError" || err.name === "NotSupportedError") {
          setVideoState((s) => (s === "shown" ? s : "failed"));
        }
      });
    } else {
      el.pause();
    }
  }, [playing, wantsVideo]);

  const reveal = () => {
    const el = videoRef.current;
    if (!el || videoState === "shown") return;
    if (typeof el.requestVideoFrameCallback === "function") {
      el.requestVideoFrameCallback(() => setVideoState("shown"));
    } else {
      setVideoState("shown");
    }
  };

  const ready =
    posterLoaded && (!wantsVideo || videoState !== "loading" || waitExpired);

  useEffect(() => {
    if (ready) onReady(scene.id);
  }, [ready, scene.id, onReady]);

  return (
    // Incoming layer fades in on top while the outgoing one stays opaque
    // underneath → no mid-crossfade brightness dip.
    <div
      className="ms-cine-layer"
      style={{ zIndex: isFront ? 2 : 1, opacity: isFront || !isPending ? 1 : 0 }}
    >
      <img
        ref={imgRef}
        className="ms-cine-media"
        src={scene.poster.desktop}
        srcSet={`${scene.poster.mobile} 1280w, ${scene.poster.desktop} 1920w`}
        sizes="100vw"
        width={1920}
        height={1080}
        alt=""
        decoding="async"
        draggable={false}
        onLoad={() => setPosterLoaded(true)}
        onError={() => setPosterLoaded(true)}
      />
      {wantsVideo && (
        <video
          ref={videoRef}
          className="ms-cine-media ms-cine-video"
          style={{ opacity: videoState === "shown" ? 1 : 0 }}
          src={src}
          muted
          playsInline
          loop={scene.mode === "loop"}
          preload="auto"
          disablePictureInPicture
          onPlaying={reveal}
          onError={() => setVideoState("failed")}
        />
      )}
    </div>
  );
};

interface CinematicBackgroundProps {
  scenes: CinematicScene[];
  activeSceneId: CinematicSceneId;
  /** Extra kill switch, AND-ed with reduced-motion / Save-Data detection. */
  enabled?: boolean;
}

/**
 * Cinematic "steady gimbal" backdrop (spec Parte B §4).
 *
 * - Fills its positioned parent; decorative (aria-hidden, no pointer events).
 * - Two permanent layers (A/B). A scene change loads into the hidden layer and
 *   crossfades only when that layer is ready → no flicker, no src swap on the
 *   visible element.
 * - No video byte is requested before `load` + idle, and never under reduced
 *   motion / Save-Data / 2g. Posters carry LCP.
 * - Plays only while on screen and the tab is visible.
 *
 * Scene mode "scrub" (scroll-driven currentTime) lands in F2; until then every
 * scene plays as a loop.
 */
const CinematicBackground = ({ scenes, activeSceneId, enabled = true }: CinematicBackgroundProps) => {
  const rootRef = useRef<HTMLDivElement>(null);
  const motionAllowed = useCinematicEnabled();
  const afterIdle = useAfterLoadIdle();
  const [mobile] = useState(isMobileViewport); // fixed at mount: never swap sources mid-session
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

  const videoAllowed = enabled && motionAllowed && afterIdle;
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
            loadVideo={videoAllowed && (isFront || isPending)}
            playing={(isFront || isPending) && inView && pageVisible}
            mobile={mobile}
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
