import { SupabaseClient } from "https://esm.sh/@supabase/supabase-js@2";

// ============================================================================
// SINGLE SOURCE OF TRUTH: HUBSPOT PROPERTY MAPPINGS
// ============================================================================
// All HubSpot functions MUST use these property lists. Never define properties elsewhere.

export const HUBSPOT_PROPERTIES = {
  // Core contact properties - used by ALL sync operations
  CONTACTS: [
    // Identity & Basic Info
    'firstname', 'lastname', 'email', 'phone', 'mobilephone', 'jobtitle',
    'hs_object_id', 'hubspot_owner_id', 'lifecyclestage', 'hs_lead_status',
    'createdate', 'lastmodifieddate', 'city', 'state', 'country',

    // Attribution & Traffic Sources (Critical for Facebook/Google)
    'hs_analytics_source', 'hs_analytics_source_data_1',
    'hs_analytics_first_touch_converting_campaign',
    'hs_analytics_last_touch_converting_campaign',
    'utm_source', 'utm_medium', 'utm_campaign', 'utm_content', 'utm_term',
    'hs_analytics_first_url', 'hs_analytics_last_url',

    // Lead Management
    'num_contacted_notes', 'custom_lifecycle_stage', 'first_conversion_date',
    'num_form_submissions', 'num_unique_forms_submitted',
    'recent_conversion_event_name', 'recent_conversion_date',
    'hubspot_team_id', 'hs_sa_first_engagement_descr',
    'hs_date_entered_lead', 'contact_unworked', 'hs_is_unworked',
    'hs_last_sales_activity_date', 'hs_email_domain',

    // Company Information
    'company', 'company_name', 'company_size', 'industry', 'website', 'domain',

    // Deal & Revenue
    'num_associated_deals', 'total_revenue',

    // Analytics & Engagement
    'hs_analytics_num_visits', 'hs_analytics_num_page_views',
    'hs_analytics_num_event_completions', 'hs_analytics_score',
    'hs_analytics_first_visit', 'hs_analytics_last_visit',

    // Engagement Metrics
    'hs_social_facebook_clicks', 'hs_social_twitter_clicks', 'hs_social_linkedin_clicks',
    'num_notes', 'num_meetings', 'num_emails', 'num_emails_sent',
    'num_emails_opened', 'num_emails_clicked',
    'notes_last_contacted', 'notes_last_contacted_date',
    'hs_last_meeting_booked_date', 'hs_next_activity_date',

    // Communication Preferences
    'hs_email_opt_out', 'hs_marketing_opt_out', 'preferred_contact_method',
    'timezone', 'language',

    // Social Media
    'twitterhandle', 'linkedinbio', 'linkedinconnections', 'twitterfollowers',

    // PTD-specific Custom Properties
    'assigned_coach', 'assessment_scheduled', 'assessment_date',
    'package_type', 'sessions_purchased', 'outstanding_sessions',
    'coach_notes', 'preferred_location', 'fitness_goals', 'call_status',
    // Session Activity (REAL-TIME)
    'of_sessions_conducted__last_7_days_',
    'of_conducted_sessions__last_30_days_',
    'of_sessions_conducted__last_90_days_',
    'next_session_is_booked',
    'of_future_booked_sessions',
    'last_package_cost'
  ],

  // Deal properties
  DEALS: [
    'dealname', 'dealstage', 'amount', 'pipeline', 'closedate',
    'hubspot_owner_id', 'createdate', 'lastmodifieddate', 'hs_object_id'
  ],

  // Call/Engagement properties (includes CallGear integration)
  CALLS: [
    // Standard HubSpot call properties
    'hs_call_title', 'hs_call_status', 'hs_call_duration', 'hs_timestamp',
    'hs_call_to_number', 'hs_call_from_number', 'hubspot_owner_id',
    'hs_call_disposition', 'hs_call_direction', 'hs_call_body',
    'hs_call_recording_url', 'hs_activity_type',
    // CallGear custom properties
    'full_talk_record_link', 'total_talk_duration', 'total_waiting_duration',
    'call_finish_date_and_time', 'call_finish_reason', 'called_phone_number',
    'postprocessing_time'
  ],

  // Owner properties
  OWNERS: ['id', 'email', 'firstName', 'lastName', 'userId']
};

interface SyncJob {
  operation: 'create' | 'update' | 'batch' | 'delete' | 'fetch' | 'search';
  objectType: 'contact' | 'deal' | 'company' | 'engagement' | 'call' | 'owner';
  data: Record<string, any>;
  retryCount: number;
  jobId: string;
  priority?: number; // Higher = more urgent
}

interface FetchOptions {
  properties?: string[];
  limit?: number;
  after?: string;
  filterGroups?: any[];
  sorts?: any[];
}

// ============================================================================
// GLOBAL SYNC LOCK - Prevents race conditions between webhook and batch sync
// ============================================================================
const SYNC_LOCKS = new Map<string, { locked: boolean; lockedAt: number; lockedBy: string }>();

export class HubSpotSyncManager {
  private queue: SyncJob[] = [];
  private processing = false;
  private rateLimitRemaining = 100;
  private rateLimitResetTime: number | null = null;
  private ownerCache: Record<string, string> | null = null;
  private ownerCacheExpiry: number = 0;

  // Global rate limit tracking (shared across all instances)
  private static globalRateLimit = {
    remaining: 100,
    resetTime: 0,
    requestCount: 0,
    windowStart: Date.now()
  };

  constructor(
    private supabase: SupabaseClient,
    private hubspotApiKey: string
  ) { }

  // ============================================================================
  // SYNC COORDINATION - Prevents duplicate syncs
  // ============================================================================

  /**
   * Acquire a lock for a specific sync operation
   * Returns true if lock acquired, false if already locked
   */
  async acquireSyncLock(lockKey: string, timeout: number = 300000): Promise<boolean> {
    const existing = SYNC_LOCKS.get(lockKey);

    // Check if lock exists and is still valid
    if (existing && existing.locked) {
      const age = Date.now() - existing.lockedAt;
      if (age < timeout) {
        console.log(`[SyncManager] Lock "${lockKey}" held by ${existing.lockedBy} (${age}ms old)`);
        return false;
      }
      // Lock expired, clean it up
      console.log(`[SyncManager] Lock "${lockKey}" expired, releasing`);
    }

    // Acquire lock
    SYNC_LOCKS.set(lockKey, {
      locked: true,
      lockedAt: Date.now(),
      lockedBy: crypto.randomUUID()
    });

    console.log(`[SyncManager] Lock "${lockKey}" acquired`);
    return true;
  }

  /**
   * Release a sync lock
   */
  releaseSyncLock(lockKey: string): void {
    SYNC_LOCKS.delete(lockKey);
    console.log(`[SyncManager] Lock "${lockKey}" released`);
  }

  /**
   * Check if a sync is currently locked
   */
  isSyncLocked(lockKey: string): boolean {
    const lock = SYNC_LOCKS.get(lockKey);
    return lock?.locked || false;
  }

  // ============================================================================
  // UNIFIED HUBSPOT API INTERFACE
  // ============================================================================

  /**
   * Fetch HubSpot data with automatic rate limiting and retries
   * All HubSpot API calls should go through this method
   */
  async fetchHubSpot<T = any>(
    objectType: 'contacts' | 'deals' | 'calls' | 'companies' | 'owners',
    options: FetchOptions = {}
  ): Promise<{ results: T[]; nextCursor: string | null; total?: number }> {

    await this.waitForRateLimit();

    const properties = options.properties || this.getDefaultProperties(objectType);
    const endpoint = `https://api.hubapi.com/crm/v3/objects/${objectType}/search`;

    const requestBody = {
      filterGroups: options.filterGroups || [],
      properties,
      sorts: options.sorts || [{ propertyName: 'lastmodifieddate', direction: 'DESCENDING' }],
      limit: options.limit || 100,
      after: options.after || undefined
    };

    console.log(`[SyncManager] Fetching ${objectType} (limit: ${options.limit || 100})`);

    const response = await fetch(endpoint, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${this.hubspotApiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(requestBody)
    });

    this.updateRateLimits(response);

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`HubSpot API error for ${objectType}: ${response.status} - ${errorText}`);
    }

    const data = await response.json();
    return {
      results: data.results || [],
      nextCursor: data.paging?.next?.after || null,
      total: data.total
    };
  }

  /**
   * Batch fetch HubSpot objects by IDs
   */
  async batchFetchHubSpot<T = any>(
    objectType: 'contacts' | 'deals' | 'calls' | 'companies',
    ids: string[],
    properties?: string[]
  ): Promise<T[]> {

    if (ids.length === 0) return [];

    await this.waitForRateLimit();

    const props = properties || this.getDefaultProperties(objectType);
    const endpoint = `https://api.hubapi.com/crm/v3/objects/${objectType}/batch/read`;

    const response = await fetch(endpoint, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${this.hubspotApiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        properties: props,
        inputs: ids.slice(0, 100).map(id => ({ id })) // HubSpot batch limit is 100
      })
    });

    this.updateRateLimits(response);

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`HubSpot batch API error: ${response.status} - ${errorText}`);
    }

    const data = await response.json();
    return data.results || [];
  }

  /**
   * Fetch and cache HubSpot owners (cached for 1 hour)
   */
  async fetchOwners(): Promise<Record<string, string>> {

    // Return cached if still valid
    if (this.ownerCache && Date.now() < this.ownerCacheExpiry) {
      return this.ownerCache;
    }

    await this.waitForRateLimit();

    console.log('[SyncManager] Fetching HubSpot owners');

    const response = await fetch('https://api.hubapi.com/crm/v3/owners', {
      headers: { 'Authorization': `Bearer ${this.hubspotApiKey}` }
    });

    this.updateRateLimits(response);

    if (!response.ok) {
      console.warn('Failed to fetch owners, using empty map');
      return {};
    }

    const data = await response.json();
    this.ownerCache = Object.fromEntries(
      data.results.map((o: any) => [o.id, `${o.firstName} ${o.lastName}`])
    );
    this.ownerCacheExpiry = Date.now() + 3600000; // 1 hour cache

    console.log(`[SyncManager] Cached ${Object.keys(this.ownerCache).length} owners`);

    return this.ownerCache;
  }

  // ============================================================================
  // GLOBAL RATE LIMITING - Coordinates all HubSpot API calls
  // ============================================================================

  private async waitForRateLimit(): Promise<void> {
    const now = Date.now();
    const global = HubSpotSyncManager.globalRateLimit;

    // Reset window if 10 seconds have passed
    if (now - global.windowStart > 10000) {
      global.requestCount = 0;
      global.windowStart = now;
      global.remaining = 100;
    }

    // Check if we're approaching the limit (100 req/10s)
    if (global.requestCount >= 95) {
      const waitTime = Math.max(0, 10000 - (now - global.windowStart));
      if (waitTime > 0) {
        console.log(`[SyncManager] Rate limit: waiting ${waitTime}ms (${global.requestCount}/100 requests)`);
        await new Promise(resolve => setTimeout(resolve, waitTime));
        // Reset after waiting
        global.requestCount = 0;
        global.windowStart = Date.now();
        global.remaining = 100;
      }
    }

    // Track this request
    global.requestCount++;

    // Also add a small delay between requests to be safe (100ms = max 10 req/s)
    await new Promise(resolve => setTimeout(resolve, 100));
  }

  private updateRateLimits(response: Response): void {
    const remaining = parseInt(response.headers.get('X-HubSpot-RateLimit-Remaining') || '100');
    const intervalMs = parseInt(response.headers.get('X-HubSpot-RateLimit-Interval-Milliseconds') || '10000');

    this.rateLimitRemaining = remaining;
    this.rateLimitResetTime = Date.now() + intervalMs;

    // Update global tracking
    HubSpotSyncManager.globalRateLimit.remaining = Math.min(
      HubSpotSyncManager.globalRateLimit.remaining,
      remaining
    );

    if (remaining < 10) {
      console.warn(`[SyncManager] Rate limit low: ${remaining} requests remaining`);
    }
  }

  // ============================================================================
  // PROPERTY HELPERS
  // ============================================================================

  private getDefaultProperties(objectType: string): string[] {
    switch (objectType) {
      case 'contacts': return HUBSPOT_PROPERTIES.CONTACTS;
      case 'deals': return HUBSPOT_PROPERTIES.DEALS;
      case 'calls': return HUBSPOT_PROPERTIES.CALLS;
      case 'owners': return HUBSPOT_PROPERTIES.OWNERS;
      default: return [];
    }
  }

  /**
   * Get the unified property list for contacts
   * Use this instead of hardcoding properties
   */
  static getContactProperties(): string[] {
    return [...HUBSPOT_PROPERTIES.CONTACTS];
  }

  static getDealProperties(): string[] {
    return [...HUBSPOT_PROPERTIES.DEALS];
  }

  static getCallProperties(): string[] {
    return [...HUBSPOT_PROPERTIES.CALLS];
  }

  // ============================================================================
  // LEGACY QUEUE SYSTEM (kept for backward compatibility)
  // ============================================================================

  async enqueue(job: Omit<SyncJob, 'retryCount' | 'jobId'>): Promise<string> {
    const jobId = crypto.randomUUID();
    this.queue.push({ ...job, retryCount: 0, jobId, priority: 0 });

    // Sort queue by priority (higher first)
    this.queue.sort((a, b) => (b.priority || 0) - (a.priority || 0));

    if (!this.processing) {
      this.processQueue();
    }

    return jobId;
  }

  private async processQueue() {
    if (this.processing || this.queue.length === 0) return;

    this.processing = true;

    while (this.queue.length > 0) {
      await this.waitForRateLimit();

      const job = this.queue.shift()!;

      try {
        await this.executeJob(job);
        console.log(`[HubSpotSyncManager] Job ${job.jobId} completed successfully`);
      } catch (error: any) {
        await this.handleJobError(job, error);
      }
    }

    this.processing = false;
  }

  private async executeJob(job: SyncJob): Promise<any> {
    const endpoint = this.getEndpoint(job);
    const method = this.getMethod(job.operation);

    const response = await fetch(endpoint, {
      method,
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${this.hubspotApiKey}`,
      },
      body: method !== 'GET' ? JSON.stringify(job.data) : undefined,
    });

    this.updateRateLimits(response);

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({ message: response.statusText }));
      throw new Error(JSON.stringify({ status: response.status, ...errorData }));
    }

    return await response.json();
  }

  private async handleJobError(job: SyncJob, error: any) {
    const errorType = this.classifyError(error);

    console.error(`[HubSpotSyncManager] Job ${job.jobId} failed:`, error.message);

    // Log to sync_errors table
    await this.supabase.from('sync_errors').insert({
      error_type: errorType,
      source: 'hubspot',
      object_type: job.objectType,
      object_id: job.data.id || null,
      operation: job.operation,
      error_message: error.message,
      error_details: { originalError: String(error) },
      request_payload: job.data,
      retry_count: job.retryCount,
      max_retries: 3,
      next_retry_at: job.retryCount < 3 ? new Date(Date.now() + Math.pow(2, job.retryCount) * 1000).toISOString() : null,
    });

    // Retry logic with exponential backoff
    if (job.retryCount < 3 && (errorType === 'rate_limit' || errorType === 'timeout' || errorType === 'network')) {
      const backoffMs = Math.pow(2, job.retryCount) * 1000;

      console.log(`[HubSpotSyncManager] Scheduling retry ${job.retryCount + 1}/3 in ${backoffMs}ms`);

      setTimeout(() => {
        this.queue.push({
          ...job,
          retryCount: job.retryCount + 1,
        });

        if (!this.processing) {
          this.processQueue();
        }
      }, backoffMs);
    }
  }

  private classifyError(error: any): 'rate_limit' | 'field_mapping' | 'auth' | 'timeout' | 'validation' | 'network' {
    const message = error.message?.toLowerCase() || '';

    if (message.includes('rate limit') || message.includes('429')) {
      return 'rate_limit';
    } else if (message.includes('auth') || message.includes('401') || message.includes('403')) {
      return 'auth';
    } else if (message.includes('timeout') || message.includes('timed out')) {
      return 'timeout';
    } else if (message.includes('field') || message.includes('property') || message.includes('invalid')) {
      return 'field_mapping';
    } else if (message.includes('network') || message.includes('econnrefused') || message.includes('fetch')) {
      return 'network';
    }

    return 'validation';
  }

  private getMethod(operation: SyncJob['operation']): string {
    switch (operation) {
      case 'create': return 'POST';
      case 'update': return 'PATCH';
      case 'delete': return 'DELETE';
      case 'fetch': return 'GET';
      case 'search': return 'POST';
      case 'batch': return 'POST';
      default: return 'POST';
    }
  }

  private getEndpoint(job: SyncJob): string {
    const baseUrl = 'https://api.hubapi.com';
    const typeMap: Record<string, string> = {
      contact: 'contacts',
      deal: 'deals',
      company: 'companies',
      engagement: 'engagements',
      call: 'calls',
      owner: 'owners'
    };

    const objectPath = typeMap[job.objectType];

    if (job.operation === 'batch') {
      return `${baseUrl}/crm/v3/objects/${objectPath}/batch/${job.data.batchType || 'create'}`;
    }

    if (job.operation === 'search') {
      return `${baseUrl}/crm/v3/objects/${objectPath}/search`;
    }

    if (job.operation === 'update' || job.operation === 'delete') {
      return `${baseUrl}/crm/v3/objects/${objectPath}/${job.data.id}`;
    }

    return `${baseUrl}/crm/v3/objects/${objectPath}`;
  }

  // Utility method to get queue status
  getQueueStatus(): { pending: number; processing: boolean; rateLimitRemaining: number } {
    return {
      pending: this.queue.length,
      processing: this.processing,
      rateLimitRemaining: this.rateLimitRemaining,
    };
  }
}
