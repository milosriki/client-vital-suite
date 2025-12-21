import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const GITHUB_TOKEN = Deno.env.get('GITHUB_TOKEN');
const GITHUB_REPO = Deno.env.get('GITHUB_REPO') || 'milosriki/client-vital-suite';

// =============================================================================
// SECURITY UTILITIES - Timeout and Retry Logic
// =============================================================================

/**
 * Execute a promise with timeout
 */
async function withTimeout<T>(
  promise: Promise<T>,
  timeoutMs: number,
  operationName: string
): Promise<T> {
  const timeoutPromise = new Promise<T>((_, reject) => {
    setTimeout(() => {
      reject(new Error(`${operationName} timed out after ${timeoutMs}ms`));
    }, timeoutMs);
  });

  return Promise.race([promise, timeoutPromise]);
}

/**
 * Retry a function with exponential backoff
 */
async function withRetry<T>(
  fn: () => Promise<T>,
  maxAttempts: number = 3,
  delayMs: number = 1000
): Promise<T> {
  let lastError: Error | null = null;

  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    try {
      return await fn();
    } catch (error) {
      lastError = error as Error;
      console.warn(`Attempt ${attempt}/${maxAttempts} failed:`, error);

      // Don't retry on the last attempt
      if (attempt === maxAttempts) break;

      // Exponential backoff: 1s, 2s, 4s
      const delay = delayMs * Math.pow(2, attempt - 1);
      console.log(`Retrying in ${delay}ms...`);
      await new Promise(resolve => setTimeout(resolve, delay));
    }
  }

  throw lastError || new Error('Operation failed after retries');
}

/**
 * Combine timeout and retry for robust operations
 */
async function withTimeoutAndRetry<T>(
  fn: () => Promise<T>,
  timeoutMs: number = 30000,
  maxAttempts: number = 3
): Promise<T> {
  return withRetry(
    () => withTimeout(fn(), timeoutMs, 'Database operation'),
    maxAttempts
  );
}

serve(async (req) => {
    const corsHeaders = {
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
    };

    if (req.method === 'OPTIONS') {
        return new Response('ok', { headers: corsHeaders });
    }

    try {
        const { approval_id, approved, approved_by, rejection_reason } = await req.json();

        const supabase = createClient(
            Deno.env.get('SUPABASE_URL')!,
            Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
        );

        // Get the action
        const { data: action, error: fetchError } = await supabase
            .from('prepared_actions')
            .select('*')
            .eq('id', approval_id)
            .single();

        if (fetchError || !action) {
            throw new Error('Action not found');
        }

        if (!approved) {
            // ========================================
            // REJECTION - Record for learning
            // ========================================

            await supabase
                .from('prepared_actions')
                .update({
                    status: 'rejected',
                    rejection_reason
                })
                .eq('id', approval_id);

            // Save to calibration for AI learning
            await supabase.from('business_calibration').insert({
                scenario_type: action.action_type,
                scenario_description: action.action_title,
                ai_recommendation: action.action_description,
                ai_reasoning: action.reasoning,
                ai_confidence: action.confidence,
                your_decision: 'REJECTED',
                your_reasoning: rejection_reason || 'Not provided',
                was_ai_correct: false,
                learning_weight: 4, // High weight - learn from rejections
                action_id: approval_id
            });

            return new Response(JSON.stringify({
                success: true,
                status: 'rejected',
                message: 'Rejection recorded for AI learning'
            }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
        }

        // ========================================
        // APPROVAL - Execute based on type
        // ========================================

        await supabase
            .from('prepared_actions')
            .update({
                status: 'executing',
                approved_at: new Date().toISOString(),
                approved_by
            })
            .eq('id', approval_id);

        if (action.action_type === 'code_deploy') {
            // ========================================
            // CODE DEPLOYMENT - Trigger GitHub Actions
            // ========================================

            const files = action.prepared_payload?.files || [];

            if (files.length === 0) {
                throw new Error('No files to deploy');
            }

            // Trigger GitHub Actions via repository dispatch
            const ghResponse = await fetch(
                `https://api.github.com/repos/${GITHUB_REPO}/dispatches`,
                {
                    method: 'POST',
                    headers: {
                        'Authorization': `Bearer ${GITHUB_TOKEN}`,
                        'Accept': 'application/vnd.github.v3+json',
                        'Content-Type': 'application/json'
                    },
                    body: JSON.stringify({
                        event_type: 'ai-deploy',
                        client_payload: {
                            approval_id,
                            files,
                            commit_message: `🤖 AI Deploy: ${action.action_title}`
                        }
                    })
                }
            );

            if (!ghResponse.ok) {
                const errorText = await ghResponse.text();
                throw new Error(`GitHub API error: ${errorText}`);
            }

            return new Response(JSON.stringify({
                success: true,
                status: 'deploying',
                message: 'GitHub Actions triggered. Deployment in progress...'
            }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } });

        } else if (action.action_type === 'database') {
            // ========================================
            // DATABASE MIGRATION
            // ========================================

            const sql = action.prepared_payload?.sql;
            if (sql) {
                // ========================================
                // SQL VALIDATION - Prevent SQL Injection
                // ========================================
                const sqlUpper = sql.trim().toUpperCase();
                const sqlNormalized = sql.trim().replace(/\s+/g, ' ').toUpperCase();

                // Block dangerous operations
                const dangerousPatterns = [
                    /DROP\s+(TABLE|DATABASE|SCHEMA|FUNCTION|TRIGGER)/i,
                    /TRUNCATE\s+/i,
                    /DELETE\s+FROM\s+\w+\s*;?\s*$/i, // DELETE without WHERE
                    /UPDATE\s+\w+\s+SET\s+.*\s*;?\s*$/i, // UPDATE without WHERE
                    /GRANT\s+/i,
                    /REVOKE\s+/i,
                    /ALTER\s+USER/i,
                    /CREATE\s+USER/i,
                    /DROP\s+USER/i,
                    /--\s*$/m, // SQL comments at end
                    /\/\*/i, // Block comments
                ];

                const isDangerous = dangerousPatterns.some(pattern => pattern.test(sql));

                if (isDangerous) {
                    throw new Error('SQL validation failed: Dangerous operation detected. Only safe operations (CREATE TABLE, ALTER TABLE, INSERT with WHERE) are allowed.');
                }

                // Only allow specific safe operations
                const allowedOperations = [
                    /^CREATE\s+TABLE\s+/i,
                    /^CREATE\s+INDEX\s+/i,
                    /^ALTER\s+TABLE\s+\w+\s+ADD\s+COLUMN/i,
                    /^INSERT\s+INTO\s+\w+\s*\(/i,
                    /^UPDATE\s+\w+\s+SET\s+.*\s+WHERE\s+/i, // UPDATE with WHERE clause
                    /^DELETE\s+FROM\s+\w+\s+WHERE\s+/i, // DELETE with WHERE clause
                ];

                const isAllowed = allowedOperations.some(pattern => pattern.test(sql));

                if (!isAllowed) {
                    throw new Error(`SQL validation failed: Operation not allowed. Permitted operations: CREATE TABLE, CREATE INDEX, ALTER TABLE ADD COLUMN, INSERT INTO, UPDATE with WHERE, DELETE with WHERE.`);
                }

                // Additional security: Prevent WHERE clause bypass attacks
                const whereClauseBypass = [
                    /WHERE\s+(1\s*=\s*1|true|'1'\s*=\s*'1')/i,
                    /WHERE\s+\w+\s+LIKE\s+'%'/i, // WHERE col LIKE '%' matches everything
                    /WHERE\s+\w+\s+IS\s+NOT\s+NULL/i, // WHERE col IS NOT NULL might match everything
                ];

                const hasBypass = whereClauseBypass.some(pattern => pattern.test(sql));

                if (hasBypass) {
                    throw new Error('SQL validation failed: WHERE clause bypass detected. WHERE conditions must be specific (e.g., WHERE id=123, WHERE email=\'user@example.com\').');
                }

                // Additional security: Check for multiple statements
                const statementCount = sql.split(';').filter(s => s.trim().length > 0).length;
                if (statementCount > 1) {
                    throw new Error('SQL validation failed: Multiple statements not allowed. Execute one statement at a time.');
                }

                console.log('✅ SQL validation passed:', sqlUpper.split(' ').slice(0, 3).join(' '));

                // Execute SQL after validation with timeout and retry
                try {
                    await withTimeoutAndRetry(async () => {
                        const { error: sqlError } = await supabase.rpc('exec_sql', { sql_query: sql });
                        if (sqlError) {
                            console.error('SQL execution error:', sqlError);
                            throw new Error(`SQL execution failed: ${sqlError.message}`);
                        }
                    }, 30000, 3); // 30 second timeout, 3 retry attempts
                    console.log('✅ SQL executed successfully');
                } catch (execError) {
                    const errMsg = execError instanceof Error ? execError.message : String(execError);
                    throw new Error(`SQL execution failed after retries: ${errMsg}`);
                }
            } else {
                throw new Error('No SQL query provided in prepared_payload');
            }

            await supabase
                .from('prepared_actions')
                .update({ status: 'executed', executed_at: new Date().toISOString() })
                .eq('id', approval_id);

            return new Response(JSON.stringify({
                success: true,
                status: 'executed',
                message: 'Database migration completed'
            }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } });

        } else {
            // ========================================
            // OTHER ACTIONS (intervention, analysis, etc.)
            // ========================================

            await supabase
                .from('prepared_actions')
                .update({ status: 'executed', executed_at: new Date().toISOString() })
                .eq('id', approval_id);

            // Record success for learning
            await supabase.from('business_calibration').insert({
                scenario_type: action.action_type,
                scenario_description: action.action_title,
                ai_recommendation: action.action_description,
                ai_reasoning: action.reasoning,
                ai_confidence: action.confidence,
                your_decision: 'APPROVED',
                your_reasoning: 'Executed successfully',
                was_ai_correct: true,
                learning_weight: 2,
                action_id: approval_id
            });

            return new Response(JSON.stringify({
                success: true,
                status: 'executed',
                message: 'Action executed successfully'
            }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
        }

    } catch (error: unknown) {
        console.error('Deploy trigger error:', error);
        const message = error instanceof Error ? error.message : 'Unknown error';
        return new Response(JSON.stringify({
            success: false,
            error: message
        }), {
            status: 500,
            headers: { 'Content-Type': 'application/json' }
        });
    }
});
