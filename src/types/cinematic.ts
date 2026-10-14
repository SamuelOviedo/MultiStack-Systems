import type { MotionValue } from "framer-motion";

export type CinematicSceneId = "hero" | "agent" | "automation";

/** Theme a sequence was art-directed for (mirrors next-themes' resolvedTheme). */
export type CinematicTheme = "light" | "dark";

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

export interface CinematicScene {
  id: CinematicSceneId;
  mode: SceneMode;
  /**
   * Ordered .webp frames per theme. Both arrays should describe the same shots
   * (same length, same composition) so a theme switch reads as a lighting
   * change: the incoming theme resumes at the frame index currently on screen.
   */
  imagesLight: string[];
  imagesDark: string[];
  scrim: "strong" | "side";
}
