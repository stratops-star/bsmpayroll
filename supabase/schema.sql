create table if not exists exports (
  id uuid default gen_random_uuid() primary key,
  filename text not null,
  period_start date not null,
  period_end date not null,
  exported_by text not null,
  exported_at timestamptz default now(),
  total_entries int default 0,
  total_hours numeric(8,2) default 0,
  tiers text[] default '{}'
);

create table if not exists export_rows (
  id uuid default gen_random_uuid() primary key,
  export_id uuid references exports(id) on delete cascade,
  tier text not null,
  employee_number text,
  porter_name text,
  date_worked date,
  hours numeric(6,2),
  pay_code text,
  rate text,
  property text,
  property_address text,
  manager text,
  asana_link text,
  asana_id text,
  period_begin date,
  period_end date,
  entry_type text,
  source_id text
);

create table if not exists closed_entries (
  id uuid default gen_random_uuid() primary key,
  source_id text not null,
  tier text not null,
  employee_number text,
  porter_name text,
  date_worked date,
  hours numeric(6,2),
  property_address text,
  manager text,
  asana_link text,
  closed_by text,
  closed_at timestamptz default now(),
  reason text,
  period_start date,
  period_end date
);

alter table exports enable row level security;
alter table export_rows enable row level security;
alter table closed_entries enable row level security;

create policy "auth only" on exports for all using (auth.role() = 'authenticated');
create policy "auth only" on export_rows for all using (auth.role() = 'authenticated');
create policy "auth only" on closed_entries for all using (auth.role() = 'authenticated');
