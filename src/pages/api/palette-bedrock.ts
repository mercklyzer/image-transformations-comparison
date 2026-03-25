import {
  BedrockRuntimeClient,
  ConverseCommand,
} from "@aws-sdk/client-bedrock-runtime";
import type { NextApiRequest, NextApiResponse } from "next";
import { getCachedPalette, setCachedPalette } from "@/lib/db";

const client = new BedrockRuntimeClient({ region: process.env.AWS_REGION });

const MODEL_ID = "amazon.nova-lite-v1:0";

const PROMPT =
  'Look at this product image. Identify the single color that best represents the product variant shown — this is the color a customer would use to identify the product (e.g. "red", "navy", "olive"). Ignore backgrounds, shadows, and packaging. Return ONLY a valid JSON object with a single key "hex" containing that color as a hex code (e.g. {"hex": "#c0392b"}). No explanation, no markdown, just the raw JSON object.';

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

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse,
) {
  const { url } = req.query;
  if (!url || typeof url !== "string") {
    return res.status(400).json({ error: "Missing url param" });
  }

  const filename = filenameFromUrl(url);

  try {
    const cached = await getCachedPalette(filename, "AWS Nova Lite");
    if (cached) {
      res.setHeader(
        "Cache-Control",
        "public, max-age=86400, stale-while-revalidate=604800",
      );
      return res.status(200).json(cached);
    }
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
    console.log("[bedrock] raw response:", text);

    // Strip potential markdown code fences
    const cleaned = text
      .replace(/^```[a-z]*\n?/i, "")
      .replace(/```$/, "")
      .trim();
    const parsed = JSON.parse(cleaned);
    console.log("[bedrock] parsed:", parsed);

    const hex: string | undefined = parsed.hex;
    if (!hex || !/^#[0-9a-fA-F]{6}$/.test(hex)) {
      console.error(
        "[bedrock] invalid or missing hex:",
        hex,
        "| full parsed:",
        parsed,
      );
      return res
        .status(502)
        .json({ error: "Model did not return a valid hex color", raw: parsed });
    }

    const data = { hex };
    await setCachedPalette(filename, "AWS Nova Lite", data);

    res.setHeader(
      "Cache-Control",
      "public, max-age=86400, stale-while-revalidate=604800",
    );
    return res.status(200).json(data);
  } catch (err) {
    console.error("Bedrock palette error:", err);
    return res.status(500).json({ error: "Failed to extract palette" });
  }
}
