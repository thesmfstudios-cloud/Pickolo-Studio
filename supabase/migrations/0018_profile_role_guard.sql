-- Pickolo Studio
-- Migration 0018: protect profile roles from self-escalation
-- Date: 2026-09-19

create or replace function public.prevent_unauthorized_role_change()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if new.role is distinct from old.role then
    -- Server-side service-role writes have no end-user auth.uid() and are
    -- allowed. Authenticated users may not change their own role. Only an
    -- existing admin may change somebody else's role.
    if auth.uid() is not null and (
      auth.uid() = old.id
      or not public.is_admin()
    ) then
      raise exception 'Profile role changes are server-managed.';
    end if;
  end if;

  return new;
end;
$$;

drop trigger if exists profiles_role_guard on public.profiles;
create trigger profiles_role_guard
before update of role on public.profiles
for each row
execute procedure public.prevent_unauthorized_role_change();

revoke all on function public.prevent_unauthorized_role_change() from public;
