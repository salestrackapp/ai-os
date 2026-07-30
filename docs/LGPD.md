# LGPD — como o AI OS trata dado pessoal

Documento operacional. Diz onde cada coisa mora, o que a máquina faz sozinha e o que depende de
alguém. Escrito na F3·Bloco 6.

## Encarregado (DPO)

**André Kachan · andre.kachan@salestrack.com.br**

É o contato que o art. 41 exige publicar. Aparece no formulário dos dois sites, no rodapé de todo
e-mail e na página de descadastro. Todo pedido que chegar por ali precisa ser registrado em
`/admin/lgpd` — o registro é o que prova que foi atendido, e dentro do prazo.

## As duas perguntas que não se confundem

| Onde | Pergunta que responde |
|---|---|
| `comms_consent` | "posso disparar neste endereço, por este canal, agora?" — gate operacional |
| `consent_records` | "posso tratar o dado desta pessoa para esta finalidade, e consigo provar?" — registro jurídico |

Um envio de marketing precisa dos dois. Um envio transacional (resposta ao que a pessoa pediu, um
documento de projeto) precisa só do primeiro.

## Bases legais em uso

| Finalidade | Base | Por quê |
|---|---|---|
| `transacional` | execução de diligência pré-contratual (art. 7º, V) | foi a pessoa quem procurou; não depende de caixinha |
| `marketing` | consentimento (art. 8º) | conteúdo que ela não pediu; caixa nasce **desmarcada** |
| `prospeccao` | legítimo interesse (art. 7º, IX) | teste de proporcionalidade em [LIA_PROSPECCAO.md](LIA_PROSPECCAO.md) |

O `texto_aceite` guarda o que a pessoa leu no momento. Sem ele o consentimento não é demonstrável,
e consentimento que não se demonstra é o mesmo que não ter.

## Procedência: o que decide o que se pode fazer

| Procedência | O que é | Marketing | Prospecção |
|---|---|---|---|
| `titular` | a pessoa nos deu (formulário) | sim, **se** consentir | sim |
| `coleta_publica` | perfil profissional público | **nunca** | sim, sob legítimo interesse |
| `terceiro` | base comprada/licenciada (Apollo) | **nunca** | sim, sob legítimo interesse |

O bloqueio é por **procedência**, não por ausência de consentimento. A diferença importa: ausência
de consentimento se resolve marcando uma caixa, e alguém marcaria. Dado que a pessoa nunca nos deu
não vira lista de marketing nem com caixa marcada (`fn_pode_marketing`).

**Prospecção só admite dado corporativo** (decisão do André, 2026-07-30), e o critério é o
**domínio do e-mail**: caixa de provedor gratuito é recusada pelo gatilho
`trg_prospect_guard_corporativo` — no banco, para valer também quando a escrita vem por PostgREST
direto. Telefone não é filtrado (revisão do mesmo dia). Espelhado em `lib/lgpd/corporativo.ts`
para dizer ao operador quais linhas caíram e por quê; `tests/lgpd-corporativo.test.ts` trava as
duas versões contra a mesma tabela de casos.

## O que acontece sozinho

1. Lead entra por qualquer um dos dois sites → `registrarConsentimentoDeLead()` grava **duas**
   linhas: transacional concedido e marketing concedido **ou negado**. Saber que ela não autorizou
   também é informação.
2. Marketing aceito → o gate de canal (`comms_consent`) é liberado junto.
3. Todo e-mail sai com via de saída: link real quando há token, endereço do DPO quando não há.
4. Abrir o link `/descadastro/[token]` **já descadastra** — sem confirmação, que seria dark pattern.
   Revoga o consentimento de marketing e fecha o gate de canal. O transacional continua.
5. Peça de linha `email_mkt` só sai se `podeEnviarMarketing()` disser sim.
6. Pedido registrado em `/admin/lgpd` carimba o prazo de 15 dias (art. 19, II) no banco.
7. Prospect importado grava a base legal junto: prospecção por legítimo interesse **e** marketing
   negado. Gravar o "negado" é o que impede alguém, meses depois, de supor que o silêncio era sim.
8. O **primeiro** toque de cadência leva o aviso de origem e a via de oposição — acrescentado por
   código, nunca pedido ao modelo. Obrigação legal não depende de o gerador ter lembrado.
9. O mesmo link de saída resolve as duas coisas: revoga marketing e, se a pessoa estiver na base
   de prospecção, registra a oposição do art. 18, §2º e a remove.
10. `/api/cron/retencao` (diário, 04:00) descarta prospect que não respondeu em 180 dias e quem se
    opôs — este último na hora seguinte, sem esperar prazo.
11. `/api/cron/prospeccao` (diário, 05:00) roda as buscas ativas pelo Apollo: coleta com recorte
    obrigatório, teto de créditos por busca, e a base legal gravada junto de cada pessoa nova.
12. Sinais de engajamento (abertura, clique, leitura de proposta, reação a post sobre IA) entram
    em `engagement_events` com **peso e decaimento de 30 dias**. O link de descadastro nunca é
    rastreado — medir quem está saindo seria observar quem pediu para não ser observado.
13. `/api/cron/engajamento` (diário, 03:00) reaplica o decaimento e casa interações de quem
    interagiu antes de entrar na base.

## O que depende de alguém

- Registrar em `/admin/lgpd` todo pedido que chegar por e-mail ou telefone.
- Concluir o pedido. Quando é de exclusão, concluir **executa** a exclusão — concluir sem apagar
  seria registrar uma mentira no próprio livro de conformidade.
- Manter o cron de retenção rodando. Se ele parar, a base envelhece e o legítimo interesse
  enfraquece junto — a conclusão do LIA depende de a salvaguarda estar operante.
- Revisar o [LIA](LIA_PROSPECCAO.md) anualmente (próxima: 2027-07-30) ou sempre que a operação
  mudar. Desativar qualquer salvaguarda invalida a conclusão dele.
- Definir o recorte das buscas em `/admin/prospeccao/buscas` e ativá-las. A que existe hoje está
  **pausada** de propósito: o recorte foi de exemplo, não uma decisão de negócio.
- Acompanhar o gasto de créditos do Apollo. Cada e-mail descoberto custa; o teto é por busca.

## Exclusão: o que apaga e o que não

**Apaga:** contato, negócios sem contrato, timeline, leads dos dois sites, prospecção e cadências,
toques de campanha, gate de canal, token de descadastro, todo o histórico de engajamento, as
interações do LinkedIn **e o conteúdo das conversas** — dado comportamental e conteúdo de mensagem
são os mais sensíveis que o sistema guarda, não os menos. A exclusão alcança as conversas pelo
vínculo com o prospect **e** pelo slug do perfil, porque a mensagem pode ter chegado antes de a
pessoa existir na base.

**Preserva:**
- `audit_logs` — intocado, sempre. Direito ao esquecimento e trilha de auditoria são obrigações
  distintas e não se anulam.
- `consent_records` — muda para `revogado`. É a prova de que a revogação foi atendida.
- Contratos e propostas — **anonimizados** no campo que identifica, não apagados. O art. 16, I e III
  ressalva a retenção para obrigação legal e exercício de direitos. Apagar contrato assinado
  destruiria prova, não protegeria ninguém.

A exclusão roda como função no banco (`fn_lgpd_excluir_titular`), não como sequência de chamadas da
aplicação: ou apaga tudo, ou não apaga nada. Exclusão pela metade deixa a pessoa pior do que antes.

## Quem pode chamar o quê

`fn_lgpd_excluir_titular` e `fn_lgpd_inventario_titular` são chamáveis **só pelo service client**,
atrás da guarda de admin Salestrack da tela.

> Atenção ao revogar: `revoke ... from anon` **não fecha nada sozinho**. O grant que libera todo
> mundo é o de `PUBLIC`, concedido por padrão a toda função nova. Sem `revoke ... from public`, a
> função continua exposta em `/rest/v1/rpc/`. Os dois furos foram encontrados pela suíte de RLS, não
> pela leitura do código — por isso existem os testes.

## Ainda em aberto

- Runbook de resposta a incidente (notificação à ANPD, registro, responsável nomeado).
- Residência de dados: o projeto `us-east-2` da academy antiga ainda existe e precisa ser apagado.
