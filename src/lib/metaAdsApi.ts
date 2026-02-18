import { supabase } from "@/integrations/supabase/client";

const FUNCTION_URL = `${import.meta.env.VITE_SUPABASE_URL || "https://ztjndilxurtsfqdsvfds.supabase.co"}/functions/v1/meta-ads-proxy`;

interface MetaAdsResponse {
  success: boolean;
  data?: {
    response: string;
    model: string;
    toolsAvailable: number;
  };
  error?: {
    code: string;
    message: string;
  };
}

async function callProxy(body: Record<string, unknown>): Promise<MetaAdsResponse> {
  const { data: { session } } = await supabase.auth.getSession();
  const token = session?.access_token;

  const res = await fetch(FUNCTION_URL, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "Authorization": `Bearer ${token || import.meta.env.VITE_SUPABASE_ANON_KEY || ""}`,
      "apikey": import.meta.env.VITE_SUPABASE_ANON_KEY || import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY || "",
    },
    body: JSON.stringify(body),
  });

  return res.json();
}

export interface ChatMessage {
  id: string;
  role: "user" | "model" | "system";
  content: string;
  isError?: boolean;
}

export async function fetchCampaigns(dateRange = "last_30d"): Promise<string> {
  const result = await callProxy({
    prompt: `Get all campaigns with their performance metrics for ${dateRange}. Include campaign name, status, spend, impressions, clicks, conversions, ROAS, CPA, CTR.`,
    taskType: "data_fetch",
  });
  if (!result.success) throw new Error(result.error?.message || "Failed to fetch campaigns");
  return result.data!.response;
}

export async function analyzeBudget(): Promise<string> {
  const result = await callProxy({
    prompt: "Analyze current budget distribution across all active campaigns. Identify waste, suggest reallocations, and project ROAS improvements.",
    taskType: "budget_optimization",
  });
  if (!result.success) throw new Error(result.error?.message || "Failed to analyze budget");
  return result.data!.response;
}

export async function chat(
  message: string,
  history: Array<{ role: string; content: string }> = [],
): Promise<string> {
  const result = await callProxy({
    prompt: message,
    messages: history,
    taskType: "chat",
  });
  if (!result.success) throw new Error(result.error?.message || "Chat request failed");
  return result.data!.response;
}
