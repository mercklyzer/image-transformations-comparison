import fs from "node:fs";
import path from "node:path";
import {
  BedrockRuntimeClient,
  ConverseCommand,
} from "@aws-sdk/client-bedrock-runtime";
import type { NextApiRequest, NextApiResponse } from "next";
import { getCachedPalette, setCachedPalette } from "@/lib/db";

const client = new BedrockRuntimeClient({ region: process.env.AWS_REGION });

const MODEL_ID = "us.anthropic.claude-3-5-haiku-20241022-v1:0";

const PROMPT = fs.readFileSync(
  path.join(process.cwd(), "src/data/nova-lite-pattern.md"),
  "utf-8",
);

const SWATCH_DIR = path.join(process.cwd(), "public", "swatches-haiku");

interface PatternResponse {
  reasoning: string;
  coordinates: { x: number; y: number };
  size: number;
  imgix_url_params: string;
}

function filenameFromUrl(url: string): string {
  return url.split("/").pop()?.split("?")[0] ?? url;
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

function imgixPathFromUrl(url: string): string | null {
  const uploadIndex = url.indexOf("/upload/");
  if (uploadIndex === -1) return null;
  return url.slice(uploadIndex + "/upload/".length);
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
  return `/swatches-haiku/${filename}`;
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

  // Tier 1: local file already persisted — still need DB for size metadata
  if (fs.existsSync(swatchPath)) {
    const cached = (await getCachedPalette(
      filename,
      "Claude Haiku Pattern",
    )) as PatternResponse | null;
    res.setHeader(
      "Cache-Control",
      "public, max-age=86400, stale-while-revalidate=604800",
    );
    return res.status(200).json({
      swatchUrl: `/swatches-haiku/${filename}`,
      coordinates: cached?.coordinates,
      size: cached?.size,
      reasoning: cached?.reasoning,
    });
  }

  const imgixPath = imgixPathFromUrl(url);
  if (!imgixPath) {
    return res.status(400).json({ error: "Invalid Cloudinary URL" });
  }

  try {
    // Tier 2: DB-cached coordinates (skip Claude, just fetch imgix + persist)
    const cached = (await getCachedPalette(
      filename,
      "Claude Haiku Pattern",
    )) as PatternResponse | null;
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
        reasoning: cached.reasoning,
      });
    }

    // Tier 3: full Bedrock flow
    const imageRes = await fetch(url);
    if (!imageRes.ok) {
      return res.status(502).json({ error: "Failed to fetch image" });
    }
    const contentType = imageRes.headers.get("content-type") ?? "";
    const format = detectFormat(contentType, url);
    const arrayBuffer = await imageRes.arrayBuffer();
    const bytes = new Uint8Array(arrayBuffer);

    const command = new ConverseCommand({
      modelId: MODEL_ID,
      messages: [
        {
          role: "user",
          content: [{ image: { format, source: { bytes } } }, { text: PROMPT }],
        },
      ],
    });

    const response = await client.send(command);
    const text = response.output?.message?.content?.[0]?.text ?? "";
    console.log("[claude-haiku-bedrock-pattern] raw response:", text);

    const cleaned = text
      .replace(/^```[a-z]*\n?/i, "")
      .replace(/```$/, "")
      .trim();
    const parsed: PatternResponse = JSON.parse(cleaned);
    console.log("[claude-haiku-bedrock-pattern] parsed:", parsed);

    const { x, y } = parsed.coordinates ?? {};
    const { size } = parsed;
    if (
      typeof x !== "number" ||
      typeof y !== "number" ||
      typeof size !== "number" ||
      !Number.isInteger(x) ||
      !Number.isInteger(y) ||
      !Number.isInteger(size) ||
      x < 0 ||
      y < 0 ||
      size <= 0
    ) {
      console.error("[claude-haiku-bedrock-pattern] invalid coordinates/size:", parsed);
      return res.status(502).json({
        error: "Model did not return valid coordinates or size",
        raw: parsed,
      });
    }

    await setCachedPalette(filename, "Claude Haiku Pattern", parsed);

    const swatchUrl = await fetchAndPersistSwatch(
      imgixPath,
      x,
      y,
      size,
      filename,
    );

    res.setHeader(
      "Cache-Control",
      "public, max-age=86400, stale-while-revalidate=604800",
    );
    return res.status(200).json({
      swatchUrl,
      coordinates: { x, y },
      size,
      reasoning: parsed.reasoning,
    });
  } catch (err) {
    console.error("Claude Haiku Bedrock pattern error:", err);
    return res.status(500).json({ error: "Failed to extract pattern swatch" });
  }
}
