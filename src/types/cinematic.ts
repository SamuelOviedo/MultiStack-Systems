import type { MotionValue } from "framer-motion";

export type CinematicSceneId = "hero" | "agent" | "automation";

/**
 * loop: dynamic slideshow — frames crossfade on a timer, each with a slow
 *       Ken Burns camera move.
 * scrub: scroll progress drives the sequence (cumulative crossfade between
 *        frames) plus a subtle parallax.
 */
export type SceneMode = "loop" | "scrub";

/**
 * Smoothed 0..1 scroll progress that drives a "scrub" scene (the spring from
 * ScrollScene). Type-only import: no runtime cost in the entry chunk.
 */
export type ScrubSource = MotionValue<number>;

/** One frame of a sequence, in two widths (srcset 1280w / 1920w). */
export interface SceneImage {
  desktop: string;
  mobile: string;
}

export interface CinematicScene {
  id: CinematicSceneId;
  mode: SceneMode;
  /** Ordered .webp frames. images[0] is the static/LCP frame. */
  images: SceneImage[];
  scrim: "strong" | "side";
}
