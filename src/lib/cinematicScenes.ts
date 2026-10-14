import type { CinematicScene, CinematicSceneId, SceneImage, SceneMode } from "@/types/cinematic";

/**
 * Single source of truth for cinematic asset paths. Components never
 * hardcode /assets/... URLs.
 *
 * Naming: public/assets/scenes/<scene>/<scene>-<NN>.<1080|720>.webp
 *   1080 → 1920×1080 · 720 → 1280×720 · NN = 01, 02, … (frame order)
 *
 * To replace placeholders with final art: overwrite the files keeping the
 * names. To change the number of frames, change `frames` below.
 *
 * NOTE: the hero's first frame is duplicated in the preload script of
 * index.html (LCP). Keep both in sync.
 */
const frame = (id: CinematicSceneId, n: number): SceneImage => {
  const nn = String(n).padStart(2, "0");
  return {
    desktop: `/assets/scenes/${id}/${id}-${nn}.1080.webp`,
    mobile: `/assets/scenes/${id}/${id}-${nn}.720.webp`,
  };
};

const scene = (
  id: CinematicSceneId,
  mode: SceneMode,
  scrim: CinematicScene["scrim"],
  frames: number,
): CinematicScene => ({
  id,
  mode,
  scrim,
  images: Array.from({ length: frames }, (_, i) => frame(id, i + 1)),
});

export const CINEMATIC_SCENES: CinematicScene[] = [
  scene("hero", "loop", "side", 3),
  scene("agent", "scrub", "side", 3),
  scene("automation", "loop", "strong", 3),
];

export function getScene(id: CinematicSceneId): CinematicScene {
  const found = CINEMATIC_SCENES.find((s) => s.id === id);
  if (!found) throw new Error(`Escena desconocida: ${id}`);
  return found;
}

/** srcset shared by the static frame and the animated layer (same cache entry). */
export const imageSrcSet = (img: SceneImage) => `${img.mobile} 1280w, ${img.desktop} 1920w`;
