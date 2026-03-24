import type { NextApiRequest, NextApiResponse } from "next";
import { Vibrant } from "node-vibrant/node";

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse,
) {
  const { url } = req.query;
  if (!url || typeof url !== "string") {
    return res.status(400).json({ error: "Missing url param" });
  }

  try {
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
    res.setHeader(
      "Cache-Control",
      "public, max-age=86400, stale-while-revalidate=604800",
    );
    return res.status(200).json({ dominant_colors });
  } catch {
    return res.status(500).json({ error: "Failed to extract palette" });
  }
}
