-- AI OS · Migration 003 · Split de marcas na oportunidade + Tarefas (Fase 1.6)

-- Multi-marca: alocação de valores por marca no deal. [{ "brand": "andre_kachan", "value": 5000 }, ...]
alter table deals add column if not exists brand_split jsonb not null default '[]';

-- Tarefas (vinculadas a deal e/ou conta)
create table if not exists tasks (
  id uuid primary key default gen_random_uuid(),
  org_id uuid references organizations(id) on delete cascade,
  deal_id uuid references deals(id) on delete cascade,
  title text not null,
  done boolean not null default false,
  due_date date,
  created_by uuid,
  created_at timestamptz not null default now(),
  completed_at timestamptz
);
alter table tasks enable row level security;
create policy admin_all_tasks on tasks
  for all to authenticated using (is_salestrack_admin()) with check (is_salestrack_admin());
create policy tenant_read_tasks on tasks
  for select to authenticated using (org_id in (select user_org_ids()));
create index if not exists idx_tasks_deal on tasks(deal_id);
create index if not exists idx_tasks_open on tasks(done, due_date);
