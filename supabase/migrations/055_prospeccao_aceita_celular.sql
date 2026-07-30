-- 055 · Prospecção passa a aceitar celular
--
-- Decisão do André, 2026-07-30, revertendo a regra do telefone criada na 054 no mesmo dia.
--
-- O que muda no balanceamento do LIA: o critério de "dado corporativo" passa a ser decidido
-- exclusivamente pelo DOMÍNIO DO E-MAIL, que continua sendo a linha entre o papel profissional e
-- a vida privada. O telefone deixa de ser filtrado porque o número que a fonte licenciada (Apollo)
-- devolve vem do registro profissional da pessoa — é o telefone que ela usa para trabalhar, não um
-- número da vida dela que descobrimos por fora.
--
-- A função continua existindo, sempre verdadeira, em vez de ser removida: o gatilho e o
-- TypeScript a chamam, e reintroduzir um filtro depois é mudar uma linha aqui em vez de reescrever
-- a guarda inteira.

create or replace function fn_telefone_corporativo(p_tel text)
returns boolean language sql immutable
set search_path = public, pg_temp
as $$
  select true;
$$;

comment on function fn_telefone_corporativo(text) is
  'Aceita qualquer telefone desde 2026-07-30. O critério de dado corporativo é o domínio do e-mail (fn_email_corporativo). Ponto único para reintroduzir filtro de telefone, se algum dia for preciso.';
