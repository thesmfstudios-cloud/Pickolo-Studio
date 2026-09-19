-- Pickolo Studio
-- Migration 0021: move admin authorization implementation out of exposed public schema
-- Date: 2026-09-19

create schema if not exists private;

create or replace function private.is_admin()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.profiles
    where id = auth.uid()
      and role = 'admin'
  );
$$;

revoke all on function private.is_admin() from public, anon, authenticated;

create or replace function public.is_admin()
returns boolean
language sql
stable
security invoker
set search_path = public, private
as $$
  select private.is_admin();
$$;

revoke execute on function public.is_admin() from public, anon, authenticated;
grant execute on function public.is_admin() to authenticated;
