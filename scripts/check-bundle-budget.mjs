#!/usr/bin/env node

/**
 * CI script: checks actual build output against perf-budgets.json thresholds.
 * Exits non-zero if any budget is exceeded.
 *
 * Usage: node scripts/check-bundle-budget.mjs
 */

import { readFileSync, readdirSync } from "node:fs";
import { join, resolve } from "node:path";
import { gzipSync } from "node:zlib";

const ROOT = resolve(import.meta.dirname, "..");
const BUDGETS_PATH = join(ROOT, "perf-budgets.json");
const DIST_DIR = join(ROOT, "dist", "assets");

const budgets = JSON.parse(readFileSync(BUDGETS_PATH, "utf-8"));

function gzipKB(filePath) {
  const buf = readFileSync(filePath);
  return gzipSync(buf).length / 1024;
}

function chunkGzipKB(prefix) {
  let total = 0;
  for (const f of readdirSync(DIST_DIR)) {
    if (f.startsWith(prefix) && f.endsWith(".js")) {
      total += gzipKB(join(DIST_DIR, f));
    }
  }
  return total;
}

let failed = false;

function check(label, actual, ceiling) {
  const pass = actual <= ceiling;
  const icon = pass ? "\u2705" : "\u274c";
  console.log(
    `${icon} ${label}: ${actual.toFixed(1)} KB (ceiling: ${ceiling} KB)`,
  );
  if (!pass) failed = true;
}

// Total JS
const jsFiles = readdirSync(DIST_DIR).filter((f) => f.endsWith(".js"));
const totalJs = jsFiles.reduce((sum, f) => sum + gzipKB(join(DIST_DIR, f)), 0);
check("Total JS (gzip)", totalJs, budgets.frontend.total_js_gzip_kb);

// Total CSS
const cssFiles = readdirSync(DIST_DIR).filter((f) => f.endsWith(".css"));
const totalCss = cssFiles.reduce(
  (sum, f) => sum + gzipKB(join(DIST_DIR, f)),
  0,
);
check("Total CSS (gzip)", totalCss, budgets.frontend.total_css_gzip_kb);

// Per-chunk checks
for (const [name, ceiling] of Object.entries(budgets.frontend.chunks)) {
  check(`Chunk '${name}' (gzip)`, chunkGzipKB(`${name}-`), ceiling);
}

console.log("");
if (failed) {
  console.error("One or more bundle budgets exceeded. See perf-budgets.json.");
  process.exit(1);
} else {
  console.log("All bundle budgets OK.");
}
