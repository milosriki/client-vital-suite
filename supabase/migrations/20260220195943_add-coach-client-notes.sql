-- Coach/Client notes for team leaders
CREATE TABLE IF NOT EXISTS coach_client_notes (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  entity_type TEXT NOT NULL CHECK (entity_type IN ('coach', 'client')),
  entity_name TEXT NOT NULL,
  entity_id TEXT,
  note TEXT NOT NULL,
  note_type TEXT DEFAULT 'general' CHECK (note_type IN ('general', 'concern', 'positive', 'action_item', 'follow_up')),
  created_by TEXT DEFAULT 'team_leader',
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now(),
  is_resolved BOOLEAN DEFAULT false,
  resolved_at TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS idx_ccn_entity ON coach_client_notes(entity_type, entity_name);
CREATE INDEX IF NOT EXISTS idx_ccn_created ON coach_client_notes(created_at DESC);

ALTER TABLE coach_client_notes ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Allow authenticated read coach_client_notes" ON coach_client_notes;
CREATE POLICY "Allow authenticated read coach_client_notes" ON coach_client_notes FOR SELECT TO authenticated USING (true);
DROP POLICY IF EXISTS "Allow authenticated insert coach_client_notes" ON coach_client_notes;
CREATE POLICY "Allow authenticated insert coach_client_notes" ON coach_client_notes FOR INSERT TO authenticated WITH CHECK (true);
DROP POLICY IF EXISTS "Allow authenticated update coach_client_notes" ON coach_client_notes;
CREATE POLICY "Allow authenticated update coach_client_notes" ON coach_client_notes FOR UPDATE TO authenticated USING (true);
