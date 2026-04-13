import fs from "node:fs";
import path from "node:path";
import {
  type BoundingBox,
  DetectLabelsCommand,
  type Label,
  RekognitionClient,
} from "@aws-sdk/client-rekognition";
import type { NextApiRequest, NextApiResponse } from "next";
import { getCachedPalette, setCachedPalette } from "@/lib/db";

const client = new RekognitionClient({ region: process.env.AWS_REGION });

const SWATCH_DIR = path.join(process.cwd(), "public", "swatches-rekognition");

interface RekognitionSwatchData {
  swatchUrl: string;
  coordinates: { x: number; y: number };
  size: number;
  label: string;
  confidence: number;
}

function filenameFromUrl(url: string): string {
  return url.split("/").pop()?.split("?")[0] ?? url;
}

function imgixPathFromUrl(url: string): string | null {
  const uploadIndex = url.indexOf("/upload/");
  if (uploadIndex === -1) return null;
  return url.slice(uploadIndex + "/upload/".length);
}

function detectFormat(
  contentType: string,
  url: string,
): "jpeg" | "png" | "gif" | "webp" {
  if (contentType.includes("png") || url.endsWith(".png")) return "png";
  if (contentType.includes("gif") || url.endsWith(".gif")) return "gif";
  if (contentType.includes("webp") || url.endsWith(".webp")) return "webp";
  return "jpeg";
}

async function getImageDimensions(
  imgixPath: string,
): Promise<{ width: number; height: number }> {
  const url = `https://lyzer-business.imgix.net/${imgixPath}?fm=json`;
  const res = await fetch(url);
  if (!res.ok) throw new Error(`imgix metadata fetch failed: ${res.status}`);
  const data = (await res.json()) as {
    PixelWidth: number;
    PixelHeight: number;
  };
  return { width: data.PixelWidth, height: data.PixelHeight };
}

async function fetchAndPersistSwatch(
  imgixPath: string,
  x: number,
  y: number,
  size: number,
  filename: string,
): Promise<string> {
  const imgixUrl = `https://lyzer-business.imgix.net/${imgixPath}?rect=${x},${y},${size},${size}`;
  const imgRes = await fetch(imgixUrl);
  if (!imgRes.ok) {
    throw new Error(`imgix fetch failed: ${imgRes.status}`);
  }
  const arrayBuffer = await imgRes.arrayBuffer();
  await fs.promises.mkdir(SWATCH_DIR, { recursive: true });
  await fs.promises.writeFile(
    path.join(SWATCH_DIR, filename),
    Buffer.from(arrayBuffer),
  );
  return `/swatches-rekognition/${filename}`;
}

function cropFromBoundingBox(
  bbox: BoundingBox,
  imgWidth: number,
  imgHeight: number,
): { x: number; y: number; size: number } {
  // Convert relative coords to pixels
  const left = Math.round((bbox.Left ?? 0) * imgWidth);
  const top = Math.round((bbox.Top ?? 0) * imgHeight);
  const bboxW = Math.round((bbox.Width ?? 1) * imgWidth);
  const bboxH = Math.round((bbox.Height ?? 1) * imgHeight);

  // Inset 15% horizontally to avoid side seams and product edges
  const insetX = Math.round(bboxW * 0.15);
  const innerLeft = left + insetX;
  const innerW = bboxW - 2 * insetX;

  // Vertically: skip collar/neckline (top 15%) and hem (bottom 25%)
  // to land on the chest/mid-body where fabric is cleanest and most evenly lit
  const topSkip = Math.round(bboxH * 0.15);
  const bottomSkip = Math.round(bboxH * 0.25);
  const innerTop = top + topSkip;
  const innerH = bboxH - topSkip - bottomSkip;

  // Square: largest that fits within the inset region
  const maxSize = Math.min(innerW, innerH);

  // Cap at 40% of the image's shortest dimension
  const cap = Math.floor(Math.min(imgWidth, imgHeight) * 0.4);
  const size = Math.min(maxSize, cap);

  // Center horizontally; bias vertically toward upper portion of inner zone (chest area)
  const x = Math.round(innerLeft + (innerW - size) / 2);
  const y = Math.round(innerTop + (innerH - size) * 0.25);

  return {
    x: Math.max(0, x),
    y: Math.max(0, y),
    size: Math.max(1, size),
  };
}

function pickBestBoundingBox(
  labels: Label[],
): { bbox: BoundingBox; label: string; confidence: number } | null {
  type Candidate = { bbox: BoundingBox; label: string; confidence: number };

  // const EXCLUDED_LABELS = new Set([
  //   "Person", "Human", "People", "Face",
  //   "Man", "Woman", "Boy", "Girl", "Adult", "Child", "Baby",
  // ]);
  const EXCLUDED_LABELS = new Set<string>();

  const candidates: Candidate[] = labels
    .filter((label) => !EXCLUDED_LABELS.has(label.Name ?? ""))
    .flatMap((label) =>
      (label.Instances ?? [])
        .filter((inst) => inst.BoundingBox !== undefined)
        .map((inst) => ({
          bbox: inst.BoundingBox!,
          label: label.Name ?? "Object",
          confidence: inst.Confidence ?? label.Confidence ?? 0,
        })),
    );

  if (candidates.length === 0) return null;

  // Pick the instance with the largest bounding box area — the dominant product
  return candidates.reduce((prev, curr) =>
    (curr.bbox.Width ?? 0) * (curr.bbox.Height ?? 0) >
    (prev.bbox.Width ?? 0) * (prev.bbox.Height ?? 0)
      ? curr
      : prev,
  );
}

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse,
) {
  const { url } = req.query;
  if (!url || typeof url !== "string") {
    return res.status(400).json({ error: "Missing url param" });
  }

  const filename = filenameFromUrl(url);
  const swatchPath = path.join(SWATCH_DIR, filename);

  // Tier 1: local file already persisted
  if (fs.existsSync(swatchPath)) {
    const cached = (await getCachedPalette(
      filename,
      "Rekognition Pattern",
    )) as RekognitionSwatchData | null;
    res.setHeader(
      "Cache-Control",
      "public, max-age=86400, stale-while-revalidate=604800",
    );
    return res.status(200).json({
      swatchUrl: `/swatches-rekognition/${filename}`,
      coordinates: cached?.coordinates,
      size: cached?.size,
      label: cached?.label,
      confidence: cached?.confidence,
    });
  }

  const imgixPath = imgixPathFromUrl(url);
  if (!imgixPath) {
    return res.status(400).json({ error: "Invalid Cloudinary URL" });
  }

  try {
    // Tier 2: DB-cached coordinates
    const cached = (await getCachedPalette(
      filename,
      "Rekognition Pattern",
    )) as RekognitionSwatchData | null;
    if (cached?.coordinates && cached?.size) {
      const { x, y } = cached.coordinates;
      const swatchUrl = await fetchAndPersistSwatch(
        imgixPath,
        x,
        y,
        cached.size,
        filename,
      );
      res.setHeader(
        "Cache-Control",
        "public, max-age=86400, stale-while-revalidate=604800",
      );
      return res.status(200).json({
        swatchUrl,
        coordinates: cached.coordinates,
        size: cached.size,
        label: cached.label,
        confidence: cached.confidence,
      });
    }

    // Tier 3: full Rekognition flow
    const [imageRes, dimensions] = await Promise.all([
      fetch(url),
      getImageDimensions(imgixPath),
    ]);

    if (!imageRes.ok) {
      return res.status(502).json({ error: "Failed to fetch image" });
    }

    const contentType = imageRes.headers.get("content-type") ?? "";
    detectFormat(contentType, url); // validate format
    const arrayBuffer = await imageRes.arrayBuffer();
    const bytes = new Uint8Array(arrayBuffer);

    const command = new DetectLabelsCommand({
      Image: { Bytes: bytes },
      MaxLabels: 20,
      MinConfidence: 60,
    });

    const response = await client.send(command);
    console.log(
      "[rekognition] labels:",
      response.Labels?.map(
        (l) => `${l.Name}(${l.Confidence?.toFixed(0)}%)`,
      ).join(", "),
    );

    const best = pickBestBoundingBox(response.Labels ?? []);
    if (!best) {
      console.error("[rekognition] no usable bounding box found");
      return res
        .status(502)
        .json({ error: "No product bounding box detected" });
    }

    console.log(
      `[rekognition] best label: ${best.label} (${best.confidence.toFixed(0)}%) bbox:`,
      best.bbox,
    );

    const { x, y, size } = cropFromBoundingBox(
      best.bbox,
      dimensions.width,
      dimensions.height,
    );

    const result: RekognitionSwatchData = {
      swatchUrl: "",
      coordinates: { x, y },
      size,
      label: best.label,
      confidence: Math.round(best.confidence),
    };

    await setCachedPalette(filename, "Rekognition Pattern", result);

    const swatchUrl = await fetchAndPersistSwatch(
      imgixPath,
      x,
      y,
      size,
      filename,
    );
    result.swatchUrl = swatchUrl;

    res.setHeader(
      "Cache-Control",
      "public, max-age=86400, stale-while-revalidate=604800",
    );
    return res.status(200).json({
      swatchUrl,
      coordinates: { x, y },
      size,
      label: best.label,
      confidence: Math.round(best.confidence),
    });
  } catch (err) {
    console.error("Rekognition error:", err);
    return res
      .status(500)
      .json({ error: "Failed to extract Rekognition swatch" });
  }
}
