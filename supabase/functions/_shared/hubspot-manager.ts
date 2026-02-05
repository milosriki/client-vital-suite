import {
  createClient,
  SupabaseClient,
} from "https://esm.sh/@supabase/supabase-js@2";

export class HubSpotManager {
  private apiKey: string;
  private supabase: SupabaseClient;

  constructor(apiKey: string, supabaseUrl: string, supabaseKey: string) {
    this.apiKey = apiKey;
    this.supabase = createClient(supabaseUrl, supabaseKey);
  }

  private async logError(message: string, details: any) {
    console.error(`[HubSpotManager] ${message}`, details);
    await this.supabase.from("sync_logs").insert({
      platform: "hubspot",
      status: "error",
      message: message,
      error_details: details,
      started_at: new Date().toISOString(),
    });
  }

  private async fetchWithRetry(
    url: string,
    options: any = {},
    retries = 3,
  ): Promise<any> {
    for (let i = 0; i < retries; i++) {
      try {
        const response = await fetch(url, {
          ...options,
          headers: {
            ...options.headers,
            Authorization: `Bearer ${this.apiKey}`,
            "Content-Type": "application/json",
          },
        });

        if (response.status === 429) {
          const waitTime = (i + 1) * 2000; // Exponential backoff: 2s, 4s, 6s
          console.warn(
            `[HubSpotManager] Rate limited. Waiting ${waitTime}ms...`,
          );
          await new Promise((resolve) => setTimeout(resolve, waitTime));
          continue;
        }

        if (!response.ok) {
          throw new Error(
            `HubSpot API Error: ${response.status} ${response.statusText}`,
          );
        }

        return await response.json();
      } catch (error) {
        if (i === retries - 1) throw error;
      }
    }
  }

  async fetchContacts(limit = 100, after?: string) {
    let url = `https://api.hubapi.com/crm/v3/objects/contacts?limit=${limit}&properties=email,firstname,lastname,phone,lifecyclestage`;
    if (after) url += `&after=${after}`;

    try {
      return await this.fetchWithRetry(url);
    } catch (error) {
      await this.logError("Failed to fetch contacts", error);
      throw error;
    }
  }

  async fetchDeals(limit = 100, after?: string) {
    let url = `https://api.hubapi.com/crm/v3/objects/deals?limit=${limit}&properties=dealname,amount,dealstage,closedate`;
    if (after) url += `&after=${after}`;

    try {
      return await this.fetchWithRetry(url);
    } catch (error) {
      await this.logError("Failed to fetch deals", error);
      throw error;
    }
  }

  async searchContactByPhone(phone: string) {
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
      ],
      limit: 1,
    };

    try {
      const data = await this.fetchWithRetry(url, {
        method: "POST",
        body: JSON.stringify(body),
      });
      return data.results?.[0] || null;
    } catch (error) {
      await this.logError(`Failed to search contact by phone: ${phone}`, error);
      return null;
    }
  }

  async createNote(contactId: string, content: string) {
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

  async updateBotStatus(contactId: string, paused: boolean) {
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
      // Don't throw, just log. This is non-critical sync.
    }
  }
}
