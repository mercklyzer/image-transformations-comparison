import type { NextApiRequest, NextApiResponse } from "next";
import { getAll } from "@/lib/db";

export default function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== "GET") return res.status(405).end();
  return res.status(200).json(getAll());
}
