-- Pickolo Studio
-- Migration 0023: grant private admin helper execution for RLS
-- Date: 2026-09-20

grant execute on function private.is_admin() to authenticated;
