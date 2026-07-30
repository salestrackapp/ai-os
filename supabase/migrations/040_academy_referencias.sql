-- 040 · Academy · Bloco 4: biblioteca de referências (87 registros vindos da academy antiga)
-- Aditivo e reversível: nenhum DROP.
--
-- São quatro famílias de referência — prompts prontos, ferramentas, glossário e checklist de
-- segurança — que na origem eram quatro arrays JavaScript. Aqui viram UMA tabela com COLUNAS
-- REAIS, não um campo jsonb.
--
-- A escolha de colunas é deliberada: com jsonb, a tela de edição do André viraria um editor de
-- JSON, e a regra do produto é que ninguém precise ver JSON para usar o sistema. Com colunas,
-- o CRUD kit gera um formulário normal, com rótulo em português por campo.
--
-- Os campos são esparsos por natureza (um termo de glossário não tem "parâmetros"), e isso é
-- honesto: são quatro variantes de material de referência, não quatro entidades distintas.

create table if not exists academy_referencias (
  id uuid primary key default gen_random_uuid(),
  tipo text not null
    constraint aref_tipo_check check (tipo in ('prompt','ferramenta','termo','checklist')),
  chave text,                    -- id de origem (v1, crm1, c1) — rastreabilidade com a fonte
  ordem int not null default 0,

  -- comuns às quatro famílias
  nome text not null,            -- nome do prompt / da ferramenta / o termo / o item do checklist
  categoria text,                -- área de negócio, categoria da ferramenta ou do termo
  icone text,
  cor text,
  conteudo text,                 -- prompt completo | descrição | definição | detalhe do item

  -- prompt
  impacto text,                  -- ganho esperado, em linguagem de negócio
  ferramentas text,              -- ferramentas que o prompt pressupõe

  -- ferramenta
  sistema text,                  -- sistema de origem (HubSpot, ERP...)
  parametros text,
  retorno text,

  -- termo de glossário
  termo_en text,
  exemplo text,

  -- checklist
  risco text
    constraint aref_risco_check check (risco is null or risco in ('alto','medio','baixo')),

  publicado boolean not null default true,
  created_by uuid,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz
);
create index if not exists ix_aref_tipo on academy_referencias(tipo) where deleted_at is null;
create index if not exists ix_aref_alive on academy_referencias(deleted_at) where deleted_at is null;
create unique index if not exists ux_aref_chave on academy_referencias(tipo, chave) where chave is not null and deleted_at is null;

-- RLS: leitura para qualquer autenticado (é material de apoio, não dado de cliente);
-- escrita só do admin Salestrack. Rascunho (publicado=false) fica visível só para o admin.
alter table academy_referencias enable row level security;

drop policy if exists academy_referencias_select on academy_referencias;
create policy academy_referencias_select on academy_referencias for select to authenticated
  using (is_salestrack_admin() or (publicado and deleted_at is null));
drop policy if exists academy_referencias_ins on academy_referencias;
create policy academy_referencias_ins on academy_referencias for insert to authenticated
  with check (is_salestrack_admin());
drop policy if exists academy_referencias_upd on academy_referencias;
create policy academy_referencias_upd on academy_referencias for update to authenticated
  using (is_salestrack_admin()) with check (is_salestrack_admin());
drop policy if exists academy_referencias_del on academy_referencias;
create policy academy_referencias_del on academy_referencias for delete to authenticated
  using (is_salestrack_admin());
