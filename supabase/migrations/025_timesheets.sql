-- GPS clock-in timesheets
-- Staff insert/update via the staff-timesheet edge function (service role, no RLS needed).
-- Manager reads via authenticated supabase client (business_id = auth.uid()).

create table timesheets (
  id                    uuid        primary key default gen_random_uuid(),
  business_id           uuid        not null,
  staff_id              uuid        not null references team_members(id) on delete cascade,
  job_id                uuid        references jobs(id) on delete set null,
  date                  date        not null,
  clock_in_at           timestamptz,
  clock_out_at          timestamptz,
  clock_in_lat          numeric(9,6),
  clock_in_lng          numeric(9,6),
  clock_out_lat         numeric(9,6),
  clock_out_lng         numeric(9,6),
  clock_in_accuracy_m   integer,
  clock_out_accuracy_m  integer,
  site_distance_m       integer,    -- metres from job postcode at clock-in
  status                text        not null default 'expected'
                          check (status in ('expected','clocked_in','clocked_out','flagged')),
  created_at            timestamptz default now(),
  updated_at            timestamptz default now()
);

alter table timesheets enable row level security;

-- Owner full access via their authenticated session
create policy "owner_all" on timesheets
  for all
  using  (business_id = auth.uid())
  with check (business_id = auth.uid());

-- Live manager dashboard
alter publication supabase_realtime add table timesheets;
