-- Add unique constraint to thread_id if it doesn't exist
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint WHERE conname = 'agent_memory_thread_id_key'
    ) THEN
        ALTER TABLE public.agent_memory ADD CONSTRAINT agent_memory_thread_id_key UNIQUE (thread_id);
    END IF;
END
$$;
