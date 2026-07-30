-- 059 · Mensagens do LinkedIn do próprio André
--
-- ── Por que estas entram, e as de terceiros não ──────────────────────────────────────────────
-- Ele é participante da conversa. Uma mensagem dirigida a ele é dado dele tanto quanto o e-mail
-- que a inbox já ingere (`rel_mensagens`). O que continua fora é conversa de que ele não
-- participa — isso exigiria credencial de conta alheia, e não é risco calibrável, é o limite.
--
-- ── A conversa tem duas pontas ────────────────────────────────────────────────────────────────
-- Guardar a mensagem significa tratar o dado de QUEM ESCREVEU. Legítimo — a pessoa dirigiu a
-- comunicação a ele —, mas com a mesma cobertura do resto: entra na exclusão do titular (alcançada
-- também pelo SLUG, porque a mensagem pode ter chegado antes de a pessoa existir na base), conta
-- como sinal, e está no LIA.
--
-- ── A via recomendada não tem risco ───────────────────────────────────────────────────────────
-- `fonte = 'exportacao'` é o `messages.csv` que o próprio LinkedIn entrega em Configurações →
-- Privacidade de dados. Sem raspagem, sem cookie, sem conta em risco. A via `apify` existe, mas
-- carrega o risco que a raspagem carrega.

create table if not exists linkedin_mensagens (
  id uuid primary key default gen_random_uuid(),
  conversa_ref text,
  direcao text not null,
  perfil_url text,
  perfil_slug text,
  nome text,
  assunto text,
  corpo text,
  tema_ia boolean not null default false,
  enviada_em timestamptz,
  prospect_id uuid references prospects(id) on delete set null,
  contact_id uuid references contacts(id) on delete set null,
  fonte text not null default 'exportacao',
  created_at timestamptz not null default now(),
  constraint lm_direcao_check check (direcao in ('recebida','enviada')),
  constraint lm_fonte_check check (fonte in ('exportacao','apify','manual'))
);

-- Reimportar a exportação é o caso NORMAL: ela vem inteira toda vez, e o André vai trazer de novo
-- daqui a três meses. Sem esta chave, a segunda importação duplicaria a caixa toda.
create unique index if not exists uq_lm_msg
  on linkedin_mensagens (perfil_slug, direcao, enviada_em, md5(coalesce(corpo, '')))
  where perfil_slug is not null and enviada_em is not null;
create index if not exists idx_lm_slug on linkedin_mensagens (perfil_slug);
create index if not exists idx_lm_prospect on linkedin_mensagens (prospect_id);
create index if not exists idx_lm_ia on linkedin_mensagens (tema_ia, enviada_em desc) where tema_ia;

alter table linkedin_mensagens enable row level security;
drop policy if exists linkedin_mensagens_select on linkedin_mensagens;
drop policy if exists linkedin_mensagens_ins on linkedin_mensagens;
drop policy if exists linkedin_mensagens_upd on linkedin_mensagens;
drop policy if exists linkedin_mensagens_del on linkedin_mensagens;
create policy linkedin_mensagens_select on linkedin_mensagens for select using (is_salestrack_admin());
create policy linkedin_mensagens_ins on linkedin_mensagens for insert with check (is_salestrack_admin());
create policy linkedin_mensagens_upd on linkedin_mensagens for update using (is_salestrack_admin()) with check (is_salestrack_admin());
create policy linkedin_mensagens_del on linkedin_mensagens for delete using (is_salestrack_admin());

alter table engagement_events drop constraint if exists ee_tipo_check;
alter table engagement_events add constraint ee_tipo_check check (tipo in (
  'email_aberto','link_clicado','agenda_aberta','proposta_vista','proposta_secao',
  'proposta_aprovada','respondeu','reuniao_marcada','entregavel_visto','site_visitou',
  'whatsapp_respondeu','descadastrou',
  'curtiu_post_ia','comentou_post_ia','compartilhou_post_ia','publica_sobre_ia',
  'empresa_contrata_ia','empresa_usa_ia',
  'mensagem_recebida','mensagem_sobre_ia'
));

alter table coleta_externa_execucoes drop constraint if exists cee_escopo_check;
alter table coleta_externa_execucoes add constraint cee_escopo_check check (escopo in (
  'atividade_perfil','reacoes_post','posts_proprios','grupos','mensagens'
));
