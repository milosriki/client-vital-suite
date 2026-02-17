import {
  createClient,
  SupabaseClient,
} from "https://esm.sh/@supabase/supabase-js@2";

// TYPES
export interface HubSpotContactProperties {
  email?: string;
  firstname?: string;
  lastname?: string;
  phone?: string;
  lifecyclestage?: string;
  whatsapp_stage?: string;
  whatsapp_intent?: string;
  assigned_coach?: string;
  bot_paused?: string | boolean; // HubSpot returns string "true"/"false" usually
  fitness_goal?: string;
  city?: string;
  housing_type?: string;
  lead_score?: string;
  lead_maturity?: string;
  biggest_challenge_?: string;
  whatsapp_summary?: string;
  whatsapp_last_message?: string;
  whatsapp_last_reply?: string;
  [key: string]: string | boolean | undefined; // Allow flexible props
}

export interface HubSpotContact {
  id: string;
  properties: HubSpotContactProperties;
  createdAt: string;
  updatedAt: string;
  archived: boolean;
}

export interface HubSpotNote {
  id: string;
  properties: {
    hs_note_body: string;
    hs_timestamp: string;
  };
}

export interface HubSpotCall {
  id: string;
  properties: {
    hs_call_body: string;
    hs_call_title: string;
    hs_timestamp: string;
  };
}

export class HubSpotManager {
  private apiKey: string;
  private supabase: SupabaseClient;

  constructor(apiKey: string, supabaseUrl: string, supabaseKey: string) {
    this.apiKey = apiKey;
    this.supabase = createClient(supabaseUrl, supabaseKey);
  }

  private async logError(message: string, details: unknown) {
    console.error(`[HubSpotManager] ${message}`, details);
    await this.supabase.from("sync_logs").insert({
      platform: "hubspot",
      status: "error",
      message: message,
      error_details: details,
      started_at: new Date().toISOString(),
    });
  }

  private async fetchWithRetry<T>(
    url: string,
    options: RequestInit = {},
    retries = 3,
    timeout = 10000,
  ): Promise<T | null> {
    for (let i = 0; i <= retries; i++) {
      const controller = new AbortController();
      const id = setTimeout(() => controller.abort(), timeout);

      try {
        const headers: Record<string, string> = {
          ...(options.headers as Record<string, string>),
          Authorization: `Bearer ${this.apiKey}`,
          "Content-Type": "application/json",
        };

        const response = await fetch(url, {
          ...options,
          signal: controller.signal,
          headers,
        });
        clearTimeout(id);

        if (response.status === 429) {
          if (i === retries) {
            throw new Error("Rate limit exceeded and retries exhausted");
          }
          const waitTime = (i + 1) * 2000;
          console.warn(
            `[HubSpotManager] Rate limited. Waiting ${waitTime}ms...`,
          );
          await new Promise((resolve) => setTimeout(resolve, waitTime));
          continue;
        }

        if (!response.ok) {
          let errorBody = "";
          try {
            errorBody = await response.text();
          } catch {
            // ignore
          }
          throw new Error(
            `HubSpot API Error: ${response.status} ${response.statusText} - ${errorBody}`,
          );
        }

        if (response.status === 204) return null;

        return (await response.json()) as T;
      } catch (error: unknown) {
        clearTimeout(id);
        const err = error as Error;
        if (err.name === "AbortError") {
          console.warn(
            `[HubSpotManager] Request timed out after ${timeout}ms: ${url}`,
          );
          throw new Error(`HubSpot Request Timeout (${timeout}ms)`);
        }
        if (i === retries) throw error;
        if (!err.message.includes("Rate limit")) {
          await new Promise((resolve) => setTimeout(resolve, 1000));
        }
      }
    }
    return null; // Should not reach here
  }

  /**
   * Shared deal field mapping — single source of truth for HubSpot → Supabase deals.
   * Used by sync-single-deal, backfill-deals, and hubspot-webhook.
   * VERIFIED column names against src/integrations/supabase/types.ts:
   *   stage (NOT deal_stage), created_at (NOT create_date),
   *   updated_at (NOT last_modified), NO sync_source column.
   */
  static mapDealFields(
    hubspotDeal: { id: string; properties: Record<string, any> },
    contactId: string | null,
    ownerName: string | null,
  ): Record<string, any> {
    const props = hubspotDeal.properties;
    const val = parseFloat(props.amount) || 0;

    return {
      hubspot_deal_id: hubspotDeal.id,
      deal_name: props.dealname || null,
      amount: val || null,
      deal_value: val,
      value_aed: val,
      stage: props.dealstage || null,
      pipeline: props.pipeline || null,
      close_date: props.closedate ? new Date(props.closedate).toISOString() : null,
      status: HubSpotManager.mapDealStageToStatus(props.dealstage),
      created_at: props.createdate ? new Date(props.createdate).toISOString() : new Date().toISOString(),
      updated_at: props.lastmodifieddate ? new Date(props.lastmodifieddate).toISOString() : new Date().toISOString(),
      contact_id: contactId,
      owner_id: props.hubspot_owner_id || null,
      owner_name: ownerName,
    };
  }

  static mapDealStageToStatus(stage: string | null): string {
    if (!stage) return "pending";
    const s = stage.toLowerCase();
    if (s.includes("won") || s.includes("signed") || s.includes("paid")) return "closed";
    if (s.includes("lost") || s.includes("bad")) return "cancelled";
    return "pending";
  }

  async fetchContacts(
    limit = 100,
    after?: string,
  ): Promise<{ results: HubSpotContact[]; paging?: any }> {
    let url = `https://api.hubapi.com/crm/v3/objects/contacts?limit=${limit}&properties=email,firstname,lastname,phone,lifecyclestage`;
    if (after) url += `&after=${after}`;

    try {
      const data = await this.fetchWithRetry<{
        results: HubSpotContact[];
        paging?: any;
      }>(url);
      return data || { results: [] };
    } catch (error) {
      await this.logError("Failed to fetch contacts", error);
      throw error;
    }
  }

  async fetchDeals(limit = 100, after?: string): Promise<any> {
    // Keep any for Deals for now as we focus on Contacts
    let url = `https://api.hubapi.com/crm/v3/objects/deals?limit=${limit}&properties=dealname,amount,dealstage,closedate`;
    if (after) url += `&after=${after}`;

    try {
      return await this.fetchWithRetry(url);
    } catch (error) {
      await this.logError("Failed to fetch deals", error);
      throw error;
    }
  }

  async searchContactByPhone(
    phone: string,
    options: { retries?: number; timeout?: number } = {},
  ): Promise<HubSpotContact | null> {
    const url = `https://api.hubapi.com/crm/v3/objects/contacts/search`;
    const body = {
      filterGroups: [
        {
          filters: [
            {
              propertyName: "phone",
              operator: "EQ",
              value: phone,
            },
          ],
        },
      ],
      properties: [
        "email",
        "firstname",
        "lastname",
        "phone",
        "lifecyclestage",
        "whatsapp_stage",
        "whatsapp_intent",
        "assigned_coach",
        "bot_paused",
        "fitness_goal",
        "city",
        "housing_type",
        "lead_score",
        "lead_maturity",
        "biggest_challenge_", // HubSpot internal name often has underscore
      ],
      limit: 1,
    };

    try {
      const data = await this.fetchWithRetry<{ results: HubSpotContact[] }>(
        url,
        {
          method: "POST",
          body: JSON.stringify(body),
        },
        options.retries ?? 3,
        options.timeout ?? 10000,
      );
      return data?.results?.[0] || null;
    } catch (error) {
      if (!options.timeout || options.timeout > 2000) {
        await this.logError(
          `Failed to search contact by phone: ${phone}`,
          error,
        );
      }
      return null;
    }
  }

  async searchContactByEmail(email: string): Promise<HubSpotContact | null> {
    const url = `https://api.hubapi.com/crm/v3/objects/contacts/search`;
    const body = {
      filterGroups: [
        {
          filters: [{ propertyName: "email", operator: "EQ", value: email }],
        },
      ],
      properties: [
        "email",
        "firstname",
        "lastname",
        "phone",
        "lifecyclestage",
        "assigned_coach",
      ],
      limit: 1,
    };

    try {
      const data = await this.fetchWithRetry<{ results: HubSpotContact[] }>(
        url,
        {
          method: "POST",
          body: JSON.stringify(body),
        },
      );
      return data?.results?.[0] || null;
    } catch (error) {
      await this.logError(`Failed to search contact by email: ${email}`, error);
      return null;
    }
  }

  async createHubSpotTask(
    contactId: string,
    subject: string,
    body: string,
    priority: "LOW" | "MEDIUM" | "HIGH" = "MEDIUM",
  ) {
    const url = `https://api.hubapi.com/crm/v3/objects/tasks`;
    const now = new Date();

    // Payload
    const payload = {
      properties: {
        hs_task_subject: subject,
        hs_task_body: body,
        hs_task_priority: priority,
        hs_task_status: "WAITING",
        hs_timestamp: now.toISOString(),
        hubspot_owner_id: "7973797",
      },
      associations: [
        {
          to: { id: contactId },
          types: [
            { associationCategory: "HUBSPOT_DEFINED", associationTypeId: 204 },
          ],
        },
      ],
    };

    try {
      return await this.fetchWithRetry(url, {
        method: "POST",
        body: JSON.stringify(payload),
      });
    } catch (error) {
      await this.logError(
        `Failed to create task for contact ${contactId}`,
        error,
      );
      return null;
    }
  }

  async createContact(
    properties: Record<string, string>,
  ): Promise<HubSpotContact> {
    const url = `https://api.hubapi.com/crm/v3/objects/contacts`;
    try {
      const res = await this.fetchWithRetry<HubSpotContact>(url, {
        method: "POST",
        body: JSON.stringify({ properties }),
      });
      if (!res) throw new Error("Failed to create contact (empty response)");
      return res;
    } catch (error) {
      await this.logError(
        `Failed to create contact: ${properties.email}`,
        error,
      );
      throw error;
    }
  }

  async updateContact(
    contactId: string,
    properties: Record<string, string>,
  ): Promise<HubSpotContact> {
    const url = `https://api.hubapi.com/crm/v3/objects/contacts/${contactId}`;
    try {
      const res = await this.fetchWithRetry<HubSpotContact>(url, {
        method: "PATCH",
        body: JSON.stringify({ properties }),
      });
      if (!res) throw new Error("Failed to update contact (empty response)");
      return res;
    } catch (error) {
      await this.logError(`Failed to update contact: ${contactId}`, error);
      throw error;
    }
  }

  async createNote(contactId: string, content: string): Promise<void> {
    const url = `https://api.hubapi.com/crm/v3/objects/notes`;
    try {
      await this.fetchWithRetry(url, {
        method: "POST",
        body: JSON.stringify({
          properties: {
            hs_note_body: content,
            hs_timestamp: new Date().toISOString(),
          },
          associations: [
            {
              to: { id: contactId },
              types: [
                {
                  associationCategory: "HUBSPOT_DEFINED",
                  associationTypeId: 202,
                },
              ],
            },
          ],
        }),
      });
      console.log(`✅ [HubSpotManager] Note created for contact ${contactId}`);
    } catch (error) {
      await this.logError(
        `Failed to create note for contact ${contactId}`,
        error,
      );
      throw error;
    }
  }

  async updateBotStatus(
    contactId: string | undefined,
    paused: boolean,
  ): Promise<void> {
    if (!contactId) return;
    const url = `https://api.hubapi.com/crm/v3/objects/contacts/${contactId}`;
    try {
      await this.fetchWithRetry(url, {
        method: "PATCH",
        body: JSON.stringify({
          properties: {
            bot_paused: paused.toString(),
          },
        }),
      });
      console.log(
        `✅ [HubSpotManager] Updated bot_paused=${paused} for ${contactId}`,
      );
    } catch (error) {
      await this.logError(
        `Failed to update bot status for contact ${contactId}`,
        error,
      );
    }
  }

  async fetchContactNotes(contactId: string): Promise<HubSpotNote[]> {
    const url = `https://api.hubapi.com/crm/v3/objects/contacts/${contactId}/associations/notes`;
    try {
      const data = await this.fetchWithRetry<{ results: { id: string }[] }>(
        url,
      );
      if (!data?.results) return [];

      const notes = await Promise.all(
        data.results.map(async (res) => {
          const noteUrl = `https://api.hubapi.com/crm/v3/objects/notes/${res.id}?properties=hs_note_body,hs_timestamp`;
          return (await this.fetchWithRetry<HubSpotNote>(noteUrl))!;
        }),
      );
      // Filter out any nulls if fetches failed slightly
      return notes.filter((n) => n !== null && n !== undefined);
    } catch (error) {
      console.error(`Error fetching notes for ${contactId}:`, error);
      return [];
    }
  }

  async fetchContactCalls(contactId: string): Promise<HubSpotCall[]> {
    const url = `https://api.hubapi.com/crm/v3/objects/contacts/${contactId}/associations/calls`;
    try {
      const data = await this.fetchWithRetry<{ results: { id: string }[] }>(
        url,
      );
      if (!data?.results) return [];

      const calls = await Promise.all(
        data.results.map(async (res) => {
          const callUrl = `https://api.hubapi.com/crm/v3/objects/calls/${res.id}?properties=hs_call_body,hs_call_title,hs_timestamp`;
          return (await this.fetchWithRetry<HubSpotCall>(callUrl))!;
        }),
      );
      return calls.filter((c) => c !== null);
    } catch (error) {
      console.error(`Error fetching calls for ${contactId}:`, error);
      return [];
    }
  }
}
