import type { NextApiRequest, NextApiResponse } from "next";
import { Vibrant } from "node-vibrant/node";
import { getCachedPalette, setCachedPalette } from "@/lib/db";

function filenameFromUrl(url: string): string {
  return url.split("/").pop()?.split("?")[0] ?? url;
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
    const cached = await getCachedPalette(filename, "vibrant");
    if (cached) {
      res.setHeader(
        "Cache-Control",
        "public, max-age=86400, stale-while-revalidate=604800",
      );
      return res.status(200).json(cached);
    }
    const palette = await Vibrant.from(url).getPalette();
    const dominant_colors = {
      vibrant: palette.Vibrant ? { hex: palette.Vibrant.hex } : null,
      vibrant_dark: palette.DarkVibrant
        ? { hex: palette.DarkVibrant.hex }
        : null,
      vibrant_light: palette.LightVibrant
        ? { hex: palette.LightVibrant.hex }
        : null,
      muted: palette.Muted ? { hex: palette.Muted.hex } : null,
      muted_dark: palette.DarkMuted ? { hex: palette.DarkMuted.hex } : null,
      muted_light: palette.LightMuted ? { hex: palette.LightMuted.hex } : null,
    };
    const data = { dominant_colors };
    await setCachedPalette(filename, "vibrant", data);
    res.setHeader(
      "Cache-Control",
      "public, max-age=86400, stale-while-revalidate=604800",
    );
    return res.status(200).json(data);
  } catch {
    return res.status(500).json({ error: "Failed to extract palette" });
  }
}
