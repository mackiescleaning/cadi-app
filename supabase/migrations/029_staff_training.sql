-- Training & certification records per staff member
-- cert_type: key from the CERT_TYPES list in the frontend
-- expiry_date: nullable (some certs don't expire)

create table staff_training (
  id            uuid    primary key default gen_random_uuid(),
  business_id   uuid    not null,
  staff_id      uuid    not null references team_members(id) on delete cascade,
  cert_type     text    not null,
  cert_label    text    not null,           -- human-readable label stored for portability
  obtained_date date    not null,
  expiry_date   date,                       -- null = no expiry
  notes         text,
  created_at    timestamptz default now(),
  updated_at    timestamptz default now()
);

alter table staff_training enable row level security;
create policy "owner_all" on staff_training
  for all using  (business_id = auth.uid())
  with check     (business_id = auth.uid());

create index staff_training_business_staff on staff_training (business_id, staff_id);
create index staff_training_expiry         on staff_training (business_id, expiry_date);
