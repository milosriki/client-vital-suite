import { SupabaseClient } from "https://esm.sh/@supabase/supabase-js@2";

interface SyncJob {
  operation: 'create' | 'update' | 'batch' | 'delete' | 'fetch';
  objectType: 'contact' | 'deal' | 'company' | 'engagement';
  data: Record<string, any>;
  retryCount: number;
  jobId: string;
}

export class HubSpotSyncManager {
  private queue: SyncJob[] = [];
  private processing = false;
  private rateLimitRemaining = 100;
  private rateLimitResetTime: number | null = null;
  
  constructor(
    private supabase: SupabaseClient,
    private hubspotApiKey: string
  ) {}

  async enqueue(job: Omit<SyncJob, 'retryCount' | 'jobId'>): Promise<string> {
    const jobId = crypto.randomUUID();
    this.queue.push({ ...job, retryCount: 0, jobId });
    
    if (!this.processing) {
      this.processQueue();
    }
    
    return jobId;
  }

  private async processQueue() {
    if (this.processing || this.queue.length === 0) return;
    
    this.processing = true;
    
    while (this.queue.length > 0) {
      // Check rate limits
      if (this.rateLimitRemaining < 5) {
        const waitTime = this.rateLimitResetTime 
          ? Math.max(0, this.rateLimitResetTime - Date.now())
          : 10000;
        
        console.log(`[HubSpotSyncManager] Rate limit near - waiting ${waitTime}ms`);
        await new Promise(resolve => setTimeout(resolve, waitTime));
      }
      
      const job = this.queue.shift()!;
      
      try {
        await this.executeJob(job);
        console.log(`[HubSpotSyncManager] Job ${job.jobId} completed successfully`);
      } catch (error: any) {
        await this.handleJobError(job, error);
      }
      
      // Respect HubSpot's 100 req/10s limit
      await new Promise(resolve => setTimeout(resolve, 100));
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

    // Update rate limit tracking
    this.rateLimitRemaining = parseInt(
      response.headers.get('X-HubSpot-RateLimit-Remaining') || '100'
    );
    
    const resetSeconds = parseInt(
      response.headers.get('X-HubSpot-RateLimit-Interval-Milliseconds') || '10000'
    );
    this.rateLimitResetTime = Date.now() + resetSeconds;

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
    };
    
    const objectPath = typeMap[job.objectType];
    
    if (job.operation === 'batch') {
      return `${baseUrl}/crm/v3/objects/${objectPath}/batch/${job.data.batchType || 'create'}`;
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
