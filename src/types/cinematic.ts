import type { MotionValue } from "framer-motion";

export type CinematicSceneId = "hero" | "agent" | "automation";

/**
 * Smoothed 0..1 scroll progress that drives a "scrub" scene. Structural subset
 * of a framer-motion MotionValue (type-only import: no runtime cost in the
 * entry chunk that hosts CinematicBackground).
 */
export type ScrubSource = Pick<MotionValue<number>, "get" | "on">;

/** loop: continuous playback · scrub: playback position follows scroll (F2). */
export type SceneMode = "loop" | "scrub";

export interface SceneSources {
  webm: string;
  mp4: string;
}

export interface CinematicScene {
  id: CinematicSceneId;
  mode: SceneMode;
  /** false while the real video is not in public/assets yet: poster only, zero video requests. */
  videoReady: boolean;
  video: { desktop: SceneSources; mobile: SceneSources };
  /** Exact first frame of the video, .webp (spec FR-004). */
  poster: { desktop: string; mobile: string };
  scrim: "strong" | "side";
}
