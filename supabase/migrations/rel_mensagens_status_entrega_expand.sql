-- amplia os status permitidos: inclui rascunho (fila de aprovação E2/E4), falha/falhou, pendente, entregue
alter table rel_mensagens drop constraint if exists rel_mensagens_status_entrega_check;
alter table rel_mensagens add constraint rel_mensagens_status_entrega_check
  check (status_entrega in ('enviado','falhou','falha','manual','recebido','lido','rascunho','pendente','entregue'));

-- reflete o backfill na conversa (marca como não lida e ajusta a última mensagem)
update rel_conversas c
set unread = true,
    last_message_at = greatest(coalesce(c.last_message_at, to_timestamp(0)), (select max(created_at) from rel_mensagens m where m.conversa_id = c.id))
where c.channel='whatsapp';
