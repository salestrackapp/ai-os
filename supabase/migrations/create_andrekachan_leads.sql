create table if not exists public.andrekachan_leads (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default now(),
  name text not null,
  email text not null,
  whatsapp text,
  message text,
  source text
);

alter table public.andrekachan_leads enable row level security;

create policy "Allow anonymous insert" on public.andrekachan_leads
  for insert
  to anon
  with check (true);

create policy "Allow service role full access" on public.andrekachan_leads
  for all
  to service_role
  using (true)
  with check (true);
