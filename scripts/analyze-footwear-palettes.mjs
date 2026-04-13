import { neon } from "@neondatabase/serverless";
import { readFileSync } from "fs";

const DATABASE_URL = process.env.DATABASE_URL;
const sql = neon(DATABASE_URL);

const images = JSON.parse(
  readFileSync("src/data/images-footwear.json", "utf8"),
);
const filenames = images.map((img) => img.base + ".jpg");

console.log(`Total footwear images: ${filenames.length}`);

// Fetch all palettes at once
const rows =
  await sql`SELECT filename, tool, data FROM palettes WHERE filename = ANY(${filenames})`;

// Organize by filename
const byFile = {};
for (const row of rows) {
  if (!byFile[row.filename]) byFile[row.filename] = {};
  byFile[row.filename][row.tool] = row.data;
}

// Helper: parse hex to RGB
function hexToRgb(hex) {
  hex = hex.replace("#", "");
  return {
    r: parseInt(hex.substring(0, 2), 16),
    g: parseInt(hex.substring(2, 4), 16),
    b: parseInt(hex.substring(4, 6), 16),
  };
}

// Euclidean distance in RGB space
function colorDistance(hex1, hex2) {
  const c1 = hexToRgb(hex1);
  const c2 = hexToRgb(hex2);
  return Math.sqrt(
    (c1.r - c2.r) ** 2 + (c1.g - c2.g) ** 2 + (c1.b - c2.b) ** 2,
  );
}

// Categorize a color
function categorizeColor(hex) {
  const { r, g, b } = hexToRgb(hex);
  const lum = 0.299 * r + 0.587 * g + 0.114 * b;
  if (lum < 30) return "Black/Very Dark";
  if (lum > 225) return "White/Very Light";
  if (lum > 180 && Math.abs(r - g) < 30 && Math.abs(g - b) < 30)
    return "Light Gray";
  if (lum < 80 && Math.abs(r - g) < 20 && Math.abs(g - b) < 20)
    return "Dark Gray";
  if (Math.abs(r - g) < 25 && Math.abs(g - b) < 25 && Math.abs(r - b) < 25)
    return "Gray/Neutral";

  // Chromatic colors
  const max = Math.max(r, g, b);
  const min = Math.min(r, g, b);
  let h = 0;
  if (max === min) h = 0;
  else if (max === r) h = 60 * (((g - b) / (max - min)) % 6);
  else if (max === g) h = 60 * ((b - r) / (max - min) + 2);
  else h = 60 * ((r - g) / (max - min) + 4);
  if (h < 0) h += 360;

  if (h < 15 || h >= 345) return "Red";
  if (h < 45) return "Orange";
  if (h < 70) return "Yellow";
  if (h < 165) return "Green";
  if (h < 200) return "Cyan";
  if (h < 260) return "Blue";
  if (h < 310) return "Purple";
  return "Pink";
}

const imgixDominantKeys = [
  "vibrant",
  "vibrant_dark",
  "vibrant_light",
  "muted",
  "muted_dark",
  "muted_light",
];
const vibrantDominantKeys = [
  "vibrant",
  "vibrant_dark",
  "vibrant_light",
  "muted",
  "muted_dark",
  "muted_light",
];

const results = [];
let missingCount = 0;

for (const filename of filenames) {
  const data = byFile[filename];
  if (!data || !data.imgix || !data.vibrant || !data["AWS Nova Lite"]) {
    missingCount++;
    continue;
  }

  const imgixData = data.imgix;
  const vibrantData = data.vibrant;
  const novaData = data["AWS Nova Lite"];
  const novaHex = novaData.hex;

  const entry = { filename, novaHex };

  // imgix dominant colors
  entry.imgixDominant = {};
  for (const key of imgixDominantKeys) {
    if (imgixData.dominant_colors?.[key]?.hex) {
      entry.imgixDominant[key] = imgixData.dominant_colors[key].hex;
    }
  }

  // imgix first color (most frequent)
  entry.imgixFirstColor = imgixData.colors?.[0]?.hex || null;

  // Node vibrant dominant colors
  entry.vibrantDominant = {};
  for (const key of vibrantDominantKeys) {
    if (vibrantData.dominant_colors?.[key]?.hex) {
      entry.vibrantDominant[key] = vibrantData.dominant_colors[key].hex;
    }
  }

  results.push(entry);
}

console.log(`Images with complete data: ${results.length}`);
console.log(`Missing data: ${missingCount}`);

// ===== ANALYSIS 1: For each image, which imgix dominant color is closest to a "good swatch"? =====
// We'll use our own judgment here - looking at the actual product images through the colors

// For each image, compute distances from Nova to each imgix dominant and first color
console.log(
  "\n=== ANALYSIS: Distance from Nova Lite to each imgix category ===",
);

const imgixCategoryDistances = {};
for (const key of [...imgixDominantKeys, "first_color"]) {
  imgixCategoryDistances[key] = [];
}

const vibrantCategoryDistances = {};
for (const key of vibrantDominantKeys) {
  vibrantCategoryDistances[key] = [];
}

// Track which category is closest for each image
const imgixBestCategory = {};
const vibrantBestCategory = {};

for (const entry of results) {
  // imgix analysis
  let bestImgixDist = Infinity;
  let bestImgixKey = null;

  for (const key of imgixDominantKeys) {
    if (entry.imgixDominant[key]) {
      const dist = colorDistance(entry.imgixDominant[key], entry.novaHex);
      imgixCategoryDistances[key].push(dist);
      if (dist < bestImgixDist) {
        bestImgixDist = dist;
        bestImgixKey = key;
      }
    }
  }

  // imgix first color
  if (entry.imgixFirstColor) {
    const dist = colorDistance(entry.imgixFirstColor, entry.novaHex);
    imgixCategoryDistances["first_color"].push(dist);
    if (dist < bestImgixDist) {
      bestImgixDist = dist;
      bestImgixKey = "first_color";
    }
  }

  if (bestImgixKey) {
    imgixBestCategory[bestImgixKey] =
      (imgixBestCategory[bestImgixKey] || 0) + 1;
  }

  // Vibrant analysis
  let bestVibrantDist = Infinity;
  let bestVibrantKey = null;

  for (const key of vibrantDominantKeys) {
    if (entry.vibrantDominant[key]) {
      const dist = colorDistance(entry.vibrantDominant[key], entry.novaHex);
      vibrantCategoryDistances[key].push(dist);
      if (dist < bestVibrantDist) {
        bestVibrantDist = dist;
        bestVibrantKey = key;
      }
    }
  }

  if (bestVibrantKey) {
    vibrantBestCategory[bestVibrantKey] =
      (vibrantBestCategory[bestVibrantKey] || 0) + 1;
  }
}

// Print average distances per category
console.log("\n--- imgix: Average distance to Nova Lite per category ---");
for (const key of [...imgixDominantKeys, "first_color"]) {
  const dists = imgixCategoryDistances[key];
  if (dists.length > 0) {
    const avg = dists.reduce((a, b) => a + b, 0) / dists.length;
    const median = dists.sort((a, b) => a - b)[Math.floor(dists.length / 2)];
    console.log(
      `  ${key}: avg=${avg.toFixed(1)}, median=${median.toFixed(1)}, n=${dists.length}`,
    );
  }
}

console.log("\n--- imgix: Which category is closest to Nova per image ---");
const imgixTotal = Object.values(imgixBestCategory).reduce((a, b) => a + b, 0);
for (const [key, count] of Object.entries(imgixBestCategory).sort(
  (a, b) => b[1] - a[1],
)) {
  console.log(
    `  ${key}: ${count} (${((count / imgixTotal) * 100).toFixed(1)}%)`,
  );
}

console.log(
  "\n--- Node Vibrant: Average distance to Nova Lite per category ---",
);
for (const key of vibrantDominantKeys) {
  const dists = vibrantCategoryDistances[key];
  if (dists.length > 0) {
    const avg = dists.reduce((a, b) => a + b, 0) / dists.length;
    const median = dists.sort((a, b) => a - b)[Math.floor(dists.length / 2)];
    console.log(
      `  ${key}: avg=${avg.toFixed(1)}, median=${median.toFixed(1)}, n=${dists.length}`,
    );
  }
}

console.log(
  "\n--- Node Vibrant: Which category is closest to Nova per image ---",
);
const vibrantTotal = Object.values(vibrantBestCategory).reduce(
  (a, b) => a + b,
  0,
);
for (const [key, count] of Object.entries(vibrantBestCategory).sort(
  (a, b) => b[1] - a[1],
)) {
  console.log(
    `  ${key}: ${count} (${((count / vibrantTotal) * 100).toFixed(1)}%)`,
  );
}

// ===== ANALYSIS 2: Agreement between imgix first color and Nova Lite =====
console.log("\n=== ANALYSIS: imgix first color vs Nova Lite ===");
const firstColorDists = [];
for (const entry of results) {
  if (entry.imgixFirstColor) {
    firstColorDists.push({
      filename: entry.filename,
      dist: colorDistance(entry.imgixFirstColor, entry.novaHex),
      imgixFirst: entry.imgixFirstColor,
      nova: entry.novaHex,
    });
  }
}
firstColorDists.sort((a, b) => a.dist - b.dist);

const fcDistBuckets = {
  "0-30": 0,
  "31-60": 0,
  "61-100": 0,
  "101-150": 0,
  "151+": 0,
};
for (const d of firstColorDists) {
  if (d.dist <= 30) fcDistBuckets["0-30"]++;
  else if (d.dist <= 60) fcDistBuckets["31-60"]++;
  else if (d.dist <= 100) fcDistBuckets["61-100"]++;
  else if (d.dist <= 150) fcDistBuckets["101-150"]++;
  else fcDistBuckets["151+"]++;
}
console.log("Distance distribution (imgix first color vs Nova):");
for (const [bucket, count] of Object.entries(fcDistBuckets)) {
  console.log(
    `  ${bucket}: ${count} (${((count / firstColorDists.length) * 100).toFixed(1)}%)`,
  );
}
const avgFC =
  firstColorDists.reduce((a, b) => a + b.dist, 0) / firstColorDists.length;
const medianFC = firstColorDists[Math.floor(firstColorDists.length / 2)].dist;
console.log(`  Average: ${avgFC.toFixed(1)}, Median: ${medianFC.toFixed(1)}`);

// ===== ANALYSIS 3: Cases where imgix first color matches Nova but Vibrant doesn't =====
console.log(
  "\n=== Cases where imgix first color is MUCH closer to Nova than Vibrant ===",
);
let fcBetterCount = 0;
let fcWorseCount = 0;
const interestingCases = [];
for (const entry of results) {
  if (!entry.imgixFirstColor || !entry.imgixDominant.vibrant) continue;
  const fcDist = colorDistance(entry.imgixFirstColor, entry.novaHex);
  const vibDist = colorDistance(entry.imgixDominant.vibrant, entry.novaHex);
  if (fcDist < vibDist - 30) {
    fcBetterCount++;
    if (vibDist - fcDist > 80) {
      interestingCases.push({
        filename: entry.filename,
        imgixFirst: entry.imgixFirstColor,
        imgixVibrant: entry.imgixDominant.vibrant,
        nova: entry.novaHex,
        fcDist: fcDist.toFixed(0),
        vibDist: vibDist.toFixed(0),
      });
    }
  } else if (vibDist < fcDist - 30) {
    fcWorseCount++;
  }
}
console.log(`First color significantly closer: ${fcBetterCount}`);
console.log(`Vibrant significantly closer: ${fcWorseCount}`);
console.log("Most dramatic differences (first color >> vibrant):");
interestingCases.sort((a, b) => b.vibDist - b.fcDist - (a.vibDist - a.fcDist));
for (const c of interestingCases.slice(0, 10)) {
  console.log(
    `  ${c.filename}: first=${c.imgixFirst} (d=${c.fcDist}), vibrant=${c.imgixVibrant} (d=${c.vibDist}), nova=${c.nova}`,
  );
}

// ===== ANALYSIS 4: imgix vibrant vs Node vibrant agreement =====
console.log("\n=== imgix Vibrant vs Node Vibrant agreement ===");
const ivDistances = [];
for (const entry of results) {
  if (entry.imgixDominant.vibrant && entry.vibrantDominant.vibrant) {
    ivDistances.push(
      colorDistance(entry.imgixDominant.vibrant, entry.vibrantDominant.vibrant),
    );
  }
}
const ivBuckets = {
  "0-30": 0,
  "31-60": 0,
  "61-100": 0,
  "101-150": 0,
  "151+": 0,
};
for (const d of ivDistances) {
  if (d <= 30) ivBuckets["0-30"]++;
  else if (d <= 60) ivBuckets["31-60"]++;
  else if (d <= 100) ivBuckets["61-100"]++;
  else if (d <= 150) ivBuckets["101-150"]++;
  else ivBuckets["151+"]++;
}
console.log(`Compared: ${ivDistances.length} images`);
for (const [bucket, count] of Object.entries(ivBuckets)) {
  console.log(
    `  ${bucket}: ${count} (${((count / ivDistances.length) * 100).toFixed(1)}%)`,
  );
}
const ivAvg = ivDistances.reduce((a, b) => a + b, 0) / ivDistances.length;
console.log(`  Average: ${ivAvg.toFixed(1)}`);

// ===== ANALYSIS 5: Per-image comparison for the report =====
// For each image, find which option is "best" and log disagreements
console.log("\n=== Per-image full data (for report) ===");

// Collect all data as JSON for further analysis
const fullData = [];
for (const entry of results) {
  const img = images.find((i) => i.base === entry.filename);
  const row = {
    filename: entry.filename,
    source: img?.source,
    nova: entry.novaHex,
    imgix_first: entry.imgixFirstColor,
    imgix_vibrant: entry.imgixDominant.vibrant || null,
    imgix_vibrant_dark: entry.imgixDominant.vibrant_dark || null,
    imgix_vibrant_light: entry.imgixDominant.vibrant_light || null,
    imgix_muted: entry.imgixDominant.muted || null,
    imgix_muted_dark: entry.imgixDominant.muted_dark || null,
    imgix_muted_light: entry.imgixDominant.muted_light || null,
    nv_vibrant: entry.vibrantDominant.vibrant || null,
    nv_vibrant_dark: entry.vibrantDominant.vibrant_dark || null,
    nv_vibrant_light: entry.vibrantDominant.vibrant_light || null,
    nv_muted: entry.vibrantDominant.muted || null,
    nv_muted_dark: entry.vibrantDominant.muted_dark || null,
    nv_muted_light: entry.vibrantDominant.muted_light || null,
  };

  // Distances to Nova
  row.d_imgix_first = entry.imgixFirstColor
    ? colorDistance(entry.imgixFirstColor, entry.novaHex).toFixed(0)
    : null;
  row.d_imgix_vibrant = entry.imgixDominant.vibrant
    ? colorDistance(entry.imgixDominant.vibrant, entry.novaHex).toFixed(0)
    : null;
  row.d_nv_vibrant = entry.vibrantDominant.vibrant
    ? colorDistance(entry.vibrantDominant.vibrant, entry.novaHex).toFixed(0)
    : null;

  // Best imgix option
  let bestDist = Infinity;
  let bestKey = null;
  for (const key of [...imgixDominantKeys, "first_color"]) {
    const hex =
      key === "first_color" ? entry.imgixFirstColor : entry.imgixDominant[key];
    if (hex) {
      const d = colorDistance(hex, entry.novaHex);
      if (d < bestDist) {
        bestDist = d;
        bestKey = key;
      }
    }
  }
  row.best_imgix = bestKey;
  row.best_imgix_dist = bestDist.toFixed(0);

  // Best NV option
  bestDist = Infinity;
  bestKey = null;
  for (const key of vibrantDominantKeys) {
    const hex = entry.vibrantDominant[key];
    if (hex) {
      const d = colorDistance(hex, entry.novaHex);
      if (d < bestDist) {
        bestDist = d;
        bestKey = key;
      }
    }
  }
  row.best_nv = bestKey;
  row.best_nv_dist = bestDist.toFixed(0);

  fullData.push(row);
}

// ===== ANALYSIS 6: My own independent judgment =====
// For dark products: Nova says black, imgix first color is often dark too
// Let me check if Nova black calls correlate with dark imgix first colors
console.log("\n=== Nova Lite color distribution ===");
const novaCategories = {};
for (const entry of results) {
  const cat = categorizeColor(entry.novaHex);
  novaCategories[cat] = (novaCategories[cat] || 0) + 1;
}
for (const [cat, count] of Object.entries(novaCategories).sort(
  (a, b) => b[1] - a[1],
)) {
  console.log(
    `  ${cat}: ${count} (${((count / results.length) * 100).toFixed(1)}%)`,
  );
}

// ===== ANALYSIS 7: Cases where Nova seems wrong =====
// Check for cases where Nova picks a very unusual color vs both imgix and NV
console.log(
  "\n=== Potential Nova Lite issues (disagreement with BOTH imgix and NV) ===",
);
const novaIssues = [];
for (const entry of results) {
  const imgVib = entry.imgixDominant.vibrant;
  const nvVib = entry.vibrantDominant.vibrant;
  if (!imgVib || !nvVib) continue;

  const imgNovaDist = colorDistance(imgVib, entry.novaHex);
  const nvNovaDist = colorDistance(nvVib, entry.novaHex);
  const imgNvDist = colorDistance(imgVib, nvVib);

  // If imgix and NV agree closely but both far from Nova
  if (imgNvDist < 40 && imgNovaDist > 100 && nvNovaDist > 100) {
    novaIssues.push({
      filename: entry.filename,
      imgixVibrant: imgVib,
      nvVibrant: nvVib,
      nova: entry.novaHex,
      imgNovaDist: imgNovaDist.toFixed(0),
      nvNovaDist: nvNovaDist.toFixed(0),
      imgNvDist: imgNvDist.toFixed(0),
    });
  }
}
console.log(
  `Cases where imgix+NV agree but Nova disagrees: ${novaIssues.length}`,
);
for (const c of novaIssues
  .sort((a, b) => Number(b.imgNovaDist) - Number(a.imgNovaDist))
  .slice(0, 20)) {
  console.log(
    `  ${c.filename}: imgix=${c.imgixVibrant}, nv=${c.nvVibrant} (agree d=${c.imgNvDist}), nova=${c.nova} (d=${c.imgNovaDist}/${c.nvNovaDist})`,
  );
}

// ===== ANALYSIS 8: What if we always use imgix dark_muted for dark products? =====
console.log("\n=== Strategy test: imgix muted_dark for dark Nova images ===");
const darkNovaImages = results.filter((e) => {
  const { r, g, b } = hexToRgb(e.novaHex);
  return 0.299 * r + 0.587 * g + 0.114 * b < 50;
});
console.log(`Dark Nova images: ${darkNovaImages.length}`);

let darkMutedMatch = 0;
let firstColorDarkMatch = 0;
for (const entry of darkNovaImages) {
  if (entry.imgixDominant.muted_dark) {
    const d = colorDistance(entry.imgixDominant.muted_dark, entry.novaHex);
    if (d < 50) darkMutedMatch++;
  }
  if (entry.imgixFirstColor) {
    const d = colorDistance(entry.imgixFirstColor, entry.novaHex);
    if (d < 50) firstColorDarkMatch++;
  }
}
console.log(
  `  muted_dark within 50 of Nova: ${darkMutedMatch} (${((darkMutedMatch / darkNovaImages.length) * 100).toFixed(1)}%)`,
);
console.log(
  `  first_color within 50 of Nova: ${firstColorDarkMatch} (${((firstColorDarkMatch / darkNovaImages.length) * 100).toFixed(1)}%)`,
);

// Output full JSON for detailed inspection
import { writeFileSync } from "fs";
writeFileSync(
  "scripts/footwear-palette-analysis.json",
  JSON.stringify(fullData, null, 2),
);
console.log("\nFull data written to scripts/footwear-palette-analysis.json");
