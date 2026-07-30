-- E4 · templates ganham canal + flag HSM (aprovado p/ WhatsApp fora da janela 24h).
alter table rel_templates add column if not exists canal text not null default 'email';
alter table rel_templates add column if not exists hsm boolean not null default false;
-- normaliza valores válidos
do $$ begin
  if not exists (select 1 from pg_constraint where conname = 'rel_templates_canal_chk') then
    alter table rel_templates add constraint rel_templates_canal_chk check (canal in ('email','whatsapp','ambos'));
  end if;
end $$;

-- Seeds WhatsApp (org Salestrack): 1 HSM aprovado + 2 respostas rápidas. Idempotente por (org,nome).
insert into rel_templates (org_id, nome, corpo, atalho, canal, hsm)
select '00deba77-46fa-4d9f-9dd4-dc8aabfa1d34'::uuid, v.nome, v.corpo, v.atalho, v.canal, v.hsm
from (values
  ('HSM · Retomar conversa', E'Olá {{nome}}! Aqui é a Salestrack. Podemos retomar nossa conversa? Se preferir, respondo por aqui mesmo. 🙂', '/hsm-retomar', 'whatsapp', true),
  ('WA · Recebido', E'Oi {{nome}}, recebi sua mensagem! Já te retorno com o encaminhamento. 👍', '/wa-recebi', 'whatsapp', false),
  ('WA · Agendar', E'{{nome}}, que tal marcarmos uma conversa rápida? Me diga dois horários que funcionam pra você. 📅', '/wa-agenda', 'whatsapp', false)
) as v(nome, corpo, atalho, canal, hsm)
where not exists (select 1 from rel_templates t where t.org_id = '00deba77-46fa-4d9f-9dd4-dc8aabfa1d34'::uuid and t.nome = v.nome);
