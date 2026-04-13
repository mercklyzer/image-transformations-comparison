/**
 * Restores image name links in reports/color-palette-footwear.md
 * after they were wiped by a faulty shell replacement.
 *
 * Strategy:
 * - Lines before the "## Per-Image Data" section: fix using a hardcoded
 *   ordered list of image names that appeared in the analysis tables.
 * - Lines from "## Per-Image Data" onward: fix using the ordered list
 *   from images-footwear.json (rows appear in the same order).
 */

import { readFileSync, writeFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = join(__dirname, "..");

const images = JSON.parse(
  readFileSync(join(ROOT, "src/data/images-footwear.json"), "utf8"),
);
const urlMap = Object.fromEntries(images.map((i) => [i.base, i.source]));

// Hardcoded order of image names that appeared in the analysis section tables
// (before the ## Per-Image Data section), in document order.
const analysisSectionImages = [
  // "Where all three agree" table
  "ARDEN-234-3",
  "ARLO-902-4",
  "KERRY-604-6",
  "HANNAH-600-3",
  "ARLO-120-3",
  // ARDEN-015 family table
  "ARDEN-015-1",
  "ARDEN-015-2",
  "ARDEN-015-3",
  "ARDEN-015-4",
  // ELVIE-015 family table
  "ELVIE-015-1",
  "ELVIE-015-3",
  "ELVIE-015-4",
  // "Where imgix and Node Vibrant strongly disagree" table
  "DAYNA-015-2",
  "ELIANA-001-6",
  "KIRA-124-5",
  "ARDEN-518-5",
  "MIRAGE-902-7",
];

const md = readFileSync(
  join(ROOT, "reports/color-palette-footwear.md"),
  "utf8",
);
const lines = md.split("\n");

// Find the line index where the per-image data table rows start
const perImageHeaderIdx = lines.findIndex((l) =>
  l.includes("## Per-Image Data"),
);
// Data rows start 3 lines after the header (blank, table header, separator)
const perImageDataStart = perImageHeaderIdx + 4;

let analysisQueue = [...analysisSectionImages];
let perImageQueue = [...images]; // ordered

const fixed = lines.map((line, i) => {
  if (!line.startsWith("| []()")) return line;

  if (i < perImageDataStart) {
    // Analysis section row
    const img = analysisQueue.shift();
    if (!img) return line;
    return line.replace("[]() |", `[${img}](${urlMap[img] ?? ""}) |`);
  } else {
    // Per-image table row
    const img = perImageQueue.shift();
    if (!img) return line;
    return line.replace("[]() |", `[${img.base}](${img.source}) |`);
  }
});

writeFileSync(
  join(ROOT, "reports/color-palette-footwear.md"),
  fixed.join("\n"),
  "utf8",
);
console.log(
  "Done. Fixed",
  lines.filter((l) => l.startsWith("| []()")).length,
  "rows.",
);
