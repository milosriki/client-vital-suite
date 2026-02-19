import type { VercelRequest, VercelResponse } from "@vercel/node";

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL || "https://ztjndilxurtsfqdsvfds.supabase.co";
const SUPABASE_ANON_KEY = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || "";
const PTD_KEY = process.env.PTD_INTERNAL_ACCESS_KEY || "";

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method === "OPTIONS") {
    res.setHeader("Access-Control-Allow-Origin", "*");
    res.setHeader("Access-Control-Allow-Methods", "POST, OPTIONS");
    res.setHeader("Access-Control-Allow-Headers", "authorization, content-type");
    return res.status(200).end();
  }

  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  // Auth: require PTD_INTERNAL_ACCESS_KEY
  const authHeader = req.headers.authorization;
  if (!authHeader || authHeader !== `Bearer ${PTD_KEY}`) {
    return res.status(401).json({ error: "Unauthorized" });
  }

  try {
    const response = await fetch(`${SUPABASE_URL}/functions/v1/meta-cross-validate`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${SUPABASE_ANON_KEY}`,
      },
      body: JSON.stringify(req.body || {}),
    });

    const data = await response.json();

    if (!response.ok) {
      return res.status(response.status).json(data);
    }

    res.setHeader("Access-Control-Allow-Origin", "*");
    return res.status(200).json(data);
  } catch (error: any) {
    return res.status(500).json({ error: error.message });
  }
}
