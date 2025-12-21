CREATE TABLE IF NOT EXISTS public.hubspot_property_definitions (
  object_type TEXT NOT NULL CHECK (object_type IN ('contact', 'deal', 'company', 'engagement')),
  property_name TEXT NOT NULL,
  property_label TEXT,
  field_type TEXT,
  options JSONB DEFAULT '[]'::jsonb,
  is_required BOOLEAN DEFAULT FALSE,
  is_hidden BOOLEAN DEFAULT FALSE,
  description TEXT,
  last_synced_at TIMESTAMPTZ DEFAULT NOW(),
  PRIMARY KEY (object_type, property_name)
);

CREATE INDEX IF NOT EXISTS idx_hubspot_props_type ON hubspot_property_definitions(object_type);
CREATE INDEX IF NOT EXISTS idx_hubspot_props_updated ON hubspot_property_definitions(last_synced_at);
