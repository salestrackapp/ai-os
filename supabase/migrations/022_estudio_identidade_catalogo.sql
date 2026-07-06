-- R3.2 · Identidade leve do programa (dentro do design v2) + fronteira Estúdio×Comunicação (R4).
-- Aditivo/reversível: nenhum DROP.

-- 1) Identidade do programa — personalização LEVE, nunca um segundo design.
create table if not exists programa_identidade (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references organizations(id),
  program_id uuid references projects(id),
  client_logo text,                 -- ref no storage (logo do cliente/programa)
  program_name text,
  cover_title text,
  cover_subtitle text,
  accent text,                      -- restrito à paleta v2 (CHECK abaixo)
  brand_attribution text not null default 'salestrack',  -- só atribuição/assinatura
  status text not null default 'rascunho',
  version int not null default 1,
  approved_by uuid,
  approved_at timestamptz,
  active boolean not null default false,
  created_by uuid,
  deleted_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint pi_attr_check check (brand_attribution in ('salestrack','andre_kachan')),
  constraint pi_status_check check (status in ('rascunho','em_revisao','aprovado')),
  -- Acento SEMPRE dentro da paleta Salestrack AI v2 (violeta/lime/ink/grafite) — nada redefine o DS.
  constraint pi_accent_v2 check (accent is null or upper(accent) in ('#4F1FFF','#8B5CFF','#3A16C0','#EBF212','#0B0B16','#2A2A3C'))
);
create index if not exists idx_pi_org on programa_identidade (org_id);
create index if not exists idx_pi_alive on programa_identidade (deleted_at) where deleted_at is null;
-- Uma identidade ATIVA por programa.
create unique index if not exists uq_pi_active_program on programa_identidade (program_id) where active and deleted_at is null;

alter table programa_identidade enable row level security;
drop policy if exists pi_read on programa_identidade;
create policy pi_read on programa_identidade for select using (is_salestrack_admin() or org_id = any(user_org_ids()));
drop policy if exists pi_write on programa_identidade;
create policy pi_write on programa_identidade for all using (is_salestrack_admin()) with check (is_salestrack_admin());

-- Imutabilidade após aprovação (conteúdo travado; só ativar/versão muda).
create or replace function fn_lock_approved_identidade()
returns trigger language plpgsql as $$
begin
  if old.status = 'aprovado' then
    if new.cover_title is distinct from old.cover_title or new.cover_subtitle is distinct from old.cover_subtitle
       or new.program_name is distinct from old.program_name or new.accent is distinct from old.accent
       or new.brand_attribution is distinct from old.brand_attribution or new.client_logo is distinct from old.client_logo then
      raise exception 'Identidade aprovada é imutável: crie nova versão para alterar (só ativar/desativar é permitido).';
    end if;
  end if;
  new.updated_at := now();
  return new;
end $$;
drop trigger if exists trg_lock_approved_identidade on programa_identidade;
create trigger trg_lock_approved_identidade before update on programa_identidade
  for each row execute function fn_lock_approved_identidade();

-- 2) Fronteira Estúdio×Comunicação (R4): ativo aprovado/publicado pode ficar ELEGÍVEL para orquestração.
alter table studio_deliverables add column if not exists comm_eligible boolean not null default false;
alter table studio_deliverables add column if not exists comm_channel text;  -- whatsapp|email|post|generic (famílias de mensagens)
create index if not exists idx_studio_comm_eligible on studio_deliverables (comm_eligible) where comm_eligible;
