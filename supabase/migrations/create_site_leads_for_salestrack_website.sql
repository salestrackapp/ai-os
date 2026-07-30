-- Salestrack AI website — lead capture (isolated table, standalone from ai-os multi-tenant schema)
create table if not exists public.site_leads (
  id          uuid primary key default gen_random_uuid(),
  name        text,
  email       text not null,
  source      text default 'site',
  message     text,
  created_at  timestamptz not null default now()
);

create index if not exists site_leads_created_at_idx on public.site_leads (created_at desc);
create index if not exists site_leads_email_idx on public.site_leads (email);

alter table public.site_leads enable row level security;

-- Public lead form: allow INSERT from the anon/publishable key.
-- No SELECT policy is created on purpose, so lead data is not publicly readable
-- (only the service_role key, which bypasses RLS, can read).
drop policy if exists site_leads_insert_public on public.site_leads;
create policy site_leads_insert_public on public.site_leads
  for insert to anon, authenticated
  with check (true);
