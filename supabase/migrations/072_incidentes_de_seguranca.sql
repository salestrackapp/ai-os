-- 072 · Registro de incidentes de segurança
--
-- ── Por que uma tabela, e não só um runbook ──────────────────────────────────────────────────
-- O runbook diz o que fazer; ele não prova que foi feito. A LGPD manda comunicar à ANPD e ao
-- titular em prazo razoável (art. 48) e, quando alguém perguntar depois, a pergunta não vai ser
-- "vocês tinham um procedimento?" e sim "quando vocês souberam, e quando comunicaram?". Isso é uma
-- data, e data mora em tabela.
--
-- ── O relógio começa em "soubemos", não em "aconteceu" ───────────────────────────────────────
-- `detectado_em` é o marco que conta, e é separado de `ocorrido_em` de propósito: um incidente
-- pode ter começado semanas antes de alguém perceber, e o prazo de comunicação corre da ciência.
-- Guardar só uma data faria os dois se confundirem na hora exata em que a diferença importa.
--
-- ── Nem todo incidente vira notificação ──────────────────────────────────────────────────────
-- A lei pede comunicação quando há risco relevante ao titular. Um log com IP exposto por engano
-- não é o mesmo que uma base de contatos vazada. Por isso a decisão de notificar é um campo
-- próprio, com a justificativa ao lado: decidir NÃO notificar é uma decisão que também precisa
-- estar registrada e fundamentada — é ela que será questionada, não a outra.

create table if not exists incidentes_seguranca (
  id uuid primary key default gen_random_uuid(),
  titulo text not null,
  descricao text not null,

  severidade text not null default 'media',
  status text not null default 'aberto',

  ocorrido_em timestamptz,                  -- quando começou, se dá para saber
  detectado_em timestamptz not null default now(),   -- quando soubemos — é daqui que corre o prazo
  contido_em timestamptz,
  encerrado_em timestamptz,

  dados_afetados text,                      -- que categorias, e de quantas pessoas
  titulares_afetados integer,
  causa text,
  acoes text,                               -- o que foi feito para conter e corrigir

  -- Decisão de comunicar, com a razão. Ver o cabeçalho: o "não" precisa ser tão registrado quanto o "sim".
  risco_relevante boolean,
  justificativa_risco text,
  anpd_notificada_em timestamptz,
  titulares_notificados_em timestamptz,

  responsavel uuid references auth.users(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),

  constraint incidentes_severidade_check check (severidade in ('baixa','media','alta','critica')),
  constraint incidentes_status_check check (status in ('aberto','em_analise','contido','encerrado'))
);

create index if not exists idx_incidentes_abertos on incidentes_seguranca (detectado_em desc)
  where status <> 'encerrado';
-- Incidente com risco relevante e sem comunicação à ANPD é o que a varredura procura todo dia.
create index if not exists idx_incidentes_a_notificar on incidentes_seguranca (detectado_em)
  where risco_relevante and anpd_notificada_em is null;

alter table incidentes_seguranca enable row level security;

-- Fechado a admin em todas as operações. Nem `anon` nem cliente têm o que fazer aqui — a lista de
-- incidentes de uma empresa é, ela própria, informação sensível.
drop policy if exists incidentes_sel on incidentes_seguranca;
create policy incidentes_sel on incidentes_seguranca for select to authenticated using (is_salestrack_admin());
drop policy if exists incidentes_ins on incidentes_seguranca;
create policy incidentes_ins on incidentes_seguranca for insert to authenticated with check (is_salestrack_admin());
drop policy if exists incidentes_upd on incidentes_seguranca;
create policy incidentes_upd on incidentes_seguranca for update to authenticated using (is_salestrack_admin()) with check (is_salestrack_admin());

-- Sem policy de DELETE, deliberadamente. O registro de incidente segue a mesma lógica de
-- `audit_logs`: um histórico que pode ser apagado por quem foi responsável não prova nada. Errou
-- ao abrir? Encerre com a explicação — não apague.

comment on table incidentes_seguranca is
  'Incidentes de segurança com dado pessoal. O prazo do art. 48 corre de detectado_em; a decisão de NÃO notificar também fica registrada, com justificativa.';
