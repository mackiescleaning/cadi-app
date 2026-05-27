-- Track Front Desk monthly action usage for free tier gating (10/month shared across all agents).

create table if not exists front_desk_monthly_usage (
  business_id  uuid    primary key references businesses(id) on delete cascade,
  month        date    not null default date_trunc('month', current_date)::date,
  action_count integer not null default 0
);

alter table front_desk_monthly_usage enable row level security;

create policy "owner can read own fd usage"
  on front_desk_monthly_usage for select
  using (
    business_id in (
      select id from businesses where owner_user_id = auth.uid()
    )
  );
