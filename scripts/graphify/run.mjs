#!/usr/bin/env node
/**
 * Graphify runner / orchestrator.
 *
 *   node scripts/graphify/run.mjs [--report-only] [--open] [--watch] [--no-html]
 *
 * Regenerates the architecture graph + report from ./src. Analysis only —
 * it never imports, executes, or modifies application code.
 */
import { writeFileSync, mkdirSync, readFileSync } from "node:fs";
import { watch } from "node:fs";
import { fileURLToPath } from "node:url";
import { spawn } from "node:child_process";
import path from "node:path";
import { analyze } from "./analyze.mjs";
import { buildReport } from "./report.mjs";

const HERE = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(HERE, "../../");
const OUT = path.join(ROOT, "graph");
const SRC = path.join(ROOT, "src");

const args = new Set(process.argv.slice(2));
const flag = (f) => args.has(f);

function stamp() {
  const d = new Date();
  const pad = (x) => String(x).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())} ${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

async function generate() {
  const t0 = Date.now();
  mkdirSync(OUT, { recursive: true });
  const model = await analyze();
  model.generatedAt = "Generated " + stamp();

  // 1. graph.json (full model, viz-ready)
  writeFileSync(path.join(OUT, "graph.json"), JSON.stringify(model, null, 2));

  // 2. dependency-report.json (machine-readable summary)
  const depReport = {
    generatedAt: model.generatedAt,
    metrics: model.metrics,
    layers: model.layers,
    folders: model.folders,
    circular: model.circular,
    hotspots: model.hotspots,
    orphans: model.orphans,
    deadCandidates: model.deadCandidates,
    envAccess: model.envAccess,
  };
  writeFileSync(path.join(OUT, "dependency-report.json"), JSON.stringify(depReport, null, 2));

  // 3. ARCHITECTURE_REPORT.md
  writeFileSync(path.join(ROOT, "ARCHITECTURE_REPORT.md"), buildReport(model));

  // 4. graph.html (standalone, data injected inline)
  if (!flag("--no-html")) {
    const tpl = readFileSync(path.join(HERE, "template.html"), "utf8");
    const injected = tpl.replace(
      /\/\*__GRAPH_DATA__\*\/[\s\S]*?\/\*__END_GRAPH_DATA__\*\//,
      "/*__GRAPH_DATA__*/ " + JSON.stringify(model) + " /*__END_GRAPH_DATA__*/"
    );
    writeFileSync(path.join(OUT, "graph.html"), injected);
  }

  const ms = Date.now() - t0;
  const M = model.metrics;
  console.log(
    `graphify: ${M.nodeCount} nodes · ${M.edgeCount} edges · ${M.circularGroupCount} circular · ` +
      `${M.orphanCount} orphans · ${M.communityCount} clusters  (${ms}ms)`
  );
  console.log(`  -> graph/graph.html   graph/graph.json   graph/dependency-report.json   ARCHITECTURE_REPORT.md`);
  return model;
}

function openHtml() {
  const target = path.join(OUT, "graph.html");
  const cmd =
    process.platform === "win32"
      ? ["cmd", ["/c", "start", "", target]]
      : process.platform === "darwin"
      ? ["open", [target]]
      : ["xdg-open", [target]];
  spawn(cmd[0], cmd[1], { detached: true, stdio: "ignore" }).unref();
  console.log(`  opened ${target}`);
}

async function main() {
  if (flag("--report-only")) {
    args.add("--no-html");
  }
  await generate();
  if (flag("--open")) openHtml();

  if (flag("--watch")) {
    console.log("graphify: watching src/ for changes (Ctrl+C to stop)…");
    let timer = null;
    let running = false;
    watch(SRC, { recursive: true }, (_evt, file) => {
      if (file && !/\.(t|j)sx?$|\.css$/.test(file)) return;
      clearTimeout(timer);
      timer = setTimeout(async () => {
        if (running) return;
        running = true;
        try {
          await generate();
        } catch (e) {
          console.error("graphify: regeneration failed —", e.message);
        } finally {
          running = false;
        }
      }, 400);
    });
  }
}

main().catch((e) => {
  console.error("graphify failed:", e);
  process.exit(1);
});
