import { createHmac } from "node:crypto";
import type { NextApiRequest, NextApiResponse } from "next";

export default function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== "POST") {
    return res.status(405).end();
  }

  const { password } = req.body as { password?: string };

  if (!password || password !== process.env.AUTH_PASSWORD) {
    return res.status(401).json({ error: "Invalid password" });
  }

  const secret = process.env.AUTH_SECRET ?? "";
  const token = createHmac("sha256", secret)
    .update("authenticated")
    .digest("hex");

  const secure = process.env.NODE_ENV === "production" ? "; Secure" : "";
  res.setHeader(
    "Set-Cookie",
    `auth_token=${token}; HttpOnly; Path=/; SameSite=Strict; Max-Age=${60 * 60 * 24 * 7}${secure}`,
  );

  return res.status(200).json({ ok: true });
}
