# Business Intelligence Logic & Metric Definitions

This document serves as the absolute source of truth for how metrics are calculated within the Client Vital Suite.

## 1. Revenue Metrics (Executive Overview)
Calculated via `get_dashboard_stats()` Postgres RPC.

- **Monthly Revenue**: `SUM(deal_value)` for all deals with `status = 'closed'` where the `close_date` is between the first and last day of the current month.
- **Revenue Trend (%)**: Percentage change between current month revenue and previous month revenue. 
  - Formula: `((CurrentMonth - LastMonth) / LastMonth) * 100`
- **Average Deal Value**: `Total Revenue (This Month) / Count of Closed Deals (This Month)`.
- **Pipeline Value**: `SUM(deal_value)` for all deals where `status` is NOT 'closed' and NOT 'lost'.

## 2. Client Health Metrics
Calculated via `useCEOData` hook and `calculateClientHealth` utility.

- **Health Zones**: 
  - `Green`: Score > 80 (Stable)
  - `Yellow`: Score 50-80 (Monitor)
  - `Red`: Score < 50 (Critical Risk)
  - `Purple`: Reserved for VIP/Custom handling.
- **At-Risk Revenue**: The sum of `package_value_aed` for all clients currently in the `Red` or `Yellow` zones.
- **Avg Health Score**: Simple average of all active client health scores.

## 3. Integration Health
- **Platform Connected**: A platform (HubSpot, Stripe, CallGear, Facebook) is marked as `connected` if at least one sync log in the last 50 entries shows `status = 'success'`.
- **Sync Errors**: Count of entries in `sync_errors` where `resolved_at` is NULL.

## 4. Full-Chain Funnel (Ad -> Close)
Logic tracked via `business-intelligence` edge function.
- **Ad Spend**: Raw spend from `facebook_insights`.
- **Leads**: Count of new contacts in HubSpot with `lead` lifecycle.
- **Calls**: Count of entries in `call_records`.
- **Booked**: Deals created in "Appointment Booked" stage.
- **Closed**: Deals moved to "Closed Won".

---
*Last Updated: February 13, 2026*
