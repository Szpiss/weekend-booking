-- Additive upgrade for an existing v1 database. Existing bookings are retained.
alter table public.outing_reservations
 add column if not exists plan_id text not null default 'custom' check (plan_id ~ '^[a-z][a-z0-9-]{0,39}$'),
 add column if not exists plan_title text not null default '自定义出游' check (char_length(btrim(plan_title)) between 1 and 80),
 add column if not exists budget_preference text not null default 'undecided' check (budget_preference in ('undecided','under100','100to200','over200')),
 add column if not exists transport text not null default 'discuss' check (transport in ('discuss','transit','carpool','self'));
grant insert(plan_id,plan_title,budget_preference,transport) on public.outing_reservations to anon;
-- SELECT and UPDATE(status) grants and all RLS policies remain unchanged.
-- Private invitations: dates may be discussed, without inventing an appointment date.
alter table public.outing_reservations
 add column if not exists company_preference text not null default 'discuss' check (company_preference in ('together','friends','discuss')),
 add column if not exists invitation_response text not null default 'interested' check (invitation_response in ('interested','discuss'));
alter table public.outing_reservations alter column outing_date drop not null;
alter table public.outing_reservations drop constraint outing_reservations_time_slot_check;
alter table public.outing_reservations add constraint outing_reservations_time_slot_check check (time_slot in ('morning','afternoon','evening','all_day','discuss'));
create unique index outing_reservations_same_trip_flexible_idx on public.outing_reservations
 (lower(contact),lower(destination),coalesce(outing_date,date '0001-01-01'),time_slot) where status <> 'cancelled';
drop index public.outing_reservations_same_trip_idx;
grant insert(company_preference,invitation_response) on public.outing_reservations to anon;
