# Teste de proporcionalidade — prospecção B2B sob legítimo interesse

**Controlador:** Salestrack AI
**Encarregado (DPO):** André Kachan · andre.kachan@salestrack.com.br
**Data:** 2026-07-30 · **Revisão:** anual, ou antes se a operação mudar
**Versão 2** — refeita no mesmo dia, quando a coleta deixou de ser só por fonte licenciada e passou
a incluir **raspagem**. A versão 1 concluía que o interesse legítimo prevalecia *porque* a fonte
era licenciada; essa premissa mudou, e a conclusão precisou ser reexaminada em vez de herdada.

Documento exigido pelo art. 10, §3º da LGPD, que faculta à ANPD requerer o relatório de impacto
quando o tratamento se funda em legítimo interesse. Sem ele escrito, a base legal não está
demonstrada — e base não demonstrada é base que não existe numa fiscalização.

---

## 1. O tratamento

Coleta de dados **profissionais** de pessoas que ocupam cargos de decisão em empresas
brasileiras, para contato comercial direcionado (prospecção B2B).

**Dados tratados — e apenas estes:**

| Dado | Por que é necessário |
|---|---|
| Nome | dirigir a mensagem à pessoa certa |
| Cargo | aferir se ela decide sobre o problema que resolvemos |
| Empresa | aferir se a empresa tem o problema |
| E-mail **corporativo** | canal de contato profissional |
| Telefone | canal alternativo — vem do registro profissional da fonte licenciada |
| URL do perfil público | rastrear a proveniência do dado, e casar a pessoa entre as fontes |
| Interação com posts do André | curtida, comentário ou compartilhamento **nos posts dele**, para saber quem já está dentro do assunto |
| Mensagens dirigidas ao André | conversas de que **ele é participante**, trazidas pela exportação oficial do LinkedIn. Escrever direto é o gesto mais deliberado antes de uma reunião |
| Abertura e clique nas nossas mensagens | medir se a comunicação foi lida, e parar de insistir com quem não lê |

**Dados que NÃO são tratados, por decisão expressa (2026-07-30):** e-mail pessoal (provedor
gratuito), endereço residencial, CPF, data de nascimento, foto, conteúdo de mensagens privadas,
qualquer dado sensível do art. 5º, II.

> **Revisão do mesmo dia:** o telefone deixou de ser filtrado. O critério de "dado corporativo"
> passou a ser decidido **apenas pelo domínio do e-mail**, que continua sendo a linha entre o
> papel profissional e a vida privada. O número tratado é o que consta do registro profissional na
> fonte licenciada — não um número descoberto por fora. A chamada ao fornecedor manda
> `reveal_personal_emails: false`, de modo que a regra fica dita também para ele.

A regra não é política interna — é **imposta pelo banco**. O gatilho
`trg_prospect_guard_corporativo` recusa a gravação de caixa de provedor gratuito em qualquer
caminho de escrita (tela, Server Action ou API direta). Ver as migrations `054` e `055`.

**Fontes, e o limite de cada uma:**

0. **Coleta automatizada no LinkedIn (raspagem), via Apify** — decisão do André, 2026-07-30, com
   o risco explicitado e a alternativa licenciada já construída e funcionando. Traz curtidas e
   comentários da pessoa em posts de terceiros, publicações dela sobre IA e grupos.
   **Trata dado profissional público. Não acessa mensagens privadas nem conteúdo restrito** — isso
   não foi construído e não será.
1. **Apollo** — base profissional de terceiro, licenciada. Traz quem a pessoa é.
2. **Posts do próprio André no LinkedIn** — quem curtiu, comentou ou compartilhou. O post é dele,
   a lista de reações é dele, e o LinkedIn a exibe para ele. Não há raspagem nem acesso a dado de
   terceiro: é o engajamento com o conteúdo do próprio controlador.
3. **Interação com as nossas comunicações** — abertura de e-mail, clique em link, leitura de
   proposta. Dado de **primeira parte**, gerado pela interação da pessoa conosco.

**Não são tratadas:** conversas de que o controlador **não** participa, e qualquer conteúdo de
acesso restrito de terceiros. Obter exigiria credencial de conta alheia — não é risco calibrável,
é o limite, e ele não se move.

**São tratadas** as conversas de que ele participa, pela exportação oficial do LinkedIn — o mesmo
regime do e-mail que a inbox já ingere. A conversa tem duas pontas, então guardar a mensagem
trata o dado de quem escreveu: cobertura idêntica à do resto (exclusão alcança pelo vínculo E pelo
slug do perfil, o conteúdo nunca vai para `audit_logs`, e só mensagem sobre IA vira sinal).

A coleta é executada por busca salva, com recorte obrigatório de cargo ou local
(`/admin/prospeccao/buscas`), diariamente às 5h, com teto de créditos por busca. Cada execução
fica registrada em `prospect_busca_execucoes`, e cada pessoa guarda de qual busca veio.

> Ser público **não** dispensa base legal. O art. 7º, §3º é explícito: dado tornado público
> preserva os direitos do titular e continua exigindo uma das hipóteses do art. 7º. A hipótese
> aqui é o **inciso IX — legítimo interesse**, não a publicidade do dado.

---

## 2. Finalidade

Identificar empresas cujo perfil indica o problema que a Salestrack AI resolve (adoção de IA
aplicada a processos comerciais) e propor uma conversa à pessoa que decide sobre esse problema.

Finalidade **legítima, específica e explícita**, e comunicada ao titular no primeiro contato.
Não é marketing de massa, não é venda de lista, não é enriquecimento para revenda.

---

## 3. Necessidade

O tratamento é o **meio menos invasivo** disponível para a finalidade:

- Só o dado profissional mínimo é coletado. Sem ele não há como saber a quem escrever nem se a
  mensagem faz sentido para aquela empresa.
- Nenhum dado da vida privada entra — o que, na prática, significa que a mensagem alcança a pessoa
  **no papel profissional dela**, no canal profissional dela, e não a pessoa na vida dela.
- Volume contido: prospecção direcionada por perfil, não varredura em massa.
- **Prazo:** 180 dias a contar da coleta. Quem não respondeu e não virou oportunidade é
  descartado automaticamente (`/api/cron/retencao`, diário). Guardar indefinidamente serviria à
  nossa comodidade, não à finalidade.

Alternativas consideradas e por que não bastam: só inbound (não alcança quem ainda não procura
solução — que é justamente o público da consultoria); lista comprada com consentimento genérico
(consentimento sem especificidade não é consentimento válido, art. 8º, §4º).

---

## 4. Balanceamento

### O interesse do controlador

Interesse econômico legítimo em oferecer serviços B2B a empresas com perfil compatível. Atividade
lícita, ordinária e reconhecida — o próprio Considerando 47 do GDPR, que inspirou a redação da
LGPD, cita marketing direto como possível interesse legítimo, e a prospecção B2B direcionada é
menos intrusiva que ele.

### O impacto sobre o titular

| Fator | Avaliação |
|---|---|
| Natureza do dado | Profissional e público. Parte é gerada pela interação com o próprio controlador (abriu, clicou, curtiu um post nosso); **parte é comportamento observado fora das nossas propriedades** — o que é mais intrusivo, e é o ponto onde este balanceamento ficou mais apertado que na versão 1 |
| Filtro de tema | Só interação com conteúdo de **IA** é registrada. Curtida em post de outro assunto é descartada na ingestão. Sem esse filtro, o volume coletado deixaria de ser proporcional à finalidade |
| Expectativa razoável | Quem publica cargo e empresa num perfil profissional espera contato profissional. Não espera contato na vida pessoal — e não recebe |
| Risco de dano | Baixo. O pior cenário realista é uma mensagem indesejada, reversível em um clique |
| Assimetria de poder | Inexistente. Não há relação de dependência, emprego ou hipossuficiência |
| Vulnerabilidade | Público adulto, profissional, em posição decisória. Não é grupo vulnerável |
| Decisão automatizada | Não há. Nenhuma decisão com efeito jurídico é tomada sobre o titular |
| Compartilhamento | Nenhum. O dado não sai do controlador nem é vendido |
| Transferência internacional | Não. Todo o tratamento fica em `sa-east-1` (São Paulo) |

### Salvaguardas implementadas

1. ~~**Fonte licenciada**, não raspagem.~~ **Deixou de valer em 2026-07-30.** A raspagem passou a
   ser usada por decisão do controlador. O que a substitui, e não é equivalente: teto diário de
   coletas, teto de pessoas por coleta, pausa **variável** entre requisições, parada automática de
   24h ao primeiro sinal de bloqueio, e preferência pela varredura por FONTE (um post rende dezenas
   de pessoas) em vez de perfil a perfil (uma requisição por pessoa) — o que reduz o volume de
   requisições e, com ele, o volume de dado pessoal tocado.
2. **Só dado corporativo** (critério: domínio do e-mail), imposto por gatilho no banco — não por
   disciplina de quem opera. A chamada ao Apollo ainda manda `reveal_personal_emails: false`.
3. **Recorte obrigatório** por cargo ou local: a ação recusa criar busca sem nenhum dos dois, e
   teto de créditos por busca contém o volume.
4. **Rastreio declarado e proporcional.** Abertura e clique são medidos para saber se a mensagem
   foi lida — só nas nossas próprias comunicações, com o link de saída sempre presente e **nunca
   rastreado**: medir o clique de quem está se descadastrando seria observar exatamente quem pediu
   para não ser mais observado. O decaimento de 30 dias faz o dado comportamental perder valor
   sozinho, em vez de se acumular indefinidamente.
5. **Aviso no primeiro contato**, acrescentado por código e não pedido ao modelo gerador: diz de
   onde veio o dado, qual a base legal e como sair. Obrigação legal não pode depender de o
   gerador ter lembrado (`lib/prospecting/agents.ts`).
6. **Oposição em um clique** (art. 18, §2º). O link sai em toda primeira mensagem; abrir já
   remove da base e registra a oposição. Sem formulário, sem confirmação, sem fricção.
7. **Marketing bloqueado por procedência**, não por ausência de consentimento — dado que a pessoa
   não nos deu nunca entra em lista de marketing, nem que alguém marque a caixa (`fn_pode_marketing`).
8. **Retenção com prazo**, automática e auditada.
9. **Trilha de auditoria** encadeada por hash, insert-only, em `audit_logs`.
10. **Encarregado nomeado e publicado** em toda comunicação.
11. **Suíte de testes** que trava as regras acima contra regressão (`npm run test:rls`).

### Conclusão (versão 2)

O interesse legítimo **prevalece**, e a conclusão é a mesma da versão 1 — mas por um caminho mais
estreito, e vale registrar onde ele aperta.

Sustentam a conclusão: o dado tratado continua sendo **profissional e público**; o filtro de tema
restringe a coleta a interações sobre IA, o que a mantém proporcional à finalidade; a via de
oposição é imediata e efetiva; a retenção tem prazo; e quem se opôs **não é observado**, verificado
em código antes de qualquer coleta.

Onde aperta, dito sem eufemismo: observar o comportamento de alguém **fora das nossas
propriedades** é mais intrusivo do que medir a leitura de uma mensagem que nós mesmos enviamos.
A expectativa razoável do titular cobre "meu perfil profissional é público"; cobre com menos folga
"alguém registrou em um banco de dados privado que eu curti tal post". É por isso que as
salvaguardas de volume — teto, pausa, filtro de tema, preferência por fonte — não são detalhe
operacional: **são elas que mantêm o tratamento proporcional**, e sem elas a conclusão não se
sustenta.

**Risco contratual, que é questão separada e NÃO é resolvida por este documento:** a raspagem
contraria os termos de uso do LinkedIn. A consequência realista é o bloqueio da conta usada, que é
a conta pessoal do André. Uma conta bloqueada não volta, e ela é também a fonte dos sinais
legítimos (§1, fonte 2). Esse risco foi apresentado ao controlador antes da decisão e assumido
por ele.

**Se qualquer salvaguarda restante for desativada, esta conclusão não vale mais.**

---

## 5. Direitos do titular

Todos exercíveis por `andre.kachan@salestrack.com.br` ou pelo link em qualquer mensagem, e
registrados em `/admin/lgpd` com o prazo de 15 dias do art. 19, II contado pelo banco:
confirmação, acesso, correção, anonimização/eliminação, portabilidade, informação sobre
compartilhamento e **oposição** (art. 18, §2º — o direito específico de quem é tratado por
legítimo interesse).

---

## 6. O risco contratual — assumido, não resolvido

Raspar o LinkedIn contraria os termos de uso da plataforma. **Isso é questão contratual com o
LinkedIn, não de LGPD**, e nenhum documento de conformidade a resolve.

Consequência realista: **bloqueio da conta usada**. A conta configurada é a pessoal do André —
perdê-la custa o histórico, os contatos e a audiência dos posts, que é a fonte dos sinais que não
dependem de risco nenhum (§1, fonte 2). O risco foi apresentado antes da decisão e assumido pelo
controlador em 2026-07-30.

**Como o risco é contido** (`lib/prospecting/coleta-linkedin.ts`):

| Salvaguarda | O que faz |
|---|---|
| Teto diário | número máximo de coletas em 24h, no banco |
| Teto por coleta | número máximo de pessoas lidas por execução |
| Pausa variável | intervalo aleatório entre requisições — ritmo constante é assinatura de robô |
| Parada automática | ao primeiro sinal de bloqueio, para 24h e avisa; insistir contra bloqueio é o caminho mais curto para o banimento |
| Parada manual | botão sempre visível na tela, para 7 dias |
| Preferência por fonte | varrer quem reagiu a um post rende dezenas de pessoas por requisição, contra uma pessoa por requisição na varredura perfil a perfil |
| Cookie opcional | actors que leem só conteúdo público não usam a sessão, e aí nenhuma conta corre risco |

**Plano B, se a conta cair:** a operação volta ao que já está construído e funcionando — Apollo
(§1, fonte 1) e reações aos posts próprios (§1, fonte 2). O modelo de dados não muda com a perda da
fonte; o que se perde é o alcance, não a base.

---

## 7. O que ainda falta

- Runbook de resposta a incidente (notificação à ANPD, registro, responsável).
- Revisão anual deste documento — próxima em **2027-07-30**.
