/**
 * Circuit Breaker & Source of Truth Utilities
 * 
 * Prevents infinite loops in HubSpot ↔ Supabase sync operations by:
 * 1. Tracking the source of each update (HubSpot vs Internal)
 * 2. Implementing a circuit breaker that halts processing after N attempts
 * 
 * INFINITE LOOP FIX for Workflow ID 1655409725:
 * - If update came from HubSpot, do NOT sync back to HubSpot
 * - If lead processed > 3 times in 1 minute, halt and alert
 */

import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

// Circuit breaker configuration
const MAX_PROCESSING_COUNT = 3;
const WINDOW_MS = 60 * 1000; // 1 minute window

// In-memory tracking (for single function instance)
// For distributed systems, use Redis or database
const processingTracker: Map<string, { count: number; firstSeen: number }> = new Map();

// Update source types
export type UpdateSource = 'hubspot_webhook' | 'internal_api' | 'auto_reassign' | 'manual_reassign' | 'sync_job' | 'unknown';

/**
 * Check if we should process this lead or if circuit breaker should trip
 * 
 * @param leadId - The contact/lead ID being processed
 * @returns { shouldProcess: boolean, reason?: string }
 */
export function checkCircuitBreaker(leadId: string): { shouldProcess: boolean; reason?: string; count: number } {
  const now = Date.now();
  const key = `lead_${leadId}`;
  
  const existing = processingTracker.get(key);
  
  if (!existing) {
    // First time seeing this lead
    processingTracker.set(key, { count: 1, firstSeen: now });
    return { shouldProcess: true, count: 1 };
  }
  
  // Check if window has expired
  if (now - existing.firstSeen > WINDOW_MS) {
    // Reset the counter
    processingTracker.set(key, { count: 1, firstSeen: now });
    return { shouldProcess: true, count: 1 };
  }
  
  // Window still active - increment counter
  const newCount = existing.count + 1;
  processingTracker.set(key, { ...existing, count: newCount });
  
  if (newCount > MAX_PROCESSING_COUNT) {
    return { 
      shouldProcess: false, 
      reason: `Circuit breaker tripped: Lead ${leadId} processed ${newCount} times in ${Math.round((now - existing.firstSeen) / 1000)}s. Halting to prevent infinite loop.`,
      count: newCount
    };
  }
  
  return { shouldProcess: true, count: newCount };
}

/**
 * Reset circuit breaker for a specific lead
 * Call this after successful processing or manual reset
 */
export function resetCircuitBreaker(leadId: string): void {
  processingTracker.delete(`lead_${leadId}`);
}

/**
 * Clear all circuit breaker state
 * Use for maintenance/debugging
 */
export function clearAllCircuitBreakers(): void {
  processingTracker.clear();
}

/**
 * Check if an update should be propagated based on its source
 * 
 * RULE: If update came FROM HubSpot (webhook), do NOT sync back TO HubSpot
 * 
 * @param source - The source of the update
 * @param targetDirection - Where we want to send the update
 * @returns Whether to proceed with the sync
 */
export function shouldPropagate(source: UpdateSource, targetDirection: 'to_hubspot' | 'to_supabase'): boolean {
  // If update came from HubSpot webhook, do NOT sync back to HubSpot
  if (source === 'hubspot_webhook' && targetDirection === 'to_hubspot') {
    console.log(`[Circuit Breaker] Blocking sync to HubSpot - update originated from HubSpot webhook`);
    return false;
  }
  
  // If update came from sync job (pulling from HubSpot), do NOT sync back
  if (source === 'sync_job' && targetDirection === 'to_hubspot') {
    console.log(`[Circuit Breaker] Blocking sync to HubSpot - update came from sync job`);
    return false;
  }
  
  return true;
}

/**
 * Create a record in the database to track update source
 * This allows us to check the source before processing webhooks
 */
export async function recordUpdateSource(
  supabase: any,
  contactId: string,
  source: UpdateSource,
  details?: Record<string, any>
): Promise<void> {
  try {
    await supabase.from('update_source_log').insert({
      contact_id: contactId,
      source,
      details,
      created_at: new Date().toISOString(),
      expires_at: new Date(Date.now() + WINDOW_MS * 2).toISOString() // Keep for 2 minutes
    });
  } catch (error) {
    console.warn('[Circuit Breaker] Failed to log update source:', error);
    // Non-fatal - continue processing
  }
}

/**
 * Check if a recent update for this contact came from internal source
 * If so, we should ignore the incoming HubSpot webhook
 */
export async function wasRecentlyUpdatedInternally(
  supabase: any,
  contactId: string,
  windowMs: number = WINDOW_MS
): Promise<{ wasInternal: boolean; source?: UpdateSource }> {
  try {
    const cutoff = new Date(Date.now() - windowMs).toISOString();
    
    const { data, error } = await supabase
      .from('update_source_log')
      .select('source, created_at')
      .eq('contact_id', contactId)
      .gte('created_at', cutoff)
      .in('source', ['internal_api', 'auto_reassign', 'manual_reassign'])
      .order('created_at', { ascending: false })
      .limit(1);
    
    if (error || !data || data.length === 0) {
      return { wasInternal: false };
    }
    
    return { wasInternal: true, source: data[0].source };
  } catch (error) {
    console.warn('[Circuit Breaker] Failed to check update source:', error);
    return { wasInternal: false };
  }
}

/**
 * Log circuit breaker trip to database for alerting
 */
export async function logCircuitBreakerTrip(
  supabase: any,
  contactId: string,
  count: number,
  reason: string
): Promise<void> {
  try {
    await supabase.from('sync_errors').insert({
      platform: 'hubspot',
      error_type: 'circuit_breaker_trip',
      error_message: reason,
      context: {
        contact_id: contactId,
        processing_count: count,
        workflow_id: '1655409725',
        alert_level: 'critical'
      },
      occurred_at: new Date().toISOString()
    });
    
    // Also insert a proactive insight for visibility
    await supabase.from('proactive_insights').insert({
      insight_type: 'system_alert',
      title: 'Circuit Breaker Tripped - Infinite Loop Detected',
      description: reason,
      priority: 'critical',
      source_agent: 'circuit-breaker',
      is_actionable: true,
      data: {
        contact_id: contactId,
        processing_count: count,
        recommended_action: 'Review HubSpot workflow 1655409725 for infinite loop'
      }
    });
  } catch (error) {
    console.error('[Circuit Breaker] Failed to log trip:', error);
  }
}

/**
 * Wrapper function that combines all checks
 * Use this in webhook handlers and sync functions
 */
export async function safeProcessLead(
  supabase: any,
  contactId: string,
  source: UpdateSource,
  processFn: () => Promise<any>
): Promise<{ success: boolean; result?: any; blocked?: string }> {
  
  // 1. Check circuit breaker
  const circuitCheck = checkCircuitBreaker(contactId);
  if (!circuitCheck.shouldProcess) {
    await logCircuitBreakerTrip(supabase, contactId, circuitCheck.count, circuitCheck.reason!);
    return { success: false, blocked: circuitCheck.reason };
  }
  
  // 2. If from HubSpot webhook, check if we recently updated this contact
  if (source === 'hubspot_webhook') {
    const internalCheck = await wasRecentlyUpdatedInternally(supabase, contactId);
    if (internalCheck.wasInternal) {
      console.log(`[Circuit Breaker] Ignoring HubSpot webhook for ${contactId} - recently updated internally via ${internalCheck.source}`);
      return { 
        success: false, 
        blocked: `Ignoring webhook - contact was recently updated internally (${internalCheck.source})` 
      };
    }
  }
  
  // 3. Record this update source
  await recordUpdateSource(supabase, contactId, source);
  
  // 4. Process the lead
  try {
    const result = await processFn();
    return { success: true, result };
  } catch (error) {
    return { success: false, blocked: `Processing error: ${error}` };
  }
}

export default {
  checkCircuitBreaker,
  resetCircuitBreaker,
  clearAllCircuitBreakers,
  shouldPropagate,
  recordUpdateSource,
  wasRecentlyUpdatedInternally,
  logCircuitBreakerTrip,
  safeProcessLead
};

