import type { CinematicScene, CinematicSceneId, CinematicTheme, SceneMode } from "@/types/cinematic";

/**
 * Single source of truth for cinematic asset paths. Components never
 * hardcode /assets/... URLs.
 *
 * Naming: public/assets/scenes/<scene>/<scene>-<light|dark>-<n>.webp
 *   e.g. /assets/scenes/hero/hero-dark-1.webp · /assets/scenes/hero/hero-light-1.webp
 *   n = 1, 2, … (frame order). Recommended export: 1920×1080, WebP q≈75–80.
 *
 * To replace placeholders with final art (Higgsfield): overwrite the files
 * keeping the names. To change the number of frames, change `frames` below
 * (light and dark must have the same count).
 *
 * NOTE: the hero's first frame (both themes) is duplicated in the preload
 * script of index.html (LCP). Keep both in sync.
 */
const sequence = (id: CinematicSceneId, theme: CinematicTheme, frames: number): string[] =>
  Array.from({ length: frames }, (_, i) => `/assets/scenes/${id}/${id}-${theme}-${i + 1}.webp`);

const scene = (
  id: CinematicSceneId,
  mode: SceneMode,
  scrim: CinematicScene["scrim"],
  frames: number,
): CinematicScene => ({
  id,
  mode,
  scrim,
  imagesLight: sequence(id, "light", frames),
  imagesDark: sequence(id, "dark", frames),
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

/** The frames to show for the active theme. */
export const sceneImages = (scene: CinematicScene, theme: CinematicTheme): string[] =>
  theme === "light" ? scene.imagesLight : scene.imagesDark;
