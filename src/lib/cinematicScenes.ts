import type { CinematicScene, CinematicSceneId, SceneMode } from "@/types/cinematic";

/**
 * Single source of truth for cinematic asset paths. Components never
 * hardcode /assets/... URLs.
 *
 * Naming: public/assets/video/<scene>/<scene>.<1080|720>.<webm|mp4>
 *         public/assets/posters/<scene>.<1080|720>.webp
 *
 * To activate a scene's video: drop its 4 files in place and flip
 * `videoReady` to true. Until then only the poster renders (no 404s).
 *
 * NOTE: the hero poster paths are duplicated in the preload script of
 * index.html. Keep both in sync.
 */
const scene = (
  id: CinematicSceneId,
  mode: SceneMode,
  scrim: CinematicScene["scrim"],
  videoReady: boolean,
): CinematicScene => ({
  id,
  mode,
  scrim,
  videoReady,
  video: {
    desktop: {
      webm: `/assets/video/${id}/${id}.1080.webm`,
      mp4: `/assets/video/${id}/${id}.1080.mp4`,
    },
    mobile: {
      webm: `/assets/video/${id}/${id}.720.webm`,
      mp4: `/assets/video/${id}/${id}.720.mp4`,
    },
  },
  poster: {
    desktop: `/assets/posters/${id}.1080.webp`,
    mobile: `/assets/posters/${id}.720.webp`,
  },
});

export const CINEMATIC_SCENES: CinematicScene[] = [
  scene("hero", "loop", "side", false),
  scene("agent", "scrub", "side", false),
  scene("automation", "loop", "strong", false),
];

export function getScene(id: CinematicSceneId): CinematicScene {
  const found = CINEMATIC_SCENES.find((s) => s.id === id);
  if (!found) throw new Error(`Escena desconocida: ${id}`);
  return found;
}
