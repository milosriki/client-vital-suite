import { SupabaseClient } from "https://esm.sh/@supabase/supabase-js@2";

interface SyncJob {
    operation: 'create' | 'update' | 'batch' | 'delete';
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
    ) { }

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

                console.log(`Rate limit near - waiting ${waitTime}ms`);
                await new Promise(resolve => setTimeout(resolve, waitTime));
            }

            const job = this.queue.shift()!;

            try {
                await this.executeJob(job);
            } catch (error: any) {
                await this.handleJobError(job, error);
            }

            // Respect HubSpot's 100 req/10s limit
            await new Promise(resolve => setTimeout(resolve, 100));
        }

        this.processing = false;
    }

    private async executeJob(job: SyncJob): Promise<void> {
        const endpoint = this.getEndpoint(job);
        const method = job.operation === 'create' ? 'POST' : 'PATCH';

        const response = await fetch(endpoint, {
            method,
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${this.hubspotApiKey}`,
            },
            body: JSON.stringify(job.data),
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
            const errorData = await response.json();
            throw new Error(JSON.stringify(errorData));
        }

        return await response.json();
    }

    private async handleJobError(job: SyncJob, error: any) {
        const errorType = this.classifyError(error);

        // Log to sync_errors table
        await this.supabase.from('sync_errors').insert({
            error_type: errorType,
            source: 'hubspot',
            object_type: job.objectType,
            object_id: job.data.id || null,
            operation: job.operation,
            error_message: error.message,
            error_details: { originalError: error },
            request_payload: job.data,
            retry_count: job.retryCount,
        });

        // Retry logic with exponential backoff
        if (job.retryCount < 3 && errorType === 'rate_limit') {
            const backoffMs = Math.pow(2, job.retryCount) * 1000;

            setTimeout(() => {
                this.queue.push({
                    ...job,
                    retryCount: job.retryCount + 1,
                });
            }, backoffMs);
        }
    }

    private classifyError(error: any): string {
        const message = error.message?.toLowerCase() || '';

        if (message.includes('rate limit') || message.includes('429')) {
            return 'rate_limit';
        } else if (message.includes('auth') || message.includes('401')) {
            return 'auth';
        } else if (message.includes('timeout')) {
            return 'timeout';
        } else if (message.includes('field') || message.includes('property')) {
            return 'field_mapping';
        } else if (message.includes('network')) {
            return 'network';
        }

        return 'validation';
    }

    private getEndpoint(job: SyncJob): string {
        const baseUrl = 'https://api.hubapi.com';
        const typeMap = {
            contact: 'contacts',
            deal: 'deals',
            company: 'companies',
            engagement: 'engagements',
        };

        const objectPath = typeMap[job.objectType];

        if (job.operation === 'batch') {
            return `${baseUrl}/crm/v3/objects/${objectPath}/batch/${job.operation}`;
        }

        return `${baseUrl}/crm/v3/objects/${objectPath}`;
    }
}
