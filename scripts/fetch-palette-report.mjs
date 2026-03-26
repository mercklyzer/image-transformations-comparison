/**
 * Fetches color palette data from all three APIs for every footwear image
 * and writes a Markdown report to reports/color-palette-footwear.md
 */

import { readFileSync, writeFileSync, mkdirSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = join(__dirname, "..");
const BASE_URL = "http://localhost:3000";
const CONCURRENCY = 5;

const images = JSON.parse(
  readFileSync(join(ROOT, "src/data/images-footwear.json"), "utf8"),
);

async function fetchJSON(url) {
  const res = await fetch(url);
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  return res.json();
}

async function fetchWithRetry(url, retries = 3) {
  for (let i = 0; i < retries; i++) {
    try {
      return await fetchJSON(url);
    } catch (e) {
      if (i === retries - 1) throw e;
      await new Promise((r) => setTimeout(r, 1000 * (i + 1)));
    }
  }
}

async function runConcurrent(tasks, concurrency) {
  const results = new Array(tasks.length);
  let idx = 0;

  async function worker() {
    while (idx < tasks.length) {
      const i = idx++;
      results[i] = await tasks[i]();
    }
  }

  await Promise.all(Array.from({ length: concurrency }, worker));
  return results;
}

function hexDistance(h1, h2) {
  if (!h1 || !h2 || h1.length < 7 || h2.length < 7) return null;
  const r1 = parseInt(h1.slice(1, 3), 16);
  const g1 = parseInt(h1.slice(3, 5), 16);
  const b1 = parseInt(h1.slice(5, 7), 16);
  const r2 = parseInt(h2.slice(1, 3), 16);
  const g2 = parseInt(h2.slice(3, 5), 16);
  const b2 = parseInt(h2.slice(5, 7), 16);
  return Math.round(Math.sqrt((r1 - r2) ** 2 + (g1 - g2) ** 2 + (b1 - b2) ** 2));
}

function closestInPalette(targetHex, palette) {
  let best = null;
  let bestDist = Infinity;
  for (const c of palette) {
    const d = hexDistance(targetHex, c.hex);
    if (d !== null && d < bestDist) {
      bestDist = d;
      best = { hex: c.hex, distance: d };
    }
  }
  return best;
}

function closestDominantToNova(novaHex, dominant_colors) {
  const keys = ["vibrant", "vibrant_dark", "vibrant_light", "muted", "muted_dark", "muted_light"];
  let best = null;
  let bestDist = Infinity;
  for (const key of keys) {
    const hex = dominant_colors?.[key]?.hex;
    if (!hex) continue;
    const d = hexDistance(novaHex, hex);
    if (d !== null && d < bestDist) {
      bestDist = d;
      best = { key, hex, distance: d };
    }
  }
  return best;
}

function colorLabel(hex) {
  if (!hex || hex.length < 7) return "unknown";
  const r = parseInt(hex.slice(1, 3), 16);
  const g = parseInt(hex.slice(3, 5), 16);
  const b = parseInt(hex.slice(5, 7), 16);
  const max = Math.max(r, g, b);
  const min = Math.min(r, g, b);
  const l = (max + min) / 2 / 255;
  const s = max === min ? 0 : (max - min) / (l < 0.5 ? max + min : 510 - max - min);
  if (l < 0.15) return "Black/Very Dark";
  if (l > 0.85) return "White/Very Light";
  if (s < 0.15) return "Gray/Neutral";
  const h = max === r ? ((g - b) / (max - min) + 6) % 6 * 60
           : max === g ? (b - r) / (max - min) * 60 + 120
           : (r - g) / (max - min) * 60 + 240;
  if (h < 30 || h >= 330) return "Red";
  if (h < 60) return "Orange";
  if (h < 90) return "Yellow-Green";
  if (h < 150) return "Green";
  if (h < 210) return "Cyan";
  if (h < 270) return "Blue";
  if (h < 300) return "Purple";
  return "Pink/Magenta";
}

console.log(`Fetching palette data for ${images.length} footwear images...`);
console.log("This may take a few minutes (cached results will be fast)\n");

// Fetch all three APIs for each image
const allResults = [];

const imgixTasks = images.map((img) => async () => {
  if (!img.source) return { base: img.base, data: null };
  try {
    const data = await fetchWithRetry(
      `${BASE_URL}/api/palette?url=${encodeURIComponent(img.source)}`
    );
    return { base: img.base, data };
  } catch {
    return { base: img.base, data: null };
  }
});

const vibrantTasks = images.map((img) => async () => {
  if (!img.source) return { base: img.base, data: null };
  try {
    const data = await fetchWithRetry(
      `${BASE_URL}/api/palette-vibrant?url=${encodeURIComponent(img.source)}`
    );
    return { base: img.base, data };
  } catch {
    return { base: img.base, data: null };
  }
});

const bedrockTasks = images.map((img) => async () => {
  if (!img.source) return { base: img.base, data: null };
  try {
    const data = await fetchWithRetry(
      `${BASE_URL}/api/palette-bedrock?url=${encodeURIComponent(img.source)}`
    );
    return { base: img.base, data };
  } catch {
    return { base: img.base, data: null };
  }
});

process.stdout.write("Fetching imgix palette...");
const imgixResults = await runConcurrent(imgixTasks, 10);
console.log(` done (${imgixResults.filter((r) => r.data).length}/${images.length} ok)`);

process.stdout.write("Fetching Node Vibrant...");
const vibrantResults = await runConcurrent(vibrantTasks, 10);
console.log(` done (${vibrantResults.filter((r) => r.data).length}/${images.length} ok)`);

process.stdout.write("Fetching AWS Nova Lite (rate-limited to 5 concurrent)...");
const bedrockResults = await runConcurrent(bedrockTasks, CONCURRENCY);
console.log(` done (${bedrockResults.filter((r) => r.data).length}/${images.length} ok)`);

// Index results by base name
const imgixMap = Object.fromEntries(imgixResults.map((r) => [r.base, r.data]));
const vibrantMap = Object.fromEntries(vibrantResults.map((r) => [r.base, r.data]));
const bedrockMap = Object.fromEntries(bedrockResults.map((r) => [r.base, r.data]));

// Build per-image analysis
const imageAnalysis = images.map((img) => {
  const imgix = imgixMap[img.base];
  const vibrant = vibrantMap[img.base];
  const bedrock = bedrockMap[img.base];

  const novaHex = bedrock?.hex ?? null;

  // For imgix: find which of the 6 dominant colors is closest to Nova
  const imgixDominant = imgix?.dominant_colors;
  const imgixClosestToNova = novaHex && imgixDominant
    ? closestDominantToNova(novaHex, imgixDominant)
    : null;

  // For imgix: also find which raw palette color is closest to Nova
  const imgixClosestRawToNova = novaHex && imgix?.colors?.length
    ? closestInPalette(novaHex, imgix.colors)
    : null;

  // For vibrant: find which dominant color is closest to Nova
  const vibrantDominant = vibrant?.dominant_colors;
  const vibrantClosestToNova = novaHex && vibrantDominant
    ? closestDominantToNova(novaHex, vibrantDominant)
    : null;

  // imgix Vibrant vs Node Vibrant Vibrant
  const imgixVibrantHex = imgixDominant?.vibrant?.hex ?? null;
  const vibrantVibrantHex = vibrantDominant?.vibrant?.hex ?? null;
  const vibrantVsImgixDist = hexDistance(imgixVibrantHex, vibrantVibrantHex);

  return {
    base: img.base,
    imgix,
    vibrant,
    novaHex,
    imgixClosestToNova,
    imgixClosestRawToNova,
    vibrantClosestToNova,
    imgixVibrantHex,
    vibrantVibrantHex,
    vibrantVsImgixDist,
  };
});

// Aggregate statistics
const validNova = imageAnalysis.filter((a) => a.novaHex);
const validImgixVibrant = imageAnalysis.filter((a) => a.imgixVibrantHex && a.vibrantVibrantHex);

const avgVibrantVsImgix = validImgixVibrant.length
  ? Math.round(
      validImgixVibrant.reduce((s, a) => s + (a.vibrantVsImgixDist ?? 0), 0) /
        validImgixVibrant.length
    )
  : 0;

const avgImgixDomToNova = validNova.filter((a) => a.imgixClosestToNova).length
  ? Math.round(
      validNova
        .filter((a) => a.imgixClosestToNova)
        .reduce((s, a) => s + a.imgixClosestToNova.distance, 0) /
        validNova.filter((a) => a.imgixClosestToNova).length
    )
  : 0;

const avgVibrantToNova = validNova.filter((a) => a.vibrantClosestToNova).length
  ? Math.round(
      validNova
        .filter((a) => a.vibrantClosestToNova)
        .reduce((s, a) => s + a.vibrantClosestToNova.distance, 0) /
        validNova.filter((a) => a.vibrantClosestToNova).length
    )
  : 0;

// Nova color distribution
const novaColorLabels = validNova.map((a) => colorLabel(a.novaHex));
const novaLabelCounts = {};
for (const l of novaColorLabels) novaLabelCounts[l] = (novaLabelCounts[l] ?? 0) + 1;

// Which imgix dominant type most often matches Nova
const imgixBestKeyFreq = {};
for (const a of validNova.filter((a) => a.imgixClosestToNova)) {
  const k = a.imgixClosestToNova.key;
  imgixBestKeyFreq[k] = (imgixBestKeyFreq[k] ?? 0) + 1;
}

// Which vibrant dominant type most often matches Nova
const vibrantBestKeyFreq = {};
for (const a of validNova.filter((a) => a.vibrantClosestToNova)) {
  const k = a.vibrantClosestToNova.key;
  vibrantBestKeyFreq[k] = (vibrantBestKeyFreq[k] ?? 0) + 1;
}

// Sort by frequency
const sortedImgixKeys = Object.entries(imgixBestKeyFreq).sort((a, b) => b[1] - a[1]);
const sortedVibrantKeys = Object.entries(vibrantBestKeyFreq).sort((a, b) => b[1] - a[1]);

// Cases where imgix and vibrant disagree most (large Vibrant hex distance)
const highDisagreement = imageAnalysis
  .filter((a) => a.vibrantVsImgixDist !== null && a.vibrantVsImgixDist > 100)
  .sort((a, b) => b.vibrantVsImgixDist - a.vibrantVsImgixDist)
  .slice(0, 10);

// Cases where Nova closely matches imgix dominant vs vibrant dominant
const closerToImgix = validNova.filter(
  (a) =>
    a.imgixClosestToNova &&
    a.vibrantClosestToNova &&
    a.imgixClosestToNova.distance < a.vibrantClosestToNova.distance
).length;
const closerToVibrant = validNova.filter(
  (a) =>
    a.imgixClosestToNova &&
    a.vibrantClosestToNova &&
    a.vibrantClosestToNova.distance < a.imgixClosestToNova.distance
).length;

// ─── Build Markdown Report ───────────────────────────────────────────────────

const lines = [];
lines.push("# Footwear Color Palette Report");
lines.push("");
lines.push(`**Dataset:** Footwear (${images.length} images)  `);
lines.push(`**Generated:** ${new Date().toISOString().split("T")[0]}  `);
lines.push("**Tools evaluated:** imgix Palette · Node Vibrant · AWS Nova Lite");
lines.push("");
lines.push("---");
lines.push("");
lines.push("## Overview");
lines.push("");
lines.push("This report summarises the color palette results for footwear product images as returned by three different tools:");
lines.push("");
lines.push("| Tool | What it returns |");
lines.push("|---|---|");
lines.push("| **imgix Palette** | Up to 8 raw palette colors + 6 categorised dominant colors (Vibrant, Dark Vibrant, Light Vibrant, Muted, Dark Muted, Light Muted) |");
lines.push("| **Node Vibrant** | 6 categorised dominant colors only (same categories as imgix) |");
lines.push("| **AWS Nova Lite** | A single recommended swatch hex — one color that best represents the product design |");
lines.push("");
lines.push("The goal of this analysis is to help determine:");
lines.push("1. Which color from imgix / Node Vibrant to use as an automated swatch");
lines.push("2. How much the two tools differ from each other and from Nova Lite");
lines.push("");
lines.push("---");
lines.push("");
lines.push("## Coverage");
lines.push("");
lines.push(`| Tool | Results returned | Failed / Missing |`);
lines.push(`|---|---|---|`);
lines.push(`| imgix Palette | ${imgixResults.filter((r) => r.data).length} | ${imgixResults.filter((r) => !r.data).length} |`);
lines.push(`| Node Vibrant | ${vibrantResults.filter((r) => r.data).length} | ${vibrantResults.filter((r) => !r.data).length} |`);
lines.push(`| AWS Nova Lite | ${bedrockResults.filter((r) => r.data?.hex).length} | ${bedrockResults.filter((r) => !r.data?.hex).length} |`);
lines.push("");
lines.push("---");
lines.push("");
lines.push("## AWS Nova Lite Swatch Distribution");
lines.push("");
lines.push("Nova Lite recommends a single swatch per image. Across all footwear images, the recommended swatches fall into these color families:");
lines.push("");
lines.push("| Color Family | Count | % |");
lines.push("|---|---|---|");
for (const [label, count] of Object.entries(novaLabelCounts).sort((a, b) => b[1] - a[1])) {
  lines.push(`| ${label} | ${count} | ${Math.round((count / validNova.length) * 100)}% |`);
}
lines.push("");
lines.push("---");
lines.push("");
lines.push("## imgix vs Node Vibrant: Agreement on \"Vibrant\" Color");
lines.push("");
lines.push("Both tools return a **Vibrant** dominant color. How similar are they?");
lines.push("");
lines.push(`- Images with both Vibrant values: **${validImgixVibrant.length}**`);
lines.push(`- Average Euclidean RGB distance between imgix Vibrant and Node Vibrant: **${avgVibrantVsImgix}** *(0 = identical, 441 = maximum possible)*`);
lines.push("");

// Bucket distances
const buckets = { "0–30 (very similar)": 0, "31–80 (similar)": 0, "81–150 (moderate)": 0, "151–250 (large)": 0, "251+ (very different)": 0 };
for (const a of validImgixVibrant) {
  const d = a.vibrantVsImgixDist ?? 0;
  if (d <= 30) buckets["0–30 (very similar)"]++;
  else if (d <= 80) buckets["31–80 (similar)"]++;
  else if (d <= 150) buckets["81–150 (moderate)"]++;
  else if (d <= 250) buckets["151–250 (large)"]++;
  else buckets["251+ (very different)"]++;
}
lines.push("**Distribution of Vibrant color distance (imgix vs Node Vibrant):**");
lines.push("");
lines.push("| Distance Range | Count | % |");
lines.push("|---|---|---|");
for (const [bucket, count] of Object.entries(buckets)) {
  lines.push(`| ${bucket} | ${count} | ${Math.round((count / validImgixVibrant.length) * 100)}% |`);
}
lines.push("");
lines.push("**Interpretation:**");
lines.push("- A low average distance means imgix and Node Vibrant generally agree on the dominant Vibrant color.");
lines.push("- A large portion of results in the \"very similar\" or \"similar\" buckets would indicate the tools are interchangeable for swatch extraction.");
lines.push("");
lines.push("---");
lines.push("");
lines.push("## Which Tool Agrees More with AWS Nova Lite?");
lines.push("");
lines.push(`Nova Lite recommends a single swatch. We compare that swatch against each tool's 6 dominant colors to find the closest match.`);
lines.push("");
lines.push(`| | Count | Avg distance to Nova |`);
lines.push(`|---|---|---|`);
lines.push(`| imgix closest dominant color matches Nova better | ${closerToImgix} | ${avgImgixDomToNova} |`);
lines.push(`| Node Vibrant closest dominant color matches Nova better | ${closerToVibrant} | ${avgVibrantToNova} |`);
lines.push("");
lines.push("---");
lines.push("");
lines.push("## Which Dominant Color to Use as Swatch (imgix)?");
lines.push("");
lines.push("If using **imgix**, which of its 6 dominant color categories most often matches Nova Lite's recommendation?");
lines.push("");
lines.push("| imgix Dominant Category | Times closest to Nova | % of images |");
lines.push("|---|---|---|");
for (const [key, count] of sortedImgixKeys) {
  const label = key.replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());
  lines.push(`| ${label} | ${count} | ${Math.round((count / validNova.filter((a) => a.imgixClosestToNova).length) * 100)}% |`);
}
lines.push("");
lines.push("**Recommendation for imgix:** Use the dominant color category that appears most frequently above as the automated swatch.");
lines.push("");
lines.push("---");
lines.push("");
lines.push("## Which Dominant Color to Use as Swatch (Node Vibrant)?");
lines.push("");
lines.push("If using **Node Vibrant**, which category most often matches Nova Lite?");
lines.push("");
lines.push("| Node Vibrant Category | Times closest to Nova | % of images |");
lines.push("|---|---|---|");
for (const [key, count] of sortedVibrantKeys) {
  const label = key.replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());
  lines.push(`| ${label} | ${count} | ${Math.round((count / validNova.filter((a) => a.vibrantClosestToNova).length) * 100)}% |`);
}
lines.push("");
lines.push("**Recommendation for Node Vibrant:** Use the dominant color category that appears most frequently above.");
lines.push("");
lines.push("---");
lines.push("");
lines.push("## Cases of High Disagreement Between imgix and Node Vibrant");
lines.push("");
lines.push(`Images where the two tools' **Vibrant** colors differ most (top ${highDisagreement.length}):`);
lines.push("");
lines.push("| Image | imgix Vibrant | Node Vibrant | Distance |");
lines.push("|---|---|---|---|");
for (const a of highDisagreement) {
  lines.push(`| ${a.base} | ${a.imgixVibrantHex ?? "—"} | ${a.vibrantVibrantHex ?? "—"} | ${a.vibrantVsImgixDist} |`);
}
lines.push("");
lines.push("---");
lines.push("");
lines.push("## Per-Image Data");
lines.push("");
lines.push("Complete results for all footwear images:");
lines.push("");
lines.push("| Image | imgix Vibrant | imgix Closest to Nova | Node Vibrant | Vibrant Closest to Nova | Nova Lite | imgix↔Nova dist | Vibrant↔Nova dist |");
lines.push("|---|---|---|---|---|---|---|---|");

for (const a of imageAnalysis) {
  const imgixVib = a.imgixVibrantHex ?? "—";
  const imgixClosest = a.imgixClosestToNova
    ? `${a.imgixClosestToNova.hex} (${a.imgixClosestToNova.key.replace(/_/g, " ")})`
    : "—";
  const vibVib = a.vibrantVibrantHex ?? "—";
  const vibClosest = a.vibrantClosestToNova
    ? `${a.vibrantClosestToNova.hex} (${a.vibrantClosestToNova.key.replace(/_/g, " ")})`
    : "—";
  const nova = a.novaHex ?? "—";
  const iDist = a.imgixClosestToNova?.distance ?? "—";
  const vDist = a.vibrantClosestToNova?.distance ?? "—";
  lines.push(`| ${a.base} | ${imgixVib} | ${imgixClosest} | ${vibVib} | ${vibClosest} | ${nova} | ${iDist} | ${vDist} |`);
}

lines.push("");
lines.push("---");
lines.push("");
lines.push("## Summary & Recommendations");
lines.push("");
lines.push("### For your team considering automated swatch generation:");
lines.push("");

const topImgixKey = sortedImgixKeys[0]?.[0] ?? "vibrant";
const topVibrantKey = sortedVibrantKeys[0]?.[0] ?? "vibrant";
const topImgixLabel = topImgixKey.replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());
const topVibrantLabel = topVibrantKey.replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());
const betterTool = closerToImgix > closerToVibrant ? "imgix" : "Node Vibrant";

lines.push(`1. **Recommended swatch color from imgix:** Use the **${topImgixLabel}** dominant color — it most frequently matches AWS Nova Lite's recommendation (${sortedImgixKeys[0]?.[1]} out of ${validNova.filter((a) => a.imgixClosestToNova).length} images).`);
lines.push("");
lines.push(`2. **Recommended swatch color from Node Vibrant:** Use the **${topVibrantLabel}** dominant color — it most frequently matches AWS Nova Lite's recommendation (${sortedVibrantKeys[0]?.[1]} out of ${validNova.filter((a) => a.vibrantClosestToNova).length} images).`);
lines.push("");
lines.push(`3. **Tool agreement with Nova Lite:** ${betterTool} agrees more closely with AWS Nova Lite overall (${closerToImgix} images favour imgix, ${closerToVibrant} favour Node Vibrant).`);
lines.push("");
lines.push(`4. **imgix vs Node Vibrant agreement:** The average Euclidean RGB distance between their Vibrant colors is **${avgVibrantVsImgix}**. ${avgVibrantVsImgix <= 50 ? "This is low, meaning the two tools are largely interchangeable for footwear." : avgVibrantVsImgix <= 120 ? "This is moderate — the tools agree on many images but diverge meaningfully on others." : "This is high — the tools often return significantly different colors and the choice of tool matters."}`);
lines.push("");
lines.push("5. **Cost / infrastructure trade-off:**");
lines.push("   - imgix is a CDN-based service; palette extraction is fast and cheap at scale.");
lines.push("   - Node Vibrant runs server-side; no third-party dependency but requires compute.");
lines.push("   - AWS Nova Lite is the most expensive (LLM inference per image) but offers the most semantically informed swatch.");
lines.push("");

const report = lines.join("\n");

mkdirSync(join(ROOT, "reports"), { recursive: true });
const outPath = join(ROOT, "reports/color-palette-footwear.md");
writeFileSync(outPath, report, "utf8");
console.log(`\nReport written to: ${outPath}`);
