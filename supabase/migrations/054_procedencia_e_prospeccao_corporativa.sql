-- 054 · Procedência do dado: o que se pode fazer com ele depende de quem o forneceu
--
-- Regra que este arquivo impõe:
--
--   dado que O TITULAR nos deu        → marketing possível, SE ele consentir
--   dado COLETADO de fonte pública    → prospecção sob legítimo interesse, marketing NUNCA
--
-- E "ser público não libera nada": o art. 7º, §3º diz expressamente que dado tornado público
-- não dispensa as demais bases legais nem os direitos do titular. A base aqui é legítimo
-- interesse (art. 7º, IX), que só se sustenta com teste de proporcionalidade escrito
-- (docs/LIA_PROSPECCAO.md), aviso no primeiro contato e oposição fácil.
--
-- Decisão do André, 2026-07-30: **somente dados corporativos**. Isso não é uma etiqueta
-- informativa — é guarda de entrada. Caixa de provedor gratuito e celular não entram por coleta,
-- em nenhum caminho de escrita.
--
-- O bloqueio de marketing é por PROCEDÊNCIA, não por ausência de consentimento. A diferença
-- importa: ausência de consentimento se resolve marcando uma caixa, e alguém marcaria. Um dado
-- que a pessoa nunca nos deu não vira lista de marketing nem com caixa marcada.

alter table lead_sources add column if not exists titular_forneceu boolean not null default true;

alter table contacts  add column if not exists procedencia text not null default 'titular';
alter table prospects add column if not exists procedencia text not null default 'coleta_publica';
alter table prospects add column if not exists dado_corporativo boolean not null default true;
alter table prospects add column if not exists coletado_em timestamptz not null default now();
alter table prospects add column if not exists aviso_em timestamptz;         -- 1º contato avisou de onde veio o dado
alter table prospects add column if not exists oposicao_em timestamptz;      -- exerceu o art. 18, §2º
-- Retenção: sinal que não virou oportunidade em 180 dias é descartado. Guardar dado de quem
-- nunca respondeu, indefinidamente, é o que derruba o balanceamento do legítimo interesse.
alter table prospects add column if not exists retencao_ate timestamptz not null default (now() + interval '180 days');

do $$ begin
  if not exists (select 1 from pg_constraint where conname = 'contacts_procedencia_check') then
    alter table contacts add constraint contacts_procedencia_check
      check (procedencia in ('titular','coleta_publica','terceiro'));
  end if;
  if not exists (select 1 from pg_constraint where conname = 'prospects_procedencia_check') then
    alter table prospects add constraint prospects_procedencia_check
      check (procedencia in ('titular','coleta_publica','terceiro'));
  end if;
end $$;

create index if not exists idx_prospects_retencao on prospects (retencao_ate)
  where deal_id is null and oposicao_em is null;
create index if not exists idx_prospects_email_proc on prospects (lower(email)) where email is not null;
create index if not exists idx_contacts_procedencia on contacts (procedencia);

insert into lead_sources (slug, nome, ativo, titular_forneceu) values
  ('linkedin-publico', 'LinkedIn — perfil público (coleta)', true, false),
  ('apollo',           'Apollo (base de terceiro)',          true, false)
on conflict (slug) do update set titular_forneceu = excluded.titular_forneceu, nome = excluded.nome;

update lead_sources set titular_forneceu = false where slug = 'prospeccao-ativa';

-- ── O que conta como corporativo ────────────────────────────────────────────────────────────
create or replace function fn_email_corporativo(p_email text)
returns boolean language sql immutable
set search_path = public, pg_temp
as $$
  select case
    when p_email is null or p_email = '' then false
    when split_part(lower(trim(p_email)), '@', 2) = any (array[
      'gmail.com','googlemail.com','hotmail.com','hotmail.com.br','outlook.com','outlook.com.br',
      'live.com','msn.com','yahoo.com','yahoo.com.br','ymail.com','icloud.com','me.com','mac.com',
      'aol.com','protonmail.com','proton.me','tutanota.com','gmx.com','zoho.com','mail.com',
      'bol.com.br','uol.com.br','terra.com.br','ig.com.br','globo.com','r7.com','oi.com.br',
      'yandex.com','qq.com','163.com','126.com'
    ]) then false
    else position('@' in p_email) > 1
  end;
$$;

-- Celular (11 dígitos) é linha pessoal na prática, e não existe jeito confiável de distinguir um
-- celular corporativo de um particular pelo número. Fixo é da empresa. Ausência não invalida —
-- muitos registros simplesmente não têm telefone, e isso não é problema.
create or replace function fn_telefone_corporativo(p_tel text)
returns boolean language sql immutable
set search_path = public, pg_temp
as $$
  select case
    when p_tel is null or p_tel = '' then true
    else length(regexp_replace(p_tel, '\D', '', 'g')) <= 10
  end;
$$;

-- ── Guarda de entrada ───────────────────────────────────────────────────────────────────────
-- No banco, e não só na aplicação: a importação pode entrar por tela, por Server Action ou por
-- PostgREST direto, e a regra tem que valer nos três.
create or replace function fn_prospect_guard_corporativo()
returns trigger language plpgsql
set search_path = public, pg_temp
as $$
begin
  if new.procedencia in ('coleta_publica','terceiro') then
    if new.email is not null and new.email <> '' and not fn_email_corporativo(new.email) then
      raise exception 'Prospecção só admite e-mail corporativo. "%" é caixa de provedor gratuito — dado pessoal não entra por coleta.', new.email
        using errcode = 'check_violation';
    end if;
    if not fn_telefone_corporativo(new.phone) then
      raise exception 'Prospecção só admite telefone corporativo. Celular é linha pessoal e não entra por coleta.'
        using errcode = 'check_violation';
    end if;
    new.dado_corporativo := true;
  end if;
  return new;
end $$;

drop trigger if exists trg_prospect_guard_corporativo on prospects;
create trigger trg_prospect_guard_corporativo
  before insert or update of email, phone, procedencia on prospects
  for each row execute function fn_prospect_guard_corporativo();

-- ── Bloqueio de marketing por procedência ───────────────────────────────────────────────────
create or replace function fn_pode_marketing(p_email text)
returns boolean language sql stable
set search_path = public, pg_temp
as $$
  select
    not exists (
      select 1 from prospects p
       where lower(p.email) = lower(trim(p_email))
         and p.procedencia in ('coleta_publica','terceiro')
    )
    and not exists (
      select 1 from contacts c
       where lower(c.email) = lower(trim(p_email))
         and c.procedencia in ('coleta_publica','terceiro')
         and c.deleted_at is null
    )
    and exists (
      select 1 from consent_records cr
       where lower(cr.email) = lower(trim(p_email))
         and cr.finalidade = 'marketing'
         and cr.estado = 'concedido'
    );
$$;

revoke execute on function fn_pode_marketing(text) from public;
revoke execute on function fn_pode_marketing(text) from anon, authenticated;
grant  execute on function fn_pode_marketing(text) to service_role;
