-- Create agent_skills table to store the specialized personas
create table if not exists public.agent_skills (
  id text primary key, -- e.g. 'growth-hacker'
  name text not null,
  description text,
  content text not null, -- Full markdown content
  capabilities jsonb default '[]'::jsonb,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

-- Enable RLS
alter table public.agent_skills enable row level security;

-- Create policy to allow read access to authenticated users and service roles
create policy "Allow read access to everyone"
  on public.agent_skills
  for select
  to authenticated, service_role
  using (true);

-- Create policy to allow write access only to service role (for sync script)
create policy "Allow write access to service role"
  on public.agent_skills
  for all
  to service_role
  using (true)
  with check (true);

-- Add function to automatically update updated_at
create or replace function public.handle_updated_at()
returns trigger as $$
begin
  new.updated_at = now();
  return new;
end;
$$ language plpgsql;

create trigger handle_agent_skills_updated_at
  before update on public.agent_skills
  for each row
  execute function public.handle_updated_at();
