-- E2 · Templates/snippets + regras (rotulam/roteiam, nunca enviam). RLS de equipe.
create table if not exists rel_templates (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references organizations(id) on delete cascade,
  nome text not null,
  assunto text,
  corpo text not null,
  atalho text,               -- ex.: /agenda
  ativo boolean not null default true,
  created_by uuid,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz
);
create index if not exists ix_rel_templates_org on rel_templates(org_id) where deleted_at is null;

create table if not exists rel_regras (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references organizations(id) on delete cascade,
  nome text not null,
  -- gatilho: remetente/assunto contém
  match_campo text not null default 'remetente' check (match_campo in ('remetente','assunto')),
  match_valor text not null,
  -- ações (rascunham; nunca enviam): rotular e/ou atribuir
  acao_rotulo text,
  acao_assign_to uuid,
  ativo boolean not null default true,
  created_by uuid,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz
);
create index if not exists ix_rel_regras_org on rel_regras(org_id) where deleted_at is null and ativo;

alter table rel_templates enable row level security;
alter table rel_regras enable row level security;

drop policy if exists rel_templates_team on rel_templates;
create policy rel_templates_team on rel_templates for all using (is_salestrack_admin()) with check (is_salestrack_admin());
drop policy if exists rel_regras_team on rel_regras;
create policy rel_regras_team on rel_regras for all using (is_salestrack_admin()) with check (is_salestrack_admin());

-- Seeds de templates fundadores (org Salestrack). Idempotente por (org_id, nome).
insert into rel_templates (org_id, nome, assunto, corpo, atalho)
select '00deba77-46fa-4d9f-9dd4-dc8aabfa1d34'::uuid, v.nome, v.assunto, v.corpo, v.atalho
from (values
  ('Recebido — retorno em breve', 'Re: {{assunto}}', E'Olá {{nome}},\n\nRecebi sua mensagem e retorno com o encaminhamento ainda hoje.\n\nAbraço,\nSalestrack AI', '/recebi'),
  ('Agendar conversa', 'Vamos conversar?', E'Olá {{nome}},\n\nPara avançarmos, que tal uma conversa rápida? Me diga dois horários que funcionam para você que eu confirmo na sequência.\n\nAbraço,\nSalestrack AI', '/agenda'),
  ('Enviar proposta', 'Sua proposta Salestrack', E'Olá {{nome}},\n\nSegue a proposta conforme conversamos. Qualquer ajuste, estou à disposição para adequar ao seu contexto.\n\nAbraço,\nSalestrack AI', '/proposta')
) as v(nome, assunto, corpo, atalho)
where not exists (select 1 from rel_templates t where t.org_id = '00deba77-46fa-4d9f-9dd4-dc8aabfa1d34'::uuid and t.nome = v.nome);
