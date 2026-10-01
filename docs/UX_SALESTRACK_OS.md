# Navegação e experiência Salestrack OS

Revisão implementada em 1 de outubro de 2026.

## Mapa de trabalho

| Entrada única | Organização interna |
|---|---|
| Meu dia | Atividades prioritárias, tarefas, visão operacional e indicadores |
| CRM | Funil, empresas, contatos, importação; diagnóstico ROTA; propostas, contratos, escopos e jurídico |
| Prospecção | Base, buscas Apollo, sinais públicos, mensagens e coleta; cadências e aprovação |
| Relacionamento | Caixa de entrada, relatórios; régua e configuração |
| Projetos e clientes | Jornadas e entregas; clientes, onboarding e programas; acompanhamento e ROI |
| Conteúdo e capacitação | Materiais e identidade; método e Academy; marketing e campanhas |
| Gestão | Pessoas, fornecedores, finanças e monetização |
| Configurações e IA | Integrações e agentes; conta/equipe; governança; ajuda e padrões |

Todos os destinos anteriores permanecem acessíveis. A antiga visão Comercial redireciona ao CRM. O registro de seções permanece para compatibilidade; a nova navegação mantém cada ferramenta em uma única área. Novas seções sem agrupamento explícito aparecem em Outras ferramentas até revisão editorial.

## Uso diário

1. Entre em Meu dia. A fila mostra seis atividades por vez e prioriza maior urgência; abra a atividade para ver passos e evidência esperada.
2. Use os filtros Abertas, Bloqueadas, Concluídas ou Todas. O total muda após confirmação de salvamento; falha não conta como conclusão.
3. Abra CRM uma vez e alterne entre as abas Funil, Empresas, Contatos e Importar dados. Os grupos Diagnóstico e Propostas e contratos ficam na mesma navegação contextual.
4. Use Ctrl/Cmd + K para localizar ferramentas. Tab seleciona; Enter abre; Escape fecha. A busca considera nome, descrição e área, sem depender de acentos.
5. Em Todas as ferramentas, filtre por área. Um resultado vazio oferece limpeza dos filtros.
6. No celular, abra o menu. Expandir grupos não fecha o painel; seguir um link ou pressionar Escape fecha. O foco permanece dentro do painel enquanto aberto.

## O que ficou automatizado na experiência

A área e seção ativas são derivadas da URL mais específica. O CRM evita quatro entradas independentes na barra lateral. A busca e o diretório usam o mesmo registro. A fila prioriza maior pontuação, limita o volume visível e atualiza o andamento após salvamento. Isso não ativa envio de mensagens, coleta externa ou cadências.

## Validação e limites

Testes cobrem cobertura e unicidade dos destinos, resolução de rotas profundas, busca, filtro, foco da busca, comportamento do menu móvel, expansão da fila e ordem de prioridades. TypeScript e compilação de implantação são verificados. Testes em jsdom validam comportamento de componentes, não substituem inspeção visual em dispositivos reais nem execução autenticada de todos os módulos.

Próxima validação com conta administrativa: abrir os oito módulos; criar um negócio de teste identificado; preencher ROTA; salvar tarefa; preparar proposta sem enviar; confirmar histórico e permissões. Em seguida validar provedores um por vez, mantendo os registros de evidência na rotina. Integrações e credenciais permanecem com os limites registrados no guia principal.
