/**
 * WCAG AA contrast audit of the copy that sits on the cinematic backdrop,
 * measured against the REAL pixels behind each line of text.
 *
 * For each theme (light/dark) × viewport (desktop/mobile) × scene × frame:
 *   1. Loads the landing with reduced motion (static, deterministic layout),
 *      forces the backdrop's static frame to that frame of the sequence.
 *   2. Collects every visible text run inside .ms-cine-content (tight glyph
 *      rects via Range.getClientRects) and its computed color/size/weight.
 *   3. Hides all text (color + text-shadow) and screenshots the viewport, so
 *      only background remains (scrims, glass, imagery).
 *   4. Contrast of the text color vs each background pixel under its rects;
 *      reports the 5th percentile (robust to isolated sparkle pixels) against
 *      AA: 4.5:1 normal text, 3:1 large text (≥24px, or ≥18.66px bold).
 *
 * Requires the dev server running.   Usage:
 *   npm run audit:contrast                    (BASE_URL=http://localhost:8080)
 *   BASE_URL=http://localhost:5173 npm run audit:contrast
 * Exit code 1 if any text run fails → usable as a CI gate.
 */
import { chromium } from "@playwright/test";
import sharp from "sharp";

const BASE_URL = process.env.BASE_URL ?? "http://localhost:8080";
const FRAMES = 3; // keep in sync with src/lib/cinematicScenes.ts
const THEMES = ["dark", "light"];
const VIEWPORTS = [
  { name: "desktop", width: 1440, height: 900 },
  { name: "mobile", width: 390, height: 844 },
];
const SCENES = [
  { id: "hero", anchor: "#hero", offsets: { desktop: [0], mobile: [0] } },
  { id: "agent", anchor: "#agente", offsets: { desktop: [80], mobile: [40, 640] } },
  { id: "automation", anchor: "#automatizacion", offsets: { desktop: [80], mobile: [40, 640] } },
];
const NAV_HEIGHT = 72;

const srgb = (c) => {
  const v = c / 255;
  return v <= 0.04045 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4;
};
const luminance = (r, g, b) => 0.2126 * srgb(r) + 0.7152 * srgb(g) + 0.0722 * srgb(b);
const ratio = (l1, l2) => (Math.max(l1, l2) + 0.05) / (Math.min(l1, l2) + 0.05);
const parseRgb = (css) => css.match(/[\d.]+/g).slice(0, 3).map(Number);

/** Runs in the page: visible text runs inside the cinematic content. */
function collectTextRuns(navHeight) {
  const runs = new Map();
  const root = document.querySelector(".ms-cine-content");
  const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT);
  const vw = window.innerWidth;
  const vh = window.innerHeight;
  for (let node = walker.nextNode(); node; node = walker.nextNode()) {
    if (!node.textContent.trim()) continue;
    const el = node.parentElement;
    if (!el || el.closest("[aria-hidden='true'], .sr-only")) continue;
    const cs = getComputedStyle(el);
    if (cs.visibility === "hidden" || Number(cs.opacity) === 0) continue;
    const range = document.createRange();
    range.selectNodeContents(node);
    const rects = [...range.getClientRects()]
      .filter((r) => r.width > 2 && r.height > 2)
      .filter((r) => r.top >= navHeight && r.bottom <= vh && r.left >= 0 && r.right <= vw)
      .map((r) => ({ x: Math.round(r.left), y: Math.round(r.top), w: Math.round(r.width), h: Math.round(r.height) }));
    if (!rects.length) continue;
    const key = el;
    const prev = runs.get(key);
    if (prev) prev.rects.push(...rects);
    else
      runs.set(key, {
        label: `${el.tagName.toLowerCase()}${el.className && typeof el.className === "string" ? "." + el.className.split(" ")[0] : ""} "${el.textContent.trim().slice(0, 34)}"`,
        color: cs.color,
        fontSize: parseFloat(cs.fontSize),
        fontWeight: Number(cs.fontWeight) || 400,
        rects,
      });
  }
  return [...runs.values()];
}

async function measure(page, viewport) {
  const runs = await page.evaluate(collectTextRuns, NAV_HEIGHT);
  const hide = await page.addStyleTag({
    content:
      ".ms-cine-content, .ms-cine-content * { color: transparent !important; -webkit-text-fill-color: transparent !important; text-shadow: none !important; }",
  });
  await page.waitForTimeout(120);
  const png = await page.screenshot();
  await hide.evaluate((el) => el.remove());
  const { data, info } = await sharp(png).raw().toBuffer({ resolveWithObject: true });
  const results = [];
  for (const run of runs) {
    const [tr, tg, tb] = parseRgb(run.color);
    const lt = luminance(tr, tg, tb);
    const ratios = [];
    for (const r of run.rects) {
      for (let y = r.y; y < Math.min(r.y + r.h, info.height); y += 1) {
        for (let x = r.x; x < Math.min(r.x + r.w, info.width); x += 2) {
          const i = (y * info.width + x) * info.channels;
          ratios.push(ratio(lt, luminance(data[i], data[i + 1], data[i + 2])));
        }
      }
    }
    if (!ratios.length) continue;
    ratios.sort((a, b) => a - b);
    const p05 = ratios[Math.floor(ratios.length * 0.05)];
    const large = run.fontSize >= 24 || (run.fontSize >= 18.66 && run.fontWeight >= 700);
    const need = large ? 3 : 4.5;
    results.push({ ...run, p05, min: ratios[0], need, pass: p05 >= need, viewport: viewport.name });
  }
  return results;
}

const browser = await chromium.launch();
const all = [];
for (const theme of THEMES) {
  for (const viewport of VIEWPORTS) {
    const context = await browser.newContext({
      viewport: { width: viewport.width, height: viewport.height },
      reducedMotion: "reduce",
    });
    await context.addInitScript((t) => localStorage.setItem("theme", t), theme);
    const page = await context.newPage();
    await page.goto(BASE_URL + "/", { waitUntil: "networkidle" });
    await page.waitForTimeout(600);
    for (const scene of SCENES) {
      for (const offset of scene.offsets[viewport.name]) {
        const top = await page.$eval(scene.anchor, (el) => el.getBoundingClientRect().top + window.scrollY);
        await page.evaluate((y) => window.scrollTo(0, y), scene.id === "hero" ? 0 : top + offset);
        await page.waitForTimeout(500);
        for (let n = 1; n <= FRAMES; n += 1) {
          const src = `/assets/scenes/${scene.id}/${scene.id}-${theme}-${n}.webp`;
          // Force the front layer's static frame to frame n and wait for it to paint.
          await page.evaluate(async (s) => {
            const layers = [...document.querySelectorAll(".ms-cine-layer")];
            const front = layers.find((l) => l.style.zIndex === "2") ?? layers[0];
            const img = front.querySelector("img");
            img.src = s;
            await img.decode().catch(() => {});
          }, src);
          await page.waitForTimeout(150);
          for (const r of await measure(page, viewport)) all.push({ theme, scene: scene.id, frame: n, ...r });
        }
      }
    }
    await context.close();
  }
}
await browser.close();

// Collapse repeats (same text measured across frames/offsets) to the worst case.
const worst = new Map();
for (const r of all) {
  const key = `${r.theme}|${r.viewport}|${r.scene}|${r.label}`;
  if (!worst.has(key) || r.p05 < worst.get(key).p05) worst.set(key, r);
}
const rows = [...worst.values()].sort((a, b) => a.p05 / a.need - b.p05 / b.need);
const fails = rows.filter((r) => !r.pass);

console.log(`\nAA contrast over cinematic backdrop — ${all.length} measurements, ${rows.length} text runs (worst frame each)\n`);
for (const theme of THEMES) {
  const mine = rows.filter((r) => r.theme === theme);
  const lowest = mine.slice(0, 6);
  console.log(`[${theme}] ${mine.filter((r) => r.pass).length}/${mine.length} pass · tightest:`);
  for (const r of lowest) {
    console.log(
      `  ${r.pass ? "PASS" : "FAIL"} ${r.p05.toFixed(2).padStart(5)}:1 (need ${r.need}) ${r.viewport.padEnd(7)} ${r.scene.padEnd(10)} f${r.frame} ${r.fontSize}px ${r.label}`,
    );
  }
}
if (fails.length) {
  console.log(`\n${fails.length} FAIL(s):`);
  for (const r of fails)
    console.log(`  ${r.theme} ${r.viewport} ${r.scene} f${r.frame}: ${r.p05.toFixed(2)}:1 < ${r.need} — ${r.label} (${r.color})`);
  process.exit(1);
}
console.log("\nAll text runs meet WCAG AA.");
