-- R3.1 · Núcleo do Estúdio — eleva a Fase B (studio_deliverables) para o motor de linhas de produção.
-- Aditivo e reversível: nenhum DROP; colunas novas + estado estendido + imutabilidade generalizada.

-- 1) Colunas do motor: qual LINHA produziu, sob qual MARCA, aprovação e ligação cliente/programa/marco.
alter table studio_deliverables add column if not exists line text;                    -- chave da linha (define-line); null = legado Fase B
alter table studio_deliverables add column if not exists brand text not null default 'salestrack'; -- 'salestrack' | 'andre_kachan'
alter table studio_deliverables add column if not exists approved_by uuid;
alter table studio_deliverables add column if not exists approved_at timestamptz;
alter table studio_deliverables add column if not exists project_id uuid references projects(id);   -- programa
alter table studio_deliverables add column if not exists phase_index int;               -- marco na timeline do programa
alter table studio_deliverables add column if not exists parent_id uuid references studio_deliverables(id); -- versão anterior (newVersion)
alter table studio_deliverables add column if not exists deleted_at timestamptz;        -- soft-delete (padrão R2.1)

create index if not exists idx_studio_deliverables_alive on studio_deliverables (deleted_at) where deleted_at is null;
create index if not exists idx_studio_deliverables_line on studio_deliverables (line);
create index if not exists idx_studio_deliverables_project on studio_deliverables (project_id);

-- 2) Vocabulário de estado estendido: + 'gerando' (IA rascunhando) e + 'publicado' (entregue pela linha).
--    Mantém em_revisao/entregue da Fase B (retrocompat). revisao(R3.1) ≡ em_revisao.
alter table studio_deliverables drop constraint if exists studio_deliverables_status_check;
alter table studio_deliverables add constraint studio_deliverables_status_check
  check (status in ('rascunho','gerando','em_revisao','aprovado','entregue','publicado'));

-- 3) Marca (brand) restrita.
alter table studio_deliverables drop constraint if exists studio_deliverables_brand_check;
alter table studio_deliverables add constraint studio_deliverables_brand_check
  check (brand in ('salestrack','andre_kachan','tenant'));

-- 4) Imutabilidade pós-aprovação GENERALIZADA (antes: só 'proposta').
--    Aprovado/Publicado/Entregue ⇒ conteúdo e título TRAVADOS; só renderização/layout muda.
create or replace function fn_lock_approved_deliverable()
returns trigger language plpgsql as $$
begin
  if old.status in ('aprovado','publicado','entregue') then
    if new.content is distinct from old.content or new.title is distinct from old.title then
      raise exception 'Entregável aprovado é imutável: crie uma nova versão para alterar o conteúdo (só renderização/layout pode mudar).';
    end if;
  end if;
  new.updated_at := now();
  return new;
end $$;
-- trigger trg_lock_approved_deliverable já existe e aponta para esta função (recriada acima).
