#!/usr/bin/env node
/**
 * gen-icons.cjs — Tauri app-icon generator (uses @resvg/resvg-js)
 *
 * Usage:
 *   node scripts/gen-icons.cjs          # Normal mode
 *   node scripts/gen-icons.cjs --silent # Quiet mode
 */

"use strict";

const { Resvg } = require("@resvg/resvg-js");
const fs = require("fs");
const path = require("path");
const { execSync } = require("child_process");

const ROOT = path.resolve(__dirname, "..");
const ICONS_DIR = path.join(ROOT, "src-tauri", "icons");
const SOURCE_PNG = path.join(ICONS_DIR, "icon.png");
const IS_SILENT = process.argv.includes("--silent");

const log = (msg) => !IS_SILENT && console.log(msg);
const error = (msg) => console.error(msg);

const ICON_SVG = `<svg width="200" height="200" viewBox="5 9 14 11" xmlns="http://www.w3.org/2000/svg">
  <path d="M10.5 9.4h-0.2C7.4 9.4 5 11.8 5 14.8c0 3 2.2 5.3 5.5 5.3 1 0 1-1 1-2v-8c0-1 0-1-1-1z" fill="#f6f5f4"/>
  <path d="M13.5 9.4h0.2c2.9 0 5.3 2.4 5.3 5.4 0 3-2.2 5.3-5.5 5.3-1 0-1-1-1-2v-8c0-1 0-1 1-1z" fill="#f6f5f4"/>
  <path d="M10.5 9h-0.2C7.4 9 5 11.4 5 14.4c0 3.3 2.2 5.6 5.5 5.6 1 0 1-1 1-2v-8c0-1 0-1-1-1z"
        fill="#2a9d99" stroke="#238582" stroke-width="0.1"/>
  <path d="M13.5 9h0.2c2.9 0 5.3 2.4 5.3 5.4 0 3.3-2.2 5.6-5.5 5.6-1 0-1-1-1-2v-8c0-1 0-1 1-1z"
        fill="#0075de" stroke="#005bab" stroke-width="0.1" fill-opacity="0.9"/>
  <text x="8.1" y="15.8"
        font-family="system-ui, -apple-system, sans-serif"
        font-weight="800"
        font-size="4"
        fill="#ffffff"
        text-anchor="middle">T</text>
  <text x="15.9" y="15.8"
        font-family="system-ui, -apple-system, sans-serif"
        font-weight="800"
        font-size="4"
        fill="#ffffff"
        text-anchor="middle">B</text>
  <path d="M10.5 9.2h-0.2C7.4 9.2 5.2 11.3 5.2 14.3" stroke="#ffffff" stroke-width="0.15" fill="none" stroke-opacity="0.4"/>
  <path d="M13.5 9.2h0.2c2.9 0 5.1 2.3 5.1 5.3" stroke="#ffffff" stroke-width="0.15" fill="none" stroke-opacity="0.4"/>
</svg>`;

(async () => {
  try {
    log("Rendering SVG → icon.png (1024×1024)…");

    const resvg = new Resvg(ICON_SVG, {
      fitTo: { mode: "width", value: 1024 },
      imageRendering: 1,
      shapeRendering: 2,
      textRendering: 2,
    });

    const pngBuffer = resvg.render().asPng();

    fs.mkdirSync(ICONS_DIR, { recursive: true });
    fs.writeFileSync(SOURCE_PNG, pngBuffer);
    log(`Saved ${path.basename(SOURCE_PNG)} (${Math.round(pngBuffer.length / 1024)} KB)`);

    log("Running tauri icon generator…");
    execSync(`bun tauri icon "${SOURCE_PNG}"`, {
      cwd: ROOT,
      stdio: IS_SILENT ? "pipe" : "inherit",
      timeout: 120_000,
    });

    log("All icons generated successfully in src-tauri/icons/");
    log("Rebuild the app to apply: bun tauri build");
  } catch (err) {
    error("Process failed:");
    error(err.message || err);
    process.exit(1);
  }
})();
