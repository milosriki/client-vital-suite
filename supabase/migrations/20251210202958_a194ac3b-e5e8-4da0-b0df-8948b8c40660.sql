-- Allow the agent to insert learning data
CREATE POLICY "Allow insert to agent_context" 
ON public.agent_context 
FOR INSERT 
WITH CHECK (true);

-- Allow the agent to update learning data
CREATE POLICY "Allow update to agent_context" 
ON public.agent_context 
FOR UPDATE 
USING (true)
WITH CHECK (true);