/**
 * Generate placeholder posters for the cinematic landing scenes.
 *
 * Output : public/assets/posters/<scene>.<1080|720>.webp
 *
 * These stand in for the real Image-to-Video posters until the final assets
 * are produced. Real posters MUST be the exact first frame of their video
 * (spec FR-004); just overwrite these files with the same names.
 *
 * Composition follows the art direction in the spec: dark negative space on
 * the left for copy, cold blue/cyan light (MS --primary / --accent) on the
 * right third.
 *
 * Run: node scripts/generate-cinematic-placeholders.mjs
 */
import sharp from "sharp";
import { fileURLToPath } from "node:url";
import { dirname, resolve } from "node:path";
import { mkdir } from "node:fs/promises";

const __dirname = dirname(fileURLToPath(import.meta.url));
const OUT = resolve(__dirname, "..", "public", "assets", "posters");

const SIZES = [
  { label: "1080", width: 1920, height: 1080 },
  { label: "720", width: 1280, height: 720 },
];

// Light blobs per scene, in a 1920x1080 coordinate space.
const SCENES = {
  hero: [
    { cx: 1450, cy: 420, r: 720, color: "#0ea5e9", opacity: 0.42 },
    { cx: 1720, cy: 860, r: 520, color: "#06b6d4", opacity: 0.28 },
    { cx: 980, cy: 120, r: 380, color: "#1e3a5f", opacity: 0.6 },
  ],
  agent: [
    { cx: 1380, cy: 560, r: 640, color: "#06b6d4", opacity: 0.4 },
    { cx: 1760, cy: 200, r: 460, color: "#0ea5e9", opacity: 0.3 },
    { cx: 900, cy: 980, r: 420, color: "#0f1c35", opacity: 0.8 },
  ],
  automation: [
    { cx: 1560, cy: 640, r: 700, color: "#2563eb", opacity: 0.34 },
    { cx: 1240, cy: 260, r: 420, color: "#06b6d4", opacity: 0.3 },
    { cx: 1820, cy: 980, r: 380, color: "#0ea5e9", opacity: 0.24 },
  ],
};

function svgFor(blobs) {
  const defs = blobs
    .map(
      (b, i) => `
    <radialGradient id="g${i}" cx="${b.cx}" cy="${b.cy}" r="${b.r}" gradientUnits="userSpaceOnUse">
      <stop offset="0" stop-color="${b.color}" stop-opacity="${b.opacity}"/>
      <stop offset="1" stop-color="${b.color}" stop-opacity="0"/>
    </radialGradient>`,
    )
    .join("");
  const rects = blobs.map((_, i) => `<rect width="1920" height="1080" fill="url(#g${i})"/>`).join("");

  // Faint perspective grid lines on the right half: "engineering" texture.
  const lines = Array.from({ length: 14 }, (_, i) => {
    const y = 140 + i * 62;
    return `<line x1="980" y1="${y}" x2="1920" y2="${y - 120}" stroke="#94a3b8" stroke-opacity="0.05" stroke-width="1"/>`;
  }).join("");

  return `<svg xmlns="http://www.w3.org/2000/svg" width="1920" height="1080" viewBox="0 0 1920 1080">
  <defs>${defs}
    <linearGradient id="fade" x1="0" y1="0" x2="1920" y2="0" gradientUnits="userSpaceOnUse">
      <stop offset="0" stop-color="#080f1e" stop-opacity="1"/>
      <stop offset="0.45" stop-color="#080f1e" stop-opacity="0.35"/>
      <stop offset="1" stop-color="#080f1e" stop-opacity="0"/>
    </linearGradient>
  </defs>
  <rect width="1920" height="1080" fill="#080f1e"/>
  ${rects}
  ${lines}
  <rect width="1920" height="1080" fill="url(#fade)"/>
</svg>`;
}

await mkdir(OUT, { recursive: true });

for (const [scene, blobs] of Object.entries(SCENES)) {
  const svg = Buffer.from(svgFor(blobs));
  for (const { label, width, height } of SIZES) {
    const file = resolve(OUT, `${scene}.${label}.webp`);
    const info = await sharp(svg, { density: 72 })
      .resize(width, height)
      .webp({ quality: 75 })
      .toFile(file);
    console.log(`${scene}.${label}.webp  ${width}x${height}  ${(info.size / 1024).toFixed(1)} KB`);
  }
}
