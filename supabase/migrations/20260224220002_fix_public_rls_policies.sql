-- ============================================
-- FIX P1-1: Remove public (anon) read access from sensitive tables
-- These policies had USING (true) without TO authenticated,
-- meaning anon key could dump all data
-- ============================================

-- Fix contacts
DROP POLICY IF EXISTS "Public read access for contacts" ON public.contacts;
CREATE POLICY "auth_read_contacts" ON public.contacts
  FOR SELECT TO authenticated USING (true);

-- Fix deals
DROP POLICY IF EXISTS "Public read access for deals" ON public.deals;
CREATE POLICY "auth_read_deals" ON public.deals
  FOR SELECT TO authenticated USING (true);

-- Fix other sensitive tables that may have public read
DROP POLICY IF EXISTS "Public read access for call_records" ON public.call_records;
CREATE POLICY "auth_read_call_records" ON public.call_records
  FOR SELECT TO authenticated USING (true);

DROP POLICY IF EXISTS "Public read access for stripe_transactions" ON public.stripe_transactions;
CREATE POLICY "auth_read_stripe_transactions" ON public.stripe_transactions
  FOR SELECT TO authenticated USING (true);

DROP POLICY IF EXISTS "Public read access for stripe_invoices" ON public.stripe_invoices;
CREATE POLICY "auth_read_stripe_invoices" ON public.stripe_invoices
  FOR SELECT TO authenticated USING (true);

DROP POLICY IF EXISTS "Public read access for stripe_subscriptions" ON public.stripe_subscriptions;
CREATE POLICY "auth_read_stripe_subscriptions" ON public.stripe_subscriptions
  FOR SELECT TO authenticated USING (true);

DROP POLICY IF EXISTS "Public read access for stripe_payouts" ON public.stripe_payouts;
CREATE POLICY "auth_read_stripe_payouts" ON public.stripe_payouts
  FOR SELECT TO authenticated USING (true);

DROP POLICY IF EXISTS "Public read access for stripe_fraud_alerts" ON public.stripe_fraud_alerts;
CREATE POLICY "auth_read_stripe_fraud_alerts" ON public.stripe_fraud_alerts
  FOR SELECT TO authenticated USING (true);
