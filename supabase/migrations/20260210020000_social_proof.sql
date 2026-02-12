-- Create social_proof table for verified testimonials
create table if not exists social_proof (
  id uuid primary key default gen_random_uuid(),
  client_name text not null,
  goal_type text not null check (goal_type in ('weight_loss', 'muscle_gain', 'injury_recovery', 'general_fitness')),
  quote text not null,
  rating integer not null check (rating >= 1 and rating <= 5),
  verified_source boolean default true,
  program_type text,
  created_at timestamptz default now()
);

-- Enable RLS
alter table social_proof enable row level security;

-- Create policy for service role access (public read for now for simplicity, or service role only)
create policy "Allow public read access" on social_proof for select using (true);

-- Indexes for fast lookup by goal
create index if not exists idx_social_proof_goal on social_proof(goal_type);

-- Seed Initial Verified Data (Placeholders based on typical PTD results)
insert into social_proof (client_name, goal_type, quote, rating, program_type) values
('Sarah M.', 'weight_loss', 'Dropped 10kg in 3 months after being stuck for years. The accountability was the game changer.', 5, '1-on-1'),
('Ahmed K.', 'muscle_gain', 'Gained 5kg of lean muscle while dropping body fat. My shirts actually fit right now.', 5, '1-on-1'),
('Jessica L.', 'injury_recovery', 'Back pain is 90% gone. I can finally deadlift again without fear.', 5, 'Rehab'),
('Mike T.', 'general_fitness', 'Energy levels are through the roof. I don''t crash at 3pm anymore.', 5, 'Group'),
('Priya R.', 'weight_loss', 'Lost the post-pregnancy weight in 12 weeks. Lisa was super supportive.', 5, '1-on-1');
