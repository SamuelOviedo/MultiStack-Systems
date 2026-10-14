/**
 * Generate placeholder frames for the cinematic image sequences.
 *
 * Output : public/assets/scenes/<scene>/<scene>-<NN>.<1080|720>.webp
 *
 * Procedural, on-brand stand-ins until the final art exists (overwrite the
 * files keeping their names). Each scene has its own motif, and frames vary
 * so the slideshow / scrub reads as motion:
 *   hero        → AI: neural network (nodes + weighted connections)
 *   agent       → conversation: concentric signal rings + waveform
 *   automation  → process optimization: flow pipes between process nodes
 *
 * Art direction (spec): dark negative space on the left for copy, cold light
 * (MS --primary #0ea5e9 / --accent #06b6d4) on the right.
 *
 * Run: node scripts/generate-cinematic-placeholders.mjs   (npm run assets:placeholders)
 */
import sharp from "sharp";
import { fileURLToPath } from "node:url";
import { dirname, resolve } from "node:path";
import { mkdir } from "node:fs/promises";

const __dirname = dirname(fileURLToPath(import.meta.url));
const OUT = resolve(__dirname, "..", "public", "assets", "scenes");

const W = 1920;
const H = 1080;
const FRAMES = 3;
const SIZES = [
  { label: "1080", width: 1920, height: 1080 },
  { label: "720", width: 1280, height: 720 },
];
const PRIMARY = "#0ea5e9";
const ACCENT = "#06b6d4";
const DEEP = "#2563eb";

/** Deterministic PRNG (mulberry32) → identical output on every run. */
function rng(seed) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const glow = (id, cx, cy, r, color, opacity) => ({
  def: `<radialGradient id="${id}" cx="${cx}" cy="${cy}" r="${r}" gradientUnits="userSpaceOnUse">
    <stop offset="0" stop-color="${color}" stop-opacity="${opacity}"/>
    <stop offset="1" stop-color="${color}" stop-opacity="0"/></radialGradient>`,
  use: `<rect width="${W}" height="${H}" fill="url(#${id})"/>`,
});

function neuralNetwork(frame, r) {
  // Layered network drifting right/up across frames.
  const layers = 5;
  const shiftX = frame * 60;
  const shiftY = -frame * 35;
  const nodes = [];
  for (let l = 0; l < layers; l++) {
    const count = 4 + Math.floor(r() * 4);
    for (let i = 0; i < count; i++) {
      nodes.push({
        l,
        x: 980 + l * 210 + shiftX + (r() - 0.5) * 60,
        y: 180 + ((i + 0.5) / count) * 720 + shiftY + (r() - 0.5) * 50,
        s: 3 + r() * 5,
      });
    }
  }
  let edges = "";
  for (const a of nodes) {
    for (const b of nodes) {
      if (b.l !== a.l + 1 || r() > 0.55) continue;
      const w = (0.04 + r() * 0.16).toFixed(2);
      edges += `<line x1="${a.x}" y1="${a.y}" x2="${b.x}" y2="${b.y}" stroke="${r() > 0.5 ? PRIMARY : ACCENT}" stroke-opacity="${w}" stroke-width="1.2"/>`;
    }
  }
  const dots = nodes
    .map((n) => `<circle cx="${n.x}" cy="${n.y}" r="${n.s}" fill="${PRIMARY}" fill-opacity="${(0.35 + r() * 0.5).toFixed(2)}"/>
      <circle cx="${n.x}" cy="${n.y}" r="${n.s * 4}" fill="${ACCENT}" fill-opacity="0.05"/>`)
    .join("");
  const glows = [
    glow("g1", 1420 + shiftX, 470 + shiftY, 760, PRIMARY, 0.38),
    glow("g2", 1760, 880 - frame * 80, 520, ACCENT, 0.24),
  ];
  return { glows, art: edges + dots };
}

function signalRings(frame, r) {
  const cx = 1460 - frame * 40;
  const cy = 540 + frame * 25;
  let rings = "";
  for (let i = 1; i <= 9; i++) {
    const rad = 70 * i + frame * 22;
    rings += `<circle cx="${cx}" cy="${cy}" r="${rad}" fill="none" stroke="${ACCENT}" stroke-opacity="${(0.22 - i * 0.018).toFixed(3)}" stroke-width="${i % 3 === 0 ? 2 : 1}"/>`;
  }
  // Waveform: a "voice" crossing the frame, amplitude evolving per frame.
  let d = `M 900 ${cy}`;
  for (let x = 900; x <= W; x += 12) {
    const env = Math.sin(((x - 900) / (W - 900)) * Math.PI);
    const y = cy + Math.sin(x / (38 - frame * 6) + frame) * 70 * env * (0.6 + r() * 0.5);
    d += ` L ${x} ${y.toFixed(1)}`;
  }
  const wave = `<path d="${d}" fill="none" stroke="${PRIMARY}" stroke-opacity="0.55" stroke-width="2"/>`;
  let dots = "";
  for (let i = 0; i < 70; i++) {
    const a = r() * Math.PI * 2;
    const rad = 120 + r() * 520;
    dots += `<circle cx="${(cx + Math.cos(a) * rad).toFixed(1)}" cy="${(cy + Math.sin(a) * rad).toFixed(1)}" r="${(1 + r() * 2.2).toFixed(1)}" fill="${ACCENT}" fill-opacity="${(0.15 + r() * 0.5).toFixed(2)}"/>`;
  }
  const glows = [glow("g1", cx, cy, 680, ACCENT, 0.36), glow("g2", 1780, 160 + frame * 60, 460, PRIMARY, 0.26)];
  return { glows, art: rings + wave + dots };
}

function flowPipes(frame, r) {
  const stations = [
    { x: 1040, y: 300 + frame * 30 },
    { x: 1330, y: 560 - frame * 20 },
    { x: 1600, y: 360 + frame * 40 },
    { x: 1820, y: 700 - frame * 30 },
  ];
  let pipes = "";
  for (let lane = 0; lane < 7; lane++) {
    const off = (lane - 3) * 26;
    let d = `M 900 ${stations[0].y + off}`;
    let prev = { x: 900, y: stations[0].y + off };
    for (const s of stations) {
      const y = s.y + off;
      const mid = (prev.x + s.x) / 2;
      d += ` C ${mid} ${prev.y}, ${mid} ${y}, ${s.x} ${y}`;
      prev = { x: s.x, y };
    }
    d += ` L ${W} ${prev.y}`;
    pipes += `<path d="${d}" fill="none" stroke="${lane % 2 ? ACCENT : DEEP}" stroke-opacity="${(0.1 + r() * 0.2).toFixed(2)}" stroke-width="${lane === 3 ? 2.5 : 1.2}"/>`;
  }
  // "Documents" travelling along the pipes: position advances per frame.
  let packets = "";
  for (let i = 0; i < 9; i++) {
    const x = 940 + ((i * 110 + frame * 140) % 900);
    const y = 300 + r() * 480;
    packets += `<rect x="${x}" y="${y.toFixed(0)}" width="18" height="24" rx="3" fill="${PRIMARY}" fill-opacity="${(0.25 + r() * 0.4).toFixed(2)}"/>`;
  }
  const nodes = stations
    .map((s) => `<rect x="${s.x - 28}" y="${s.y - 28}" width="56" height="56" rx="14" fill="#0f1c35" fill-opacity="0.85" stroke="${ACCENT}" stroke-opacity="0.55"/>
      <circle cx="${s.x}" cy="${s.y}" r="7" fill="${ACCENT}" fill-opacity="0.9"/>`)
    .join("");
  const glows = [glow("g1", 1560, 520, 720, DEEP, 0.34), glow("g2", 1240, 260 + frame * 70, 420, ACCENT, 0.26)];
  return { glows, art: pipes + packets + nodes };
}

const SCENES = { hero: neuralNetwork, agent: signalRings, automation: flowPipes };

function svgFor(scene, frame) {
  const r = rng(1000 * (Object.keys(SCENES).indexOf(scene) + 1) + frame * 17);
  const { glows, art } = SCENES[scene](frame, r);
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}" viewBox="0 0 ${W} ${H}">
  <defs>${glows.map((g) => g.def).join("")}
    <linearGradient id="fade" x1="0" y1="0" x2="${W}" y2="0" gradientUnits="userSpaceOnUse">
      <stop offset="0" stop-color="#080f1e" stop-opacity="1"/>
      <stop offset="0.42" stop-color="#080f1e" stop-opacity="0.55"/>
      <stop offset="0.62" stop-color="#080f1e" stop-opacity="0"/>
    </linearGradient>
  </defs>
  <rect width="${W}" height="${H}" fill="#080f1e"/>
  ${glows.map((g) => g.use).join("")}
  ${art}
  <rect width="${W}" height="${H}" fill="url(#fade)"/>
</svg>`;
}

let total = 0;
for (const scene of Object.keys(SCENES)) {
  const dir = resolve(OUT, scene);
  await mkdir(dir, { recursive: true });
  for (let f = 0; f < FRAMES; f++) {
    const svg = Buffer.from(svgFor(scene, f));
    const nn = String(f + 1).padStart(2, "0");
    for (const { label, width, height } of SIZES) {
      const info = await sharp(svg, { density: 72 })
        .resize(width, height)
        .webp({ quality: 78 })
        .toFile(resolve(dir, `${scene}-${nn}.${label}.webp`));
      total += info.size;
      console.log(`${scene}-${nn}.${label}.webp  ${(info.size / 1024).toFixed(1)} KB`);
    }
  }
}
console.log(`total ${(total / 1024).toFixed(1)} KB`);
