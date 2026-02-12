import { supabase } from "@/integrations/supabase/client";

export type DealStage =
  | "new"
  | "qualified"
  | "proposal"
  | "negotiation"
  | "closedwon"
  | "closedlost";

export interface Deal {
  id: string;
  deal_name: string;
  stage: DealStage;
  amount: number;
  close_date: string | null;
  org_id?: string;
  pipeline_id?: string;
  contact_id?: string;
  created_at?: string;
  updated_at?: string;
  status?: "pending" | "closed" | "cancelled" | "lost" | "open";
}

export interface UpdateDealStagePayload {
  dealId: string;
  stage: DealStage;
}

export const dealsApi = {
  getDeals: async (): Promise<Deal[]> => {
    const { data, error } = await supabase
      .from("deals")
      .select("*")
      .order("created_at", { ascending: false });

    if (error) throw error;
    // Validate/Transform data if necessary here
    return (data || []) as Deal[];
  },

  updateDealStage: async ({
    dealId,
    stage,
  }: UpdateDealStagePayload): Promise<Deal> => {
    const status =
      stage === "closedwon"
        ? "closed"
        : stage === "closedlost"
          ? "closed"
          : "open";
    const close_date =
      stage === "closedwon" || stage === "closedlost"
        ? new Date().toISOString()
        : null;

    const { data, error } = await supabase
      .from("deals")
      .update({
        stage,
        status,
        close_date,
      })
      .eq("id", dealId)
      .select()
      .single();

    if (error) throw error;
    return data as Deal;
  },
};
