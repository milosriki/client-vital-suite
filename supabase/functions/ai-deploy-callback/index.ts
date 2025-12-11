import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

serve(async (req) => {
    try {
        const { approval_id, status, error, deployed_at } = await req.json();

        const supabase = createClient(
            Deno.env.get('SUPABASE_URL')!,
            Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
        );

        if (status === 'success') {
            // Update action as executed
            await supabase
                .from('prepared_actions')
                .update({
                    status: 'executed',
                    executed_at: deployed_at || new Date().toISOString()
                })
                .eq('id', approval_id);

            // Record success for AI learning
            const { data: action } = await supabase
                .from('prepared_actions')
                .select('*')
                .eq('id', approval_id)
                .single();

            if (action) {
                await supabase.from('business_calibration').insert({
                    scenario_type: action.action_type,
                    scenario_description: action.action_title,
                    ai_recommendation: action.action_description,
                    ai_reasoning: action.reasoning,
                    ai_confidence: action.confidence,
                    your_decision: 'APPROVED & DEPLOYED',
                    your_reasoning: 'Successfully deployed to production',
                    was_ai_correct: true,
                    learning_weight: 3,
                    action_id: approval_id
                });
            }

            console.log(`✅ Deployment successful: ${approval_id}`);

        } else {
            // Update action as failed
            await supabase
                .from('prepared_actions')
                .update({
                    status: 'failed',
                    rejection_reason: `Deployment failed: ${error}`
                })
                .eq('id', approval_id);

            console.log(`❌ Deployment failed: ${approval_id} - ${error}`);
        }

        return new Response(JSON.stringify({ received: true }));

    } catch (error) {
        console.error('Callback error:', error);
        return new Response(JSON.stringify({ error: error.message }), { status: 500 });
    }
});
