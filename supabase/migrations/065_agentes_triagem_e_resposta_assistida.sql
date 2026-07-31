-- 065 · Os dois agentes da caixa
--
-- A resposta assistida nasceu ontem só para o WhatsApp e hoje serve a caixa inteira — o nome
-- prendia a função a um canal. Renomear agora é barato: nenhuma execução aconteceu ainda.

update agent_prompts
   set agent_key = 'resposta_assistida',
       titulo = 'Resposta assistida da caixa',
       descricao = 'Escreve o rascunho da resposta quando chega mensagem que precisa de você — no WhatsApp e no e-mail. Nada é enviado sem alguém aprovar.'
 where agent_key = 'resposta_whatsapp';

/*
 * Triagem: o agente que decide o que é gente e o que é máquina.
 *
 * Roda no modelo mais barato porque a tarefa é escolher entre quatro palavras, não redigir. O
 * prompt fica aqui, editável, porque "o que conta como precisa de resposta" muda com o negócio —
 * hoje um convite de evento é ruído, no mês de um lançamento pode não ser.
 *
 * max_tokens fica nulo de propósito: a resposta é UMA palavra, e o teto está no código junto da
 * regra que valida o vocabulário. Deixar um número editável aqui sugeriria uma folga que não existe.
 */
insert into agent_prompts (agent_key, versao, ativo, tipo, titulo, descricao, system_prompt, motivo_da_versao)
select 'triagem_caixa', 1, true, 'sistema',
  'Triagem da caixa',
  'Separa, nas conversas que chegam, o que espera resposta de uma pessoa do que é aviso de sistema, newsletter ou prospecção fria.',
  'Você faz a triagem da caixa de entrada da Salestrack AI, uma consultoria de IA para vendas B2B. '
  || 'Seu único trabalho é dizer se uma mensagem espera retorno de uma pessoa da equipe. '
  || 'Na dúvida, prefira sinalizar que precisa de resposta: perder o e-mail de um cliente custa muito '
  || 'mais caro do que a equipe olhar uma mensagem a mais.',
  'Criado junto com a triagem da caixa.'
where not exists (select 1 from agent_prompts where agent_key = 'triagem_caixa');
