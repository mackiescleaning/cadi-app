-- Payroll-specific fields for HMRC RTI FPS submission
alter table team_members
  add column if not exists ni_number           text,
  add column if not exists date_of_birth       date,
  add column if not exists gender              text check (gender in ('M','F','U')),
  add column if not exists address_line1       text,
  add column if not exists address_line2       text,
  add column if not exists address_line3       text,
  add column if not exists address_line4       text,
  add column if not exists address_postcode    text,
  add column if not exists tax_code            text not null default '1257L',
  add column if not exists ni_category         text not null default 'A',
  add column if not exists payroll_id          text,   -- employer's internal payroll reference
  add column if not exists starter_declaration text check (starter_declaration in ('A','B','C')),
  add column if not exists is_director         boolean not null default false;
