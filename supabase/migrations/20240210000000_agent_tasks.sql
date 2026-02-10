
create table if not exists agent_tasks (
  id uuid default gen_random_uuid() primary key,
  created_at timestamp with time zone default timezone('utc'::text, now()) not null,
  status text default 'pending' check (status in ('pending', 'processing', 'completed', 'failed')),
  priority text default 'normal' check (priority in ('low', 'normal', 'high', 'urgent')),
  requestor text not null, -- e.g., 'dialogflow-fulfillment', 'audit-script'
  task_type text not null, -- e.g., 'finance_inquiry', 'strategy_consult'
  payload jsonb default '{}'::jsonb, -- The query, context, phone number
  result jsonb, -- The answer from Atlas
  assigned_agent text default 'atlas',
  processed_at timestamp with time zone
);

-- Enable RLS
alter table agent_tasks enable row level security;

-- Policy: Service role has full access
create policy "Service role full access"
  on agent_tasks
  for all
  using ( auth.role() = 'service_role' );
