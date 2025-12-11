import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const GITHUB_TOKEN = Deno.env.get('GITHUB_TOKEN');
const GITHUB_REPO = Deno.env.get('GITHUB_REPO'); // e.g., 'username/client-vital-suite'

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
                // Execute SQL (careful - validate first!)
                const { error: sqlError } = await supabase.rpc('exec_sql', { sql_query: sql });
                if (sqlError) throw sqlError;
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

    } catch (error) {
        console.error('Deploy trigger error:', error);
        return new Response(JSON.stringify({
            success: false,
            error: error.message
        }), {
            status: 500,
            headers: { 'Content-Type': 'application/json' }
        });
    }
});
