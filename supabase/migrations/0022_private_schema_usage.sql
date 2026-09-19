-- Pickolo Studio
-- Migration 0022: allow authenticated RLS policies to resolve private admin helper
-- Date: 2026-09-20

-- The public.is_admin() invoker wrapper calls private.is_admin(), which is
-- SECURITY DEFINER. PostgreSQL still requires schema USAGE on the private
-- schema for the caller to resolve that function during RLS evaluation.
-- The helper itself remains non-executable by public/anon/authenticated.
grant usage on schema private to authenticated;
