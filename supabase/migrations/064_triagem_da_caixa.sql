-- 064 · Triagem da caixa de entrada
--
-- A caixa tem 209 conversas abertas e, olhando os remetentes, a maioria é máquina: Google, Vercel,
-- Supabase, Docusign, newsletters, relatórios DMARC. Uma inbox onde tudo parece igual é uma inbox
-- que ninguém abre — e foi o que aconteceu.
--
-- A triagem responde UMA pergunta por conversa: isto espera resposta de uma pessoa? A resposta fica
-- gravada na própria conversa, com o motivo em português, porque classificação sem motivo é palpite
-- que ninguém consegue conferir nem corrigir.

alter table rel_conversas add column if not exists triagem text;
alter table rel_conversas add column if not exists triagem_motivo text;
alter table rel_conversas add column if not exists triagem_em timestamptz;

do $$ begin
  if not exists (select 1 from pg_constraint where conname = 'rel_conversas_triagem_check') then
    alter table rel_conversas add constraint rel_conversas_triagem_check
      check (triagem is null or triagem in ('precisa_resposta','informativo','promocional','automatico'));
  end if;
end $$;

-- O filtro "Precisam de você" é a consulta mais frequente da tela; o índice parcial serve só a ela.
create index if not exists idx_rel_conversas_precisa_resposta
  on rel_conversas (last_message_at desc)
  where triagem = 'precisa_resposta' and deleted_at is null;

-- Fila da triagem: o que ainda não foi olhado. Parcial de novo — o índice encolhe conforme a fila
-- é consumida, em vez de crescer com a caixa.
create index if not exists idx_rel_conversas_sem_triagem
  on rel_conversas (last_message_at desc)
  where triagem is null and deleted_at is null;

comment on column rel_conversas.triagem is
  'precisa_resposta | informativo | promocional | automatico. Nulo = ainda não triada.';
comment on column rel_conversas.triagem_motivo is
  'Por que caiu nessa categoria, em português. Existe para a pessoa poder discordar com base em algo.';
