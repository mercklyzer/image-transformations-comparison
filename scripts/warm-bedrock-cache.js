#!/usr/bin/env node

/**
 * Warm the Bedrock palette cache by calling /api/palette-bedrock for every
 * image source URL in both datasets.
 *
 * Usage:
 *   node scripts/warm-bedrock-cache.js [--concurrency 5] [--dataset babywear|footwear|all] [--base-url http://localhost:3000]
 *
 * Defaults: concurrency=5, dataset=all, base-url=http://localhost:3000
 */

const babywear = require("../src/data/images.json");
const footwear = require("../src/data/images-footwear.json");

function parseArgs() {
  const args = process.argv.slice(2);
  const opts = {
    concurrency: 5,
    dataset: "all",
    baseUrl: "http://localhost:3000",
  };
  for (let i = 0; i < args.length; i++) {
    if (args[i] === "--concurrency" && args[i + 1]) {
      opts.concurrency = parseInt(args[i + 1], 10);
      i++;
    } else if (args[i] === "--dataset" && args[i + 1]) {
      opts.dataset = args[i + 1];
      i++;
    } else if (args[i] === "--base-url" && args[i + 1]) {
      opts.baseUrl = args[i + 1];
      i++;
    }
  }
  return opts;
}

async function main() {
  const opts = parseArgs();
  const { concurrency, dataset, baseUrl } = opts;

  let images = [];
  if (dataset === "all" || dataset === "babywear") {
    images.push(...babywear.map((img) => ({ ...img, dataset: "babywear" })));
  }
  if (dataset === "all" || dataset === "footwear") {
    images.push(...footwear.map((img) => ({ ...img, dataset: "footwear" })));
  }

  // Filter to only images that have a source URL
  const queue = images.filter((img) => img.source);

  console.log(`\nDataset: ${dataset}`);
  console.log(`Total images with source URL: ${queue.length}`);
  console.log(`Concurrency: ${concurrency}`);
  console.log(`Base URL: ${baseUrl}`);
  console.log(`API endpoint: ${baseUrl}/api/palette-bedrock?url=...\n`);

  let completed = 0;
  let succeeded = 0;
  let cached = 0;
  let failed = 0;
  const errors = [];

  async function processImage(img) {
    const apiUrl = `${baseUrl}/api/palette-bedrock?url=${encodeURIComponent(img.source)}`;
    const start = Date.now();
    try {
      const res = await fetch(apiUrl);
      const elapsed = Date.now() - start;
      const body = await res.json();

      completed++;
      if (res.ok && body.hex) {
        succeeded++;
        // If response was very fast, it's likely a cache hit
        if (elapsed < 500) cached++;
        const progress = `[${completed}/${queue.length}]`;
        console.log(
          `${progress} ✓ ${img.base} (${img.dataset}) → ${body.hex}  (${elapsed}ms)`,
        );
      } else {
        failed++;
        const progress = `[${completed}/${queue.length}]`;
        console.log(
          `${progress} ✗ ${img.base} (${img.dataset}) → ${res.status} ${JSON.stringify(body)}  (${elapsed}ms)`,
        );
        errors.push({ base: img.base, status: res.status, body });
      }
    } catch (err) {
      completed++;
      failed++;
      const progress = `[${completed}/${queue.length}]`;
      console.log(
        `${progress} ✗ ${img.base} (${img.dataset}) → ${err.message}`,
      );
      errors.push({ base: img.base, error: err.message });
    }
  }

  // Process with bounded concurrency
  let idx = 0;
  async function pump() {
    while (idx < queue.length) {
      const img = queue[idx++];
      await processImage(img);
    }
  }

  const workers = Array.from(
    { length: Math.min(concurrency, queue.length) },
    () => pump(),
  );
  await Promise.all(workers);

  console.log("\n--- Summary ---");
  console.log(`Total:     ${queue.length}`);
  console.log(`Succeeded: ${succeeded} (${cached} likely cached)`);
  console.log(`Failed:    ${failed}`);

  if (errors.length > 0) {
    console.log("\nFailed images:");
    for (const e of errors) {
      console.log(
        `  ${e.base}: ${e.status || ""} ${e.error || JSON.stringify(e.body)}`,
      );
    }
  }
}

main().catch((err) => {
  console.error("Fatal error:", err);
  process.exit(1);
});
