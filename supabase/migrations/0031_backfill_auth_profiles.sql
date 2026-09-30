-- Backfill profiles for users created before the auth-user trigger was installed.
insert into public.profiles (id, full_name, phone)
select
  u.id,
  coalesce(u.raw_user_meta_data ->> 'full_name', u.raw_user_meta_data ->> 'name', ''),
  coalesce(u.phone, u.raw_user_meta_data ->> 'phone')
from auth.users u
left join public.profiles p on p.id = u.id
where p.id is null
on conflict (id) do nothing;
