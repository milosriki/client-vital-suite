-- Migration: Add attribution columns for deals and contacts
-- Date: 2026-03-04
-- Purpose: Enable deal-to-Stripe FK tracking and Facebook attribution on contacts

-- Add stripe_payment_id to deals table for attribution chain
ALTER TABLE deals ADD COLUMN IF NOT EXISTS stripe_payment_id TEXT;

-- Index for fast lookups by stripe_payment_id
CREATE INDEX IF NOT EXISTS idx_deals_stripe_payment_id ON deals(stripe_payment_id);

-- Add Facebook attribution columns to contacts
ALTER TABLE contacts ADD COLUMN IF NOT EXISTS fb_ad_id TEXT;
ALTER TABLE contacts ADD COLUMN IF NOT EXISTS fb_campaign_id TEXT;

-- Indexes for Facebook attribution lookups
CREATE INDEX IF NOT EXISTS idx_contacts_fb_ad_id ON contacts(fb_ad_id);
CREATE INDEX IF NOT EXISTS idx_contacts_fb_campaign_id ON contacts(fb_campaign_id);
