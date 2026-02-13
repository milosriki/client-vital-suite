-- Task 4.2: Deal ↔ Stripe Revenue Link
-- Join path: deals → contacts (contact_id) → known_cards (email) → stripe_transactions (customer_id)
-- Also uses stripe_invoices for invoice-level revenue

-- Helper index for known_cards email lookups
CREATE INDEX IF NOT EXISTS idx_known_cards_customer_email
  ON known_cards (customer_email) WHERE customer_email IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_stripe_txn_customer_id
  ON stripe_transactions (customer_id) WHERE customer_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_stripe_inv_customer_id
  ON stripe_invoices (customer_id) WHERE customer_id IS NOT NULL;

-- View: deal_stripe_revenue
-- Matches each deal to actual Stripe payment data via contact email → known_cards bridge
CREATE OR REPLACE VIEW public.deal_stripe_revenue AS
WITH deal_customers AS (
    -- Map deals to Stripe customer IDs via contacts.email → known_cards.customer_email
    SELECT DISTINCT
        d.id AS deal_id,
        d.hubspot_deal_id,
        d.deal_name,
        d.deal_value AS hubspot_deal_value,
        d.stage,
        d.status,
        d.contact_id,
        c.email AS contact_email,
        c.first_name,
        c.last_name,
        kc.customer_id AS stripe_customer_id
    FROM public.deals d
    JOIN public.contacts c ON c.id = d.contact_id
    JOIN public.known_cards kc ON LOWER(kc.customer_email) = LOWER(c.email)
    WHERE d.contact_id IS NOT NULL
      AND c.email IS NOT NULL
      AND kc.customer_id IS NOT NULL
),
stripe_revenue AS (
    -- Sum all successful Stripe transactions per customer
    SELECT
        customer_id,
        COUNT(*) AS transaction_count,
        SUM(CASE WHEN status = 'succeeded' THEN amount ELSE 0 END) AS total_paid_amount,
        SUM(amount) AS total_amount,
        MIN(created_at) AS first_payment_at,
        MAX(created_at) AS last_payment_at,
        -- Most common currency
        MODE() WITHIN GROUP (ORDER BY currency) AS primary_currency
    FROM public.stripe_transactions
    WHERE amount > 0
    GROUP BY customer_id
),
invoice_revenue AS (
    -- Sum paid invoices per customer
    SELECT
        customer_id,
        COUNT(*) FILTER (WHERE paid = true) AS paid_invoice_count,
        SUM(amount_paid) FILTER (WHERE paid = true) AS total_invoiced_paid,
        SUM(amount_due) AS total_invoiced_due
    FROM public.stripe_invoices
    GROUP BY customer_id
)
SELECT
    dc.deal_id,
    dc.hubspot_deal_id,
    dc.deal_name,
    dc.stage,
    dc.status,
    dc.contact_email,
    dc.first_name,
    dc.last_name,
    dc.hubspot_deal_value,
    dc.stripe_customer_id,
    -- Stripe transaction revenue
    COALESCE(sr.transaction_count, 0) AS stripe_transaction_count,
    COALESCE(sr.total_paid_amount, 0) AS stripe_paid_amount,
    sr.primary_currency AS stripe_currency,
    sr.first_payment_at,
    sr.last_payment_at,
    -- Invoice revenue
    COALESCE(ir.paid_invoice_count, 0) AS stripe_invoice_count,
    COALESCE(ir.total_invoiced_paid, 0) AS stripe_invoiced_paid,
    -- Revenue comparison: HubSpot deal value vs actual Stripe payments
    COALESCE(sr.total_paid_amount, 0) AS actual_stripe_revenue,
    dc.hubspot_deal_value AS reported_deal_value,
    CASE
        WHEN COALESCE(sr.total_paid_amount, 0) > 0 AND dc.hubspot_deal_value > 0
        THEN ROUND((sr.total_paid_amount / dc.hubspot_deal_value) * 100, 1)
        ELSE 0
    END AS collection_rate_pct
FROM deal_customers dc
LEFT JOIN stripe_revenue sr ON sr.customer_id = dc.stripe_customer_id
LEFT JOIN invoice_revenue ir ON ir.customer_id = dc.stripe_customer_id;
