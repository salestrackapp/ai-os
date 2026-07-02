-- AI OS · Migration 002 · Admin Avançado (Fase 1.5)

-- CRM: rastreio de estagnação e sinais estruturados
alter table deals add column if not exists last_activity_at timestamptz default now();
alter table deals add column if not exists next_step text;
alter table deals add column if not exists expected_close date;

-- Catálogo: frentes (consumidas pelo gerador de propostas na F2) e notas internas
alter table catalog_items add column if not exists frentes text[] default '{}';
alter table catalog_items add column if not exists internal_notes text;

-- Protocolo de sinais (pesos oficiais do método — editáveis pelo admin)
create table if not exists signal_definitions (
  id uuid primary key default gen_random_uuid(),
  label text not null,           -- ex: "Contratou head de vendas", "Levantou investimento"
  weight int not null default 5,
  active boolean not null default true,
  sort int not null default 0
);
alter table signal_definitions enable row level security;
create policy admin_all_signal_definitions on signal_definitions
  for all to authenticated using (is_salestrack_admin()) with check (is_salestrack_admin());

-- Seeds iniciais do protocolo (André calibra depois na tela)
insert into signal_definitions (label, weight, sort) values
 ('Contratou liderança comercial/tecnologia recentemente', 8, 1),
 ('Anunciou expansão, nova unidade ou novo mercado', 7, 2),
 ('Levantou investimento / M&A recente', 8, 3),
 ('Publicou vaga ou conteúdo mencionando IA', 6, 4),
 ('Stack de IA detectado (usa ChatGPT/Copilot sem governança)', 6, 5),
 ('Dor operacional explícita em conversa/diagnóstico', 9, 6),
 ('Indicação/relacionamento quente', 10, 7),
 ('Setor prioritário (saúde, serviços, indústria criativa)', 4, 8);

-- Atualiza last_activity_at automaticamente quando entra activity do deal
create or replace function fn_touch_deal_activity() returns trigger
language plpgsql security definer as $$
begin
  if new.ref_table = 'deals' and new.ref_id is not null then
    update deals set last_activity_at = now() where id = new.ref_id;
  end if;
  return new;
end $$;
drop trigger if exists trg_touch_deal on activities;
create trigger trg_touch_deal after insert on activities
  for each row execute function fn_touch_deal_activity();
