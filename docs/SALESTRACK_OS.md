# Salestrack OS — execução comercial e evolução diária

## Objetivo e entrega desta versão
Vender transformação digital e IA a partir de prioridades reais de diferentes áreas.
A proposta nasce do diagnóstico; não existe pacote pronto obrigatório.

Esta versão acrescenta a Central Comercial em /admin/central ao ai-os existente.
Ela usa negócios abertos e tarefas vencidas/do dia, inclui duas pendências prioritárias,
registra andamento com evidência e prepara briefing por Claude sob comando do administrador.
O histórico fica em app_settings, com chave por dia ou melhoria, e usa a autenticação existente.
Não cria senhas padrão nem libera cadastro administrativo público.

A central não representa oito agentes autônomos já ativados. Os oito papéis organizam as
filas existentes; cada integração e rotina requer validação própria. O cron novo apenas
prepara o plano, sem contatos externos, e está desativado por padrão.

## Mapa e situação
| Módulo | Caminho | Situação |
|---|---|---|
| Central e pendências | /admin/central | Implementado nesta alteração; validação em produção pendente |
| Leads, contas, negócios e funil | /admin/crm | Código existente; testar leitura, escrita, filtros e isolamento |
| Apollo e qualificação | /admin/prospeccao/buscas | Código existente; chave e plano da API precisam de teste |
| Sinais públicos | /admin/prospeccao/sinais-linkedin | Revisão de evidências; manter manual sem fonte acessível |
| Cadências e mensagens | /admin/prospeccao | Código existente; não ativar antes de rever envios e limites |
| Projetos e tarefas | /admin/entregas e /admin/tarefas | Código existente; validar vínculo negócio, responsável e prazo |
| Propostas | /admin/propostas | Código existente; revisar texto, preço e escopo antes de enviar |
| Assinaturas | /admin/contratos | Código existente; testar OAuth/JWT, envelope e webhook |
| Conteúdo | /admin/marketing | Código existente; revisão humana antes de publicar |
| Saúde das rotinas | /admin/administracao | Revisar crons legados antes de habilitar nova operação |

O CRM nativo é a fonte principal proposta. HubSpot exige decisão explícita sobre campos,
sentido da sincronização e conflitos antes de conectar os dois.
Plugins do ChatGPT não fornecem automaticamente credenciais ao servidor do aplicativo.

## Rotina de André
1. Início do dia: abrir Central, verificar falhas de leitura e salvar plano. Gerar briefing
   apenas depois de configurar IA e limites de gasto.
2. Executar retornos e tarefas vencidas; abrir contexto antes de contatar alguém.
3. Tratar propostas em decisão: confirmar prioridade, decisor, objeção e próximo compromisso.
4. Revisar até cinco candidatos: origem, identidade, vínculo, bloqueios e hipótese de necessidade.
5. Preparar abordagens e um conteúdo útil sobre uma prioridade empresarial. Registrar o que
   foi realmente enviado/publicado separadamente de rascunhos.
6. Reservar 30–45 minutos às pendências da central. As duas primeiras abertas reaparecem
   diariamente até a evidência de conclusão; bloqueadas precisam de responsável e encaminhamento.
7. Encerrar com reuniões, propostas, contratado e recebido, além de responsável e próxima data.

Cada cartão informa quando agir, passos manuais e critério de conclusão.
Concluir na Central não conclui a tarefa de origem: o cartão instrui a atualizar o módulo correspondente.
A leitura limita-se aos 100 negócios abertos e 100 tarefas mais antigas, explicitamente indicados.
Escala maior requer paginação, filtros por responsável e agregações no banco.

## Operação manual quando a integração não estiver disponível
| Momento | Passo a passo | Registro |
|---|---|---|
| Sinal encontrado | Abrir post; confirmar autor/data/empresa; copiar URL e trecho; consultar bloqueios | S2/S3 somente com evidência; restante pendente |
| Prospecção Apollo | Filtrar ICP; revisar pequena amostra; aprovar créditos; exportar/importar lote | Identidade, origem e duplicados conferidos |
| Sales Navigator | Usar pesquisa e listas manualmente na conta autorizada; registrar perfil e contexto no CRM | Sem cookies, scraping autenticado ou automação de convites |
| Contato autorizado | Revisar destinatário e texto; usar canal disponível; registrar resposta e próximo passo | Recusa pausa continuidade; conexão/curtida não autoriza ligação |
| WhatsApp | Abrir conversa permitida no número Salestrack; revisar texto e enviar manualmente | Anotar contexto/aceite; link de conversa não é integração Business API |
| Proposta pronta | Revisar escopo, preço, dados e signatário; enviar pelo canal aprovado | Data, versão e responsável |
| Assinatura | Subir versão aprovada na DocuSign; conferir destinatários; enviar; baixar PDF concluído | Envelope ID e documento final, sem presumir assinatura |
| Negócio ganho | Criar projeto, responsáveis, entregas, marcos e aceite | Reunião inicial e primeira tarefa |

## Pendências e ordem de liberação
P0: banco ativo e backup; autorização administrativa e isolamento; Vercel ligada ao projeto existente;
variáveis verificadas; preview aprovado. Não renomear domínios antes de validar os acessos.

P1: modelo de IA válido e limite de custo; Apollo com limite de créditos; e-mail com domínio e
remetente verificados; mensagens de teste para a própria equipe; resposta, recusa e pausa funcionando.
Revisar o texto de oferta salvo no Console: a mudança no valor padrão não substitui configurações antigas.

P1: WhatsApp Cloud API oficial: Business Portfolio, WABA, phone_number_id, token e webhook autenticado.
O adaptador Meta oficial ainda exige implementação/validação; a presença de token não comprova integração.
Há código legado de outro provedor: não tratá-lo como equivalente à API oficial.

P1: DocuSign: aplicação, consentimento e credenciais de servidor, assinatura e webhook testados.
Resend é opcional para opt-in/notificações/propostas solicitadas. Não usar para prospecção fria.

P2: fila durável, idempotência de envios, tentativas controladas, limites diários, pausa global,
orçamento de IA, alertas, reconciliação de eventos e testes de ponta a ponta por integração.
GPT como segundo provedor permanece uma extensão: o briefing desta versão reutiliza Claude.
Sales Navigator API depende de acesso autorizado ao programa de integrações.

P2: melhorar o quadro de pendências com responsável, prazo, dependências e histórico de alterações;
esta primeira versão guarda o último andamento por item, com auditoria de alteração.
Adicionar página de métricas realizadas, atribuição por fonte e exportação de backup.

## Agendamento e segurança operacional
A rota /api/cron/salestrack exige Authorization: Bearer CRON_SECRET, falha com 503 sem segredo,
e permanece pausada enquanto SALESTRACK_DAILY_ENABLED não for true.
O plano é inserido uma única vez por dia (conflito na chave não sobrescreve snapshot anterior).
A lista exibida na Central é atual, portanto pode mudar após o snapshot; o snapshot é histórico.
Falha de banco ou log não vira confirmação de sucesso.

Depois de validar em preview, adicionar ao vercel.json:
{"path":"/api/cron/salestrack","schedule":"30 10 * * *"}
Isso corresponde a 07:30 em Brasília. Não foi ativado nesta alteração.
Antes disso, revisar os crons legados de coleta, prospecção, cadência e engajamento:
a coleta antiga contém integração de scraping que não faz parte da operação pública autorizada.
Manter essa coleta desativada; não configurar cookies nem contornar restrições do LinkedIn.
Habilitar apenas uma função por vez. Não habilitar todos os crons ao restaurar o projeto.

## Validação e lançamento
1. Instalar dependências com npm ci e executar npm run test:unit e npx tsc --noEmit.
2. Vincular Vercel ai-os e puxar variáveis somente em ambiente autorizado; nunca versionar segredos.
3. Banco restaurado: verificar migrations aplicadas, RLS em app_settings e demais tabelas,
   usuário salestrack_admin na organização Salestrack e bloqueio de usuário externo.
4. Criar preview; testar login, Central, salvar evidência, nova leitura, mudança de dia, briefing,
   criação de lead, evolução no funil, proposta e tarefa. Não usar dados reais em testes de envio.
5. Testar cron pausado, sem autorização, repetido e com falha. Confirmar registro.
6. Promover commit validado; monitorar primeira execução e manter rollback para deployment anterior.

Nenhum teste local substitui a validação com o banco ativo. Os módulos legados precisam de revisão
de segurança e funcionalidade antes de prometer operação comercial autônoma.
