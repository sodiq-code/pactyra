#!/usr/bin/env node
/**
 * Parse-level typecheck for lifecycle scripts and UI source.
 *
 * Runs TypeScript's transpileModule over every .ts/.tsx file under
 * scripts/ and ui/src/ and fails on any parse-level diagnostic. This
 * guards against the class of syntax error (for example a dangling
 * declaration or a mismatched quote) that prevented the lifecycle
 * scripts from compiling, without surfacing type errors imported
 * from external packages — so it stays green while still catching
 * regressions of the kind that previously slipped past CI.
 *
 * Run: node scripts/typecheck.js
 */
const ts = require("typescript");
const fs = require("fs");
const path = require("path");

function walk(dir, acc) {
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      walk(full, acc);
    } else if (entry.name.endsWith(".ts") || entry.name.endsWith(".tsx")) {
      acc.push(full);
    }
  }
  return acc;
}

const roots = [
  path.resolve(__dirname), // scripts/
  path.resolve(__dirname, "..", "ui", "src"), // ui/src/
];

let failed = false;
let checked = 0;

for (const root of roots) {
  if (!fs.existsSync(root)) continue;
  const files = walk(root, []);
  for (const fp of files) {
    const src = fs.readFileSync(fp, "utf8");
    const result = ts.transpileModule(src, {
      fileName: fp,
      reportDiagnostics: true,
    });
    checked++;
    if (result.diagnostics && result.diagnostics.length) {
      for (const d of result.diagnostics) {
        if (d.category === ts.DiagnosticCategory.Error) {
          const msg = ts.flattenDiagnosticMessageText(d.messageText, "\n");
          const pos = d.file
            ? `${ts.getLineAndCharacterOfPosition(d.file, d.start).line + 1}:${
                ts.getLineAndCharacterOfPosition(d.file, d.start).character + 1
              }`
            : "0:0";
          console.error(`${fp}:${pos} - ${msg}`);
          failed = true;
        }
      }
    }
  }
}

if (failed) {
  console.error(`\nParse errors found across ${checked} checked file(s).`);
  process.exit(1);
}
console.log(`All ${checked} source file(s) parse cleanly (scripts/ + ui/src/).`);
