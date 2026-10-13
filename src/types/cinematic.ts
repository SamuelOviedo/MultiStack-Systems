export type CinematicSceneId = "hero" | "agent" | "automation";

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
