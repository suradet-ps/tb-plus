import { readFileSync, readdirSync, statSync } from "node:fs";
import path from "node:path";

const SRC = "src";
const VAR_FILE = path.join(SRC, "styles", "variables.css");

function walk(dir) {
  const out = [];
  for (const entry of readdirSync(dir)) {
    const full = path.join(dir, entry);
    if (statSync(full).isDirectory()) {
      out.push(...walk(full));
    } else if (/\.(vue|css|ts)$/.test(entry)) {
      out.push(full);
    }
  }
  return out;
}

const varText = readFileSync(VAR_FILE, "utf8");
const defined = new Set(
  [...varText.matchAll(/^\s*(--[A-Za-z0-9-]+)\s*:/gm)].map((m) => m[1]),
);

const referenced = new Set();
const inlineAssigned = new Set();
for (const file of walk(SRC)) {
  const text = readFileSync(file, "utf8");
  for (const m of text.matchAll(/var\((--[A-Za-z0-9-]+)/g)) {
    referenced.add(m[1]);
  }
  for (const m of text.matchAll(/['"](--[A-Za-z0-9-]+)['"]\s*:/g)) {
    inlineAssigned.add(m[1]);
  }
}

const unknown = [...referenced]
  .filter((token) => !defined.has(token) && !inlineAssigned.has(token))
  .sort();

if (unknown.length > 0) {
  console.error(
    "Unknown design tokens referenced (define them in variables.css or set them as inline custom properties):",
  );
  for (const token of unknown) {
    console.error(`  ${token}`);
  }
  process.exit(1);
}

console.log(
  `Design tokens OK (${defined.size} defined, ${referenced.size} referenced)`,
);
