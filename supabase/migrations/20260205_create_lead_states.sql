-- Create a table to track the state of each lead/chat
create table if not exists public.lead_states (
  phone_number text primary key,
  bot_paused boolean default false,
  paused_until timestamptz,
  last_interaction timestamptz default now(),
  created_at timestamptz default now()
);

-- Enable RLS
alter table public.lead_states enable row level security;

-- Allow Edge Functions (service_role) full access
create policy "Service role has full access"
  on public.lead_states
  for all
  to service_role
  using (true)
  with check (true);

-- Create indexes for performance
create index if not exists lead_states_bot_paused_idx on public.lead_states(bot_paused);

-- Add indexes to knowledge_base as per Audit check
create index if not exists knowledge_base_question_fts_idx on public.knowledge_base using gin (to_tsvector('english', question));
-- Note: vector index created if pgvector is enabled, assuming ivfflat for now if roughly > 2000 rows, but for small table standard select is fine.
-- We will add a vector index just in case.
create index if not exists knowledge_base_embedding_idx on public.knowledge_base using ivfflat (embedding vector_cosine_ops)
  with (lists = 100);
