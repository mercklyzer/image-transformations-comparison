import type { NextApiRequest, NextApiResponse } from "next";
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

  // Strip everything up to and including "/upload/" to get the path
  const uploadIndex = url.indexOf("/upload/");
  if (uploadIndex === -1) {
    return res.status(400).json({ error: "Invalid Cloudinary URL" });
  }
  const path = url.slice(uploadIndex + "/upload/".length);
  const imgixUrl = `https://lyzer-business.imgix.net/${path}?palette=json`;

  try {
    const cached = await getCachedPalette(filename, "imgix");
    if (cached) {
      res.setHeader(
        "Cache-Control",
        "public, max-age=86400, stale-while-revalidate=604800",
      );
      return res.status(200).json(cached);
    }

    const response = await fetch(imgixUrl);
    if (!response.ok) {
      return res
        .status(response.status)
        .json({ error: "imgix request failed" });
    }
    const data = await response.json();
    await setCachedPalette(filename, "imgix", data);
    res.setHeader(
      "Cache-Control",
      "public, max-age=86400, stale-while-revalidate=604800",
    );
    return res.status(200).json(data);
  } catch {
    return res.status(500).json({ error: "Failed to fetch palette" });
  }
}
