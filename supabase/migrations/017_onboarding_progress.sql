-- R1.4 · Navegação guiada — progresso de condução por usuário (não bloqueante).
-- Guarda passos concluídos dos "Primeiros passos" e dispensas de peças de guia
-- (ex.: key 'dismissed:primeiros-passos'). Cada usuário só vê/edita o próprio, na sua org.

create table if not exists onboarding_progress (
  id         uuid primary key default gen_random_uuid(),
  org_id     uuid not null references organizations(id) on delete cascade,
  user_id    uuid not null,
  surface    text not null check (surface in ('admin', 'portal')),
  key        text not null,
  done_at    timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (user_id, surface, key)
);
create index if not exists idx_onb_progress_user on onboarding_progress(user_id, surface);

alter table onboarding_progress enable row level security;

-- Cada usuário só lê/escreve o PRÓPRIO progresso, dentro de uma org da qual participa.
drop policy if exists op_own on onboarding_progress;
create policy op_own on onboarding_progress for all to authenticated
  using (user_id = auth.uid())
  with check (user_id = auth.uid() and org_id in (select user_org_ids()));
