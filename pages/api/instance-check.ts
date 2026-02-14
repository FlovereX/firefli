import type { NextApiRequest, NextApiResponse } from "next";

export default function handler(_req: NextApiRequest, res: NextApiResponse) {
  const missing: string[] = [];

  if (!process.env.ENCRYPTION_KEY) missing.push("ENCRYPTION_KEY");

  if (missing.length > 0) {
    return res.status(503).json({ configured: false, missing });
  }

  return res.status(200).json({ configured: true });
}
