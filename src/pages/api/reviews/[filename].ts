import type { NextApiRequest, NextApiResponse } from "next";
import { clearStatus, setStatus } from "@/lib/db";

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  const filename = req.query.filename as string;

  if (req.method === "DELETE") {
    await clearStatus(filename);
    return res.status(200).json({ ok: true });
  }

  if (req.method === "POST") {
    const { status } = req.body as { status?: string };
    if (status !== "accepted" && status !== "rejected" && status !== "ignore") {
      return res.status(400).json({ error: "status must be accepted, rejected, or ignore" });
    }
    await setStatus(filename, status);
    return res.status(200).json({ ok: true });
  }

  return res.status(405).end();
}
