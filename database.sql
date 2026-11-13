-- Initial schema for a NEW Supabase project. Run as postgres, never from a browser.
-- No administrator email, passwords or privileged keys are included.
create schema if not exists private;
revoke all on schema private from public, anon, authenticated;
create table public.site_admins (
 user_id uuid primary key references auth.users(id) on delete cascade,
 added_at timestamptz not null default now()
);
create table public.outing_reservations (
 id uuid primary key default gen_random_uuid(),
 request_id uuid not null unique,
 selected_plans jsonb not null default '[]'::jsonb,
 plan_id text not null default 'custom' check (plan_id ~ '^[a-z][a-z0-9-]{0,39}$'),
 plan_title text not null default '自定义出游' check (char_length(btrim(plan_title)) between 1 and 80),
 budget_preference text not null default 'undecided' check (budget_preference in ('undecided','under100','100to200','over200')),
 transport text not null default 'discuss' check (transport in ('discuss','transit','carpool','self')),
 company_preference text not null default 'discuss' check (company_preference in ('together','friends','discuss')),
 invitation_response text not null default 'interested' check (invitation_response in ('interested','discuss')),
 created_at timestamptz not null default now(),
 updated_at timestamptz not null default now(),
 nickname text not null check (char_length(btrim(nickname)) between 1 and 32),
 contact_method text not null check (contact_method in ('wechat','phone','other')),
 contact text not null check (char_length(btrim(contact)) between 1 and 100),
 destination text not null check (char_length(btrim(destination)) between 1 and 100),
 outing_date date,
 time_slot text not null check (time_slot in ('morning','afternoon','evening','all_day','discuss')),
 guest_count integer not null check (guest_count between 1 and 8),
 mood text not null check (mood in ('随性漫游','户外探索','美食探店','都可以')),
 message text not null default '' check (char_length(message) <= 500),
 consent boolean not null check (consent = true),
 website text not null default '' check (website = ''),
 status text not null default 'pending' check (status in ('pending','confirmed','cancelled'))
);
alter table public.outing_reservations
 add constraint outing_reservations_selected_plans_check check (
  case when jsonb_typeof(selected_plans)='array' then
    jsonb_array_length(selected_plans)<=8
    and octet_length(selected_plans::text)<=4096
    and not jsonb_path_exists(selected_plans,$path$$[*] ? (
      @.type() != "object" || !exists(@.id) || !exists(@.title) ||
      @.id.type() != "string" || @.title.type() != "string" ||
      !(@.id like_regex "^[a-z][a-z0-9-]{0,39}$") ||
      !(@.title like_regex "^.{1,80}$" flag "s") ||
      !(@.title like_regex "[^[:space:]]")
    )$path$)
  else false end
 );

create index outing_reservations_created_idx on public.outing_reservations(created_at desc,id desc);
create index outing_reservations_date_status_idx on public.outing_reservations(outing_date,status);
create index outing_reservations_contact_created_idx on public.outing_reservations(lower(contact),created_at desc);
create unique index outing_reservations_same_trip_flexible_idx on public.outing_reservations
 (lower(contact),lower(destination),coalesce(outing_date,date '0001-01-01'),time_slot) where status <> 'cancelled';
-- Internal trigger, not an exposed RPC. Anonymous inserts intentionally have no auth.uid().
-- Contact-based throttling uses a transaction lock to prevent concurrent bypass.
create function private.guard_reservation() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
 if tg_op = 'UPDATE' then
  new.updated_at := now();
  return new;
 end if;
 new.nickname := btrim(new.nickname);
 new.contact := btrim(new.contact);
 new.destination := btrim(new.destination);
 new.message := btrim(new.message);
 if new.outing_date < (now() at time zone 'Asia/Shanghai')::date
  or new.outing_date > (now() at time zone 'Asia/Shanghai')::date + 365 then
  raise exception using errcode = '23514', message = 'INVALID_BOOKING_DATE';
 end if;
 if new.contact_method = 'phone' and new.contact !~ '^\+?[0-9 -]{6,20}$' then
  raise exception using errcode = '23514', message = 'INVALID_PHONE';
 end if;
 perform pg_advisory_xact_lock(hashtextextended(lower(new.contact),0));
 if (select count(*) from public.outing_reservations r
  where lower(r.contact)=lower(new.contact) and r.created_at > now()-interval '1 hour') >= 3
  or (select count(*) from public.outing_reservations r
  where lower(r.contact)=lower(new.contact) and r.created_at > now()-interval '1 day') >= 10 then
  raise exception using errcode = 'P0001', message = 'RATE_LIMITED';
 end if;
 return new;
end;
$$;
revoke all on function private.guard_reservation() from public,anon,authenticated;
create trigger guard_reservation before insert or update on public.outing_reservations
 for each row execute function private.guard_reservation();
alter table public.site_admins enable row level security;
alter table public.outing_reservations enable row level security;
revoke all on public.site_admins from public,anon,authenticated;
revoke all on public.outing_reservations from public,anon,authenticated;
grant usage on schema public to anon,authenticated;
grant select on public.site_admins to authenticated;
grant select on public.outing_reservations to authenticated;
grant update(status) on public.outing_reservations to authenticated;
grant insert(request_id,nickname,contact_method,contact,destination,outing_date,time_slot,
 guest_count,mood,message,consent,website,plan_id,plan_title,budget_preference,transport,company_preference,invitation_response,selected_plans) on public.outing_reservations to anon;
create policy read_my_admin_row on public.site_admins for select to authenticated
 using (user_id=(select auth.uid()));
create policy visitors_may_submit_only on public.outing_reservations for insert to anon
 with check (status='pending');
create policy admins_may_read on public.outing_reservations for select to authenticated
 using ((select auth.uid()) in (select user_id from public.site_admins));
create policy admins_may_update_status on public.outing_reservations for update to authenticated
 using ((select auth.uid()) in (select user_id from public.site_admins))
 with check ((select auth.uid()) in (select user_id from public.site_admins));
-- Project owner grants membership AFTER verifying administrator identity:
-- insert into public.site_admins(user_id)
-- select id from auth.users where lower(email)=lower('YOUR_ADMIN_EMAIL')
--  and email_confirmed_at is not null on conflict do nothing;
