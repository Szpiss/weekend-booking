-- Existing-v2 upgrade: apply once, with release approval, BEFORE deploying the multi-select frontend.
-- Existing records use the empty-array default and retain their original plan_id / plan_title.
alter table public.outing_reservations
 add column if not exists selected_plans jsonb not null default '[]'::jsonb;
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
grant insert(selected_plans) on public.outing_reservations to anon;
-- No SELECT privilege is added for visitors. No UPDATE privilege is added for this column.
