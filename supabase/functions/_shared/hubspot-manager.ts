import { createClient, SupabaseClient } from "https://esm.sh/@supabase/supabase-js@2";

// TypeScript Types
export interface HubSpotContact {
  id: string;
  properties: {
    firstname?: string;
    lastname?: string;
    email?: string;
    phone?: string;
    mobilephone?: string;
    hubspot_owner_id?: string;
    lifecyclestage?: string;
    hs_lead_status?: string;
    createdate?: string;
    lastmodifieddate?: string;
    city?: string;
    [key: string]: any;
  };
}

export interface HubSpotDeal {
  id: string;
  properties: {
    dealname?: string;
    dealstage?: string;
    amount?: string;
    pipeline?: string;
    closedate?: string;
    hubspot_owner_id?: string;
    createdate?: string;
    [key: string]: any;
  };
}

export interface HubSpotSearchResponse<T> {
  results: T[];
  paging?: {
    next?: {
      after?: string;
    };
  };
}

export interface SyncLogEntry {
  platform: string;
  sync_type: string;
  status: "success" | "error" | "warning";
  error_details?: any;
  started_at?: string;
  completed_at?: string;
  duration_ms?: number;
  records_processed?: number;
  records_failed?: number;
}

/**
 * HubSpotManager - Manages HubSpot API interactions with retry logic and error logging
 */
export class HubSpotManager {
  private apiKey: string;
  private supabase: SupabaseClient | null = null;
  private baseUrl = "https://api.hubapi.com/crm/v3/objects";

  constructor(apiKey: string, supabaseUrl?: string, supabaseKey?: string) {
    if (!apiKey) {
      throw new Error("HUBSPOT_API_KEY is required");
    }
    this.apiKey = apiKey;

    // Initialize Supabase client if credentials provided
    if (supabaseUrl && supabaseKey) {
      this.supabase = createClient(supabaseUrl, supabaseKey);
    }
  }

  /**
   * Set Supabase client for logging
   */
  setSupabaseClient(supabase: SupabaseClient): void {
    this.supabase = supabase;
  }

  /**
   * Fetch contacts from HubSpot with pagination support
   */
  async fetchContacts(
    properties: string[] = [
      "firstname",
      "lastname",
      "email",
      "phone",
      "mobilephone",
      "hubspot_owner_id",
      "lifecyclestage",
      "hs_lead_status",
      "createdate",
      "lastmodifieddate",
      "city",
    ],
    limit: number = 100
  ): Promise<HubSpotContact[]> {
    const startTime = Date.now();
    let allContacts: HubSpotContact[] = [];
    let after: string | undefined = undefined;

    try {
      do {
        const body = {
          filterGroups: [],
          properties,
          sorts: [{ propertyName: "createdate", direction: "DESCENDING" }],
          limit,
          ...(after && { after }),
        };

        const response = await this.makeRequest<HubSpotSearchResponse<HubSpotContact>>(
          `${this.baseUrl}/contacts/search`,
          {
            method: "POST",
            body: JSON.stringify(body),
          }
        );

        allContacts = allContacts.concat(response.results);
        after = response.paging?.next?.after;
      } while (after);

      await this.logSync({
        platform: "hubspot",
        sync_type: "fetch_contacts",
        status: "success",
        started_at: new Date(startTime).toISOString(),
        completed_at: new Date().toISOString(),
        duration_ms: Date.now() - startTime,
        records_processed: allContacts.length,
        records_failed: 0,
      });

      return allContacts;
    } catch (error) {
      await this.logSync({
        platform: "hubspot",
        sync_type: "fetch_contacts",
        status: "error",
        error_details: {
          message: error instanceof Error ? error.message : String(error),
          stack: error instanceof Error ? error.stack : undefined,
        },
        started_at: new Date(startTime).toISOString(),
        completed_at: new Date().toISOString(),
        duration_ms: Date.now() - startTime,
        records_processed: allContacts.length,
        records_failed: 1,
      });
      throw error;
    }
  }

  /**
   * Fetch deals from HubSpot with pagination support
   */
  async fetchDeals(
    properties: string[] = [
      "dealname",
      "dealstage",
      "amount",
      "pipeline",
      "closedate",
      "hubspot_owner_id",
      "createdate",
    ],
    limit: number = 100
  ): Promise<HubSpotDeal[]> {
    const startTime = Date.now();
    let allDeals: HubSpotDeal[] = [];
    let after: string | undefined = undefined;

    try {
      do {
        const body = {
          filterGroups: [],
          properties,
          sorts: [{ propertyName: "createdate", direction: "DESCENDING" }],
          limit,
          ...(after && { after }),
        };

        const response = await this.makeRequest<HubSpotSearchResponse<HubSpotDeal>>(
          `${this.baseUrl}/deals/search`,
          {
            method: "POST",
            body: JSON.stringify(body),
          }
        );

        allDeals = allDeals.concat(response.results);
        after = response.paging?.next?.after;
      } while (after);

      await this.logSync({
        platform: "hubspot",
        sync_type: "fetch_deals",
        status: "success",
        started_at: new Date(startTime).toISOString(),
        completed_at: new Date().toISOString(),
        duration_ms: Date.now() - startTime,
        records_processed: allDeals.length,
        records_failed: 0,
      });

      return allDeals;
    } catch (error) {
      await this.logSync({
        platform: "hubspot",
        sync_type: "fetch_deals",
        status: "error",
        error_details: {
          message: error instanceof Error ? error.message : String(error),
          stack: error instanceof Error ? error.stack : undefined,
        },
        started_at: new Date(startTime).toISOString(),
        completed_at: new Date().toISOString(),
        duration_ms: Date.now() - startTime,
        records_processed: allDeals.length,
        records_failed: 1,
      });
      throw error;
    }
  }

  /**
   * Update a contact in HubSpot
   */
  async updateContact(
    contactId: string,
    properties: Record<string, any>
  ): Promise<HubSpotContact> {
    const startTime = Date.now();

    try {
      const response = await this.makeRequest<HubSpotContact>(
        `${this.baseUrl}/contacts/${contactId}`,
        {
          method: "PATCH",
          body: JSON.stringify({ properties }),
        }
      );

      await this.logSync({
        platform: "hubspot",
        sync_type: "update_contact",
        status: "success",
        started_at: new Date(startTime).toISOString(),
        completed_at: new Date().toISOString(),
        duration_ms: Date.now() - startTime,
        records_processed: 1,
        records_failed: 0,
      });

      return response;
    } catch (error) {
      await this.logSync({
        platform: "hubspot",
        sync_type: "update_contact",
        status: "error",
        error_details: {
          contactId,
          properties,
          message: error instanceof Error ? error.message : String(error),
          stack: error instanceof Error ? error.stack : undefined,
        },
        started_at: new Date(startTime).toISOString(),
        completed_at: new Date().toISOString(),
        duration_ms: Date.now() - startTime,
        records_processed: 0,
        records_failed: 1,
      });
      throw error;
    }
  }

  /**
   * Update a deal in HubSpot
   */
  async updateDeal(
    dealId: string,
    properties: Record<string, any>
  ): Promise<HubSpotDeal> {
    const startTime = Date.now();

    try {
      const response = await this.makeRequest<HubSpotDeal>(
        `${this.baseUrl}/deals/${dealId}`,
        {
          method: "PATCH",
          body: JSON.stringify({ properties }),
        }
      );

      await this.logSync({
        platform: "hubspot",
        sync_type: "update_deal",
        status: "success",
        started_at: new Date(startTime).toISOString(),
        completed_at: new Date().toISOString(),
        duration_ms: Date.now() - startTime,
        records_processed: 1,
        records_failed: 0,
      });

      return response;
    } catch (error) {
      await this.logSync({
        platform: "hubspot",
        sync_type: "update_deal",
        status: "error",
        error_details: {
          dealId,
          properties,
          message: error instanceof Error ? error.message : String(error),
          stack: error instanceof Error ? error.stack : undefined,
        },
        started_at: new Date(startTime).toISOString(),
        completed_at: new Date().toISOString(),
        duration_ms: Date.now() - startTime,
        records_processed: 0,
        records_failed: 1,
      });
      throw error;
    }
  }

  /**
   * Log sync operation to sync_logs table
   */
  async logSync(entry: SyncLogEntry): Promise<void> {
    if (!this.supabase) {
      console.warn("Supabase client not configured, skipping log entry");
      return;
    }

    try {
      const { error } = await this.supabase.from("sync_logs").insert(entry);

      if (error) {
        console.error("Failed to log sync entry:", error);
      }
    } catch (err) {
      console.error("Error logging to sync_logs:", err);
      // Don't throw - logging failures shouldn't break the main operation
    }
  }

  /**
   * Make an HTTP request to HubSpot API with exponential backoff retry logic
   * Retries on 429 (rate limit) errors with delays: 1s, 2s, 4s
   */
  private async makeRequest<T>(
    url: string,
    options: RequestInit = {}
  ): Promise<T> {
    const headers = {
      Authorization: `Bearer ${this.apiKey}`,
      "Content-Type": "application/json",
      ...options.headers,
    };

    const maxRetries = 3;
    const delays = [1000, 2000, 4000]; // Exponential backoff: 1s, 2s, 4s

    for (let attempt = 0; attempt <= maxRetries; attempt++) {
      try {
        const response = await fetch(url, {
          ...options,
          headers,
        });

        // Handle rate limiting (429)
        if (response.status === 429 && attempt < maxRetries) {
          const delay = delays[attempt];
          console.warn(
            `Rate limited (429). Retrying in ${delay}ms... (attempt ${attempt + 1}/${maxRetries})`
          );
          await this.sleep(delay);
          continue;
        }

        // Handle other errors
        if (!response.ok) {
          const errorText = await response.text();
          throw new Error(
            `HubSpot API error (${response.status}): ${errorText}`
          );
        }

        return await response.json();
      } catch (error) {
        // If this is the last attempt or not a rate limit error, throw
        if (attempt === maxRetries) {
          throw error;
        }

        // For network errors, also retry with exponential backoff
        if (error instanceof TypeError) {
          const delay = delays[attempt];
          console.warn(
            `Network error. Retrying in ${delay}ms... (attempt ${attempt + 1}/${maxRetries})`
          );
          await this.sleep(delay);
          continue;
        }

        throw error;
      }
    }

    throw new Error("Max retries exceeded");
  }

  /**
   * Sleep helper for retry delays
   */
  private sleep(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }
}
