-- Add contact_id to call_records for lead attribution
ALTER TABLE call_records ADD COLUMN IF NOT EXISTS contact_id UUID REFERENCES contacts(id);
CREATE INDEX IF NOT EXISTS idx_call_records_contact_id ON call_records(contact_id);
