-- 067 · Inscrição na newsletter, com dupla confirmação
--
-- ── Por que dupla confirmação ────────────────────────────────────────────────────────────────
-- Um formulário aberto na internet aceita qualquer endereço digitado por qualquer pessoa. Sem a
-- confirmação, três coisas ruins acontecem ao mesmo tempo: dá para inscrever o e-mail dos outros,
-- erro de digitação vira endereço morto que gera bounce (e bounce derruba a reputação do domínio),
-- e o "consentimento" registrado não prova nada — porque não houve prova de que quem digitou era o
-- dono da caixa.
--
-- O clique no link de confirmação resolve os três de uma vez, e é ele — não o envio do formulário —
-- que faz o consentimento existir. Antes disso a inscrição é só uma intenção guardada.
--
-- ── Por que tabela própria, e não `site_leads` ───────────────────────────────────────────────
-- Lead é quem pediu contato; inscrito é quem quer receber conteúdo. São intenções diferentes, com
-- bases legais diferentes (diligência pré-contratual vs consentimento), e responder a um lead não
-- autoriza mandar newsletter para ele. Guardar os dois na mesma tabela faria a distinção depender
-- de quem escreve a query.

create table if not exists newsletter_inscricoes (
  id uuid primary key default gen_random_uuid(),
  email text not null,
  nome text,
  empresa text,
  origem text not null default 'inscricao_publica',
  texto_aceite text,
  ip text,
  user_agent text,
  token text not null default encode(gen_random_bytes(24), 'hex'),
  confirmado_em timestamptz,
  expira_em timestamptz not null default (now() + interval '7 days'),
  cancelado_em timestamptz,
  created_at timestamptz not null default now()
);

create unique index if not exists uq_newsletter_email on newsletter_inscricoes (lower(email));
create index if not exists idx_newsletter_token on newsletter_inscricoes (token);
create index if not exists idx_newsletter_pendentes on newsletter_inscricoes (created_at desc)
  where confirmado_em is null and cancelado_em is null;

alter table newsletter_inscricoes enable row level security;

/*
 * INSERT anônimo é intencional: o formulário é público e não há sessão.
 *
 * O que impede abuso não é a policy e sim (a) o limite de taxa na Server Action, (b) a confirmação
 * por e-mail, sem a qual a linha não vira consentimento, e (c) a ausência de policy de SELECT — quem
 * insere não consegue ler de volta, então a tabela não serve para descobrir quem é assinante.
 */
drop policy if exists newsletter_ins_anon on newsletter_inscricoes;
create policy newsletter_ins_anon on newsletter_inscricoes for insert to anon with check (true);

drop policy if exists newsletter_sel_admin on newsletter_inscricoes;
create policy newsletter_sel_admin on newsletter_inscricoes for select to authenticated using (is_salestrack_admin());
drop policy if exists newsletter_upd_admin on newsletter_inscricoes;
create policy newsletter_upd_admin on newsletter_inscricoes for update to authenticated using (is_salestrack_admin()) with check (is_salestrack_admin());
drop policy if exists newsletter_del_admin on newsletter_inscricoes;
create policy newsletter_del_admin on newsletter_inscricoes for delete to authenticated using (is_salestrack_admin());

comment on table newsletter_inscricoes is
  'Inscrições na newsletter. O consentimento de marketing só é registrado em consent_records DEPOIS do clique de confirmação — antes disso a linha é apenas uma intenção.';
