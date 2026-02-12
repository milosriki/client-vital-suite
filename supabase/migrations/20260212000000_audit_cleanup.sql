-- Migration: 20260212_audit_cleanup.sql
-- Purpose: Clean up schema typos and unused indexes identified in the 2026-02-12 Audit

-- 1. Drop the schema with the typo (Critical Fix)
-- "TRANFERS FROM STRIOPE" -> Likely a typo for "transfers_from_stripe" or similar
DROP SCHEMA IF EXISTS "TRANFERS FROM STRIOPE" CASCADE;

-- 2. Drop verified unused indexes (Critical Optimization)
-- These had 0 scans and 0 queries in the audit report
DROP INDEX IF EXISTS public.idx_sync_log_service;
DROP INDEX IF EXISTS public.idx_edge_function_logs_status;
DROP INDEX IF EXISTS public.idx_ai_feedback_learning_insight_id;
