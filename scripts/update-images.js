#!/usr/bin/env node
/**
 * Updates src/data/images.json from a Cloudinary metadata CSV export.
 *
 * Usage:
 *   node scripts/update-images.js [csv-file]
 *
 * Defaults to metadata.csv in the project root.
 * New folders in the CSV are automatically added as keys in the output.
 * Existing entries in images.json are preserved and merged.
 */

const fs = require("node:fs");
const path = require("node:path");

const ROOT = path.resolve(__dirname, "..");
const IMAGES_JSON = path.join(ROOT, "src/data/images.json");

const csvFile = process.argv[2] ?? path.join(ROOT, "metadata.csv");

if (!fs.existsSync(csvFile)) {
  console.error(`CSV file not found: ${csvFile}`);
  process.exit(1);
}

// --- Parse CSV ---

function parseCSV(content) {
  const lines = content.trim().split("\n");
  const header = splitCSVLine(lines[0]);
  return lines.slice(1).map((line) => {
    const values = splitCSVLine(line);
    return Object.fromEntries(header.map((h, i) => [h, values[i] ?? ""]));
  });
}

function splitCSVLine(line) {
  const fields = [];
  let cur = "";
  let inQuote = false;
  for (const ch of line) {
    if (ch === '"') {
      inQuote = !inQuote;
    } else if (ch === "," && !inQuote) {
      fields.push(cur);
      cur = "";
    } else {
      cur += ch;
    }
  }
  fields.push(cur);
  return fields;
}

// --- Load existing images.json ---

let existing = [];
if (fs.existsSync(IMAGES_JSON)) {
  existing = JSON.parse(fs.readFileSync(IMAGES_JSON, "utf8"));
}

// Index existing entries by base for fast lookup
const byBase = {};
for (const entry of existing) {
  byBase[entry.base] = { ...entry };
}

// --- Process CSV rows ---

const rows = parseCSV(fs.readFileSync(csvFile, "utf8"));

let added = 0;
let updated = 0;
const foldersFound = new Set();

for (const row of rows) {
  const publicId = row.publicId;
  const url = row.url;
  if (!publicId || !url) continue;

  const slashIdx = publicId.indexOf("/");
  if (slashIdx === -1) continue;

  const folder = publicId.slice(0, slashIdx); // e.g. "source", "photoroom", "birefnet-general-lite"
  const base = publicId.slice(slashIdx + 1); // filename without extension

  foldersFound.add(folder);

  if (!byBase[base]) {
    byBase[base] = { base };
    added++;
  } else if (byBase[base][folder] !== url) {
    updated++;
  }

  byBase[base][folder] = url;
}

// --- Build sorted output ---

const images = Object.values(byBase).sort((a, b) =>
  a.base.localeCompare(b.base),
);

// --- Write images.json ---

fs.writeFileSync(IMAGES_JSON, JSON.stringify(images, null, 2) + "\n");

console.log(`Done.`);
console.log(`  Folders found: ${[...foldersFound].join(", ")}`);
console.log(`  Total images:  ${images.length}`);
console.log(`  New entries:   ${added}`);
console.log(`  Updated URLs:  ${updated}`);
