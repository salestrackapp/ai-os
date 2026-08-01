# AI OS · O que ainda falta configurar

> Guia único do que **está pendente** para o sistema rodar 100% em produção.
> Ordem = prioridade (o topo destrava mais coisa). Cada item diz **por que importa**, **quem faz** e o **passo a passo**.
> App em produção: **https://ai-os-sable.vercel.app** · Domínio final: **ai-os.salestrack.com.br** (pendente DNS).
> Envs ficam em: Vercel → projeto `ai-os` → **Settings → Environment Variables** (sempre em *Production*). Depois de mudar env, **fazer um redeploy**.

Legenda: 🔴 destrava função · 🟡 melhora/recomendado · 🟢 opcional.

---

## 0-A. ✅ CRON_SECRET — RESOLVIDO em 2026-07-28
**O que era:** as cinco rotas de cron respondiam `503 cron_not_configured` no ar. A variável nunca
foi definida na Vercel, então **nenhum job agendado jamais rodou** — inclusive o motor de cadências
de prospecção (`/api/cron/cadence`), que é função central do comercial.

**Reconferido em 2026-07-29**, contra produção, na rota `tarefas`:
sem token → `401` · token errado → `401` · token correto → `200`. Fechada e funcionando.

Rotas afetadas: `cadence` (cadências), `ops` (operações), `orchestrate` (orquestração de comunicação),
`relacionamento` (inbox), `tarefas` (avisos de tarefa vencendo/atrasada).

**Nota de segurança:** até 2026-07-28 a rota `orchestrate` era **fail-open** — a guarda era
`if (secret && ...)`, então sem a variável ela rodava sem autenticação nenhuma e podia ser acionada
por qualquer um, disparando o agendador de comunicação. Corrigida para fail-closed e publicada.

**Como foi feito** (deixado aqui para o dia em que a chave precisar ser rotacionada):
1. Gerar um valor forte: `openssl rand -hex 32`.
2. Vercel → projeto `ai-os` → Settings → Environment Variables → **`CRON_SECRET`** (Production).
3. Redeploy — variável nova só vale a partir do próximo build.
4. Conferir: `curl -s -o /dev/null -w "%{http_code}" https://ai-os-sable.vercel.app/api/cron/cadence`
   deve dar `401` (fechada e configurada); com `-H "Authorization: Bearer <chave>"`, `200`.
   Se voltar `503`, a variável não chegou no build.

## 0. 🔴 Ativar os agentes de IA (Consultor + ROI) — Fase 5
**Por que:** o Consultor do Programa (chat no portal/WhatsApp/Slack) e a narrativa de ROI rodam na API Anthropic da Salestrack. Sem a chave, respondem "temporariamente indisponível" (o resto do app funciona).
**Quem faz:** você (gera a chave em console.anthropic.com).
**Passo a passo:**
1. Vercel → env **`ANTHROPIC_API_KEY`** (Production). Opcional **`ANTHROPIC_MODEL`** (default `claude-sonnet-5`).
2. Redeploy. Pronto: Consultor e ROI passam a responder.
3. **Slack (opcional):** envs `SLACK_BOT_TOKEN` + `SLACK_SIGNING_SECRET`; depois mapear cada canal a uma org em `app_settings` (chave `slack_channels`, jsonb `{ "C0123": "org-uuid" }`). Sem isso, o Consultor segue no portal e no WhatsApp.

## 1. 🔴 Domínio próprio (ai-os.salestrack.com.br)
**Por que:** hoje o app vive na URL da Vercel; o domínio bonito é o que você divulga.
**Quem faz:** você, no painel de DNS do salestrack.com.br (é digiclick/uni5, não a Vercel).
**Passo a passo:**
1. No DNS do domínio, crie um registro **A**: nome `ai-os` → valor **76.76.21.21**.
   (alternativa: registro **CNAME** `ai-os` → `cname.vercel-dns.com`).
2. Na Vercel → projeto `ai-os` → Settings → Domains, confirme que `ai-os.salestrack.com.br` está listado (já foi adicionado).
3. Aguarde a propagação (minutos a algumas horas). A Vercel emite o SSL sozinha.
4. Quando abrir no domínio, faça o item 2 abaixo (Supabase Auth).

## 2. ✅ Liberar o domínio no Supabase Auth — FEITO em 2026-07-29
**Por que:** sem isso, os e-mails de login/recuperação de senha apontam para a URL errada e o acesso quebra.
**Quem faz:** você, no painel Supabase (não há automação para isso).

**Estava quebrado em produção.** O Site URL continuava `http://localhost:3000` e nenhum domínio de
produção estava na lista, então todo e-mail de "Esqueci minha senha" e de link mágico devolvia a
pessoa em `localhost` — sem saída para qualquer cliente ou aluno que perdesse a senha.

**Configuração aplicada** (Supabase → projeto `ai-os` → Authentication → URL Configuration):
- **Site URL:** `https://ai-os-sable.vercel.app`
- **Redirect URLs:**
  - `https://ai-os-sable.vercel.app/**` — produção de hoje
  - `https://ai-os.salestrack.com.br/**` — domínio definitivo, já liberado para quando o DNS subir
  - `https://*-salestrack-ai.vercel.app/**` — previews da Vercel, que ganham endereço aleatório a cada deploy
  - `http://localhost:3000/**` — desenvolvimento; agora é um item da lista, não mais o padrão de todos

O app devolve o usuário em duas rotas, ambas cobertas pelo curinga `/**`:
`/entrar` (link mágico, `app/login/page.tsx:30`) e `/reset` (senha, `app/login/page.tsx:40`).

**Como verificar** (roda contra produção, não altera nada — `generateLink` só monta o link):
```js
const { data } = await sb.auth.admin.generateLink({
  type: "recovery", email: "<um e-mail real>",
  options: { redirectTo: "https://ai-os-sable.vercel.app/reset" },
});
new URL(data.properties.action_link).searchParams.get("redirect_to");
// honrado → a lista está certa. Voltou outra coisa → o destino não está liberado.
```
Teste também um destino **fora** da lista (ex.: `https://exemplo-invalido.com/x`): tem de cair no
Site URL. Se ele for honrado, a lista não está filtrando — e aí qualquer um poderia disparar um
e-mail de recuperação da Salestrack com um link que entrega o token de sessão em servidor alheio.

## 3. 🔴 Ligar as Sessões ao Vivo (Read AI + Calendly)
**Por que:** o app já **recebe** (webhooks no ar, com token, testados). Falta cada plataforma começar a **enviar**.
**Quem faz:** você, nos painéis do Read AI e do Calendly. **Detalhes completos em `docs/INTEGRACOES_SESSOES.md`.**
**Passo a passo (resumo):**
1. **Read AI** → Integrations → Webhooks → adicionar endpoint:
   `https://ai-os-sable.vercel.app/api/readai/webhook?token=<READAI_WEBHOOK_TOKEN>`
2. **Calendly** (plano com webhooks) → criar subscription do evento `invitee.created` para:
   `https://ai-os-sable.vercel.app/api/calendly/webhook?token=<CALENDLY_WEBHOOK_TOKEN>`
   (comando `curl` pronto no doc). E deixe o Location do evento = **Google Meet**.
3. Os tokens já estão na Vercel e no `.env.local` (não estão em nenhum arquivo do repositório — peça a mim ou veja no `.env.local`).
> Enquanto não ligar: dá para **agendar e fechar sessão manualmente** em Admin → Programas → [programa] → *Sessões ao Vivo & créditos*.
> Detalhe: o casamento automático usa o **e-mail do participante** — o cliente precisa entrar na call com o mesmo e-mail do portal; senão, fecha manual.

## 4. 🔴 Webhook de pagamento ASAAS
**Por que:** a chave da ASAAS já está na Vercel, mas **falta o token do webhook** — sem ele, o app não recebe a confirmação automática de "pago"/"atrasado".
**Quem faz:** você (gera o token comigo e configura no painel ASAAS).
**Passo a passo:**
1. Defina um segredo e adicione na Vercel: env **`ASAAS_WEBHOOK_TOKEN`** (Production).
2. ASAAS → **Integrações → Webhooks** → nova configuração:
   - URL: `https://ai-os-sable.vercel.app/api/asaas/webhook`
   - Token de autenticação: o mesmo `ASAAS_WEBHOOK_TOKEN` (a ASAAS manda no header `asaas-access-token`).
   - Eventos: `PAYMENT_RECEIVED`, `PAYMENT_CONFIRMED`, `PAYMENT_OVERDUE`.
3. Redeploy.

## 5. 🟡 E-mail transacional (Resend) — remetente e domínio
**Por que:** a chave do Resend já está na Vercel, mas o **remetente** (`EMAIL_FROM`) não está setado e o domínio precisa estar verificado, senão e-mails caem em spam ou falham.
**Quem faz:** você.
**Passo a passo:**
1. Resend → **Domains** → verificar `salestrack.com.br` (adicionar os registros SPF/DKIM no DNS).
2. Vercel → env **`EMAIL_FROM`** = `AI OS · Salestrack <aios@salestrack.com.br>` (o domínio precisa ser o verificado).
3. Redeploy e envie um teste (ex.: uma proposta) para conferir a entrega.

## 6. 🟡 Assinatura eletrônica (Docusign)
**Por que:** conta real já conectada (produção, na4), mas **falta a Integration Key + chave RSA + consentimento** — sem isso, a assinatura via Docusign não roda e o sistema usa o **fallback manual** (upload do PDF assinado).
**Quem faz:** você, no Docusign Admin.
**Passo a passo:**
1. Docusign → **Settings → Apps and Keys** → criar/associar uma **Integration Key** com **JWT**.
2. Gerar um par de chaves **RSA** e guardar a **chave privada**.
3. Conceder **consent** (uma URL de autorização única do JWT).
4. Vercel → envs: **`DOCUSIGN_INTEGRATION_KEY`** e **`DOCUSIGN_PRIVATE_KEY`** (a RSA privada). Opcional: **`DOCUSIGN_CONNECT_SECRET`** (HMAC do webhook Docusign Connect).
5. Redeploy. (Enquanto isso, a assinatura manual continua funcionando.)

## 7. 🟡 Dados da empresa no contrato
**Por que:** a minuta do contrato usa CNPJ/endereço da Salestrack; sem env, sai em branco/placeholder.
**Quem faz:** você.
**Passo a passo:** Vercel → envs **`SALESTRACK_CNPJ`** e **`SALESTRACK_ENDERECO`** → redeploy.
(Os textos das cláusulas/foro/IPCA você edita direto em **Admin → Configurações → Contratos**, sem env.)

## 8. 🟡 Conteúdo do Método (Estúdio)
**Por que:** as 20 receitas estão publicadas com textos de "ganho" **estimados** (marcados "a revisar"); o catálogo de sessões está criado mas **sem links de Calendly** e despublicado.
**Quem faz:** você, dentro do app (sem env).
**Passo a passo:**
1. Admin → **Estúdio do Método** → revisar o campo **Ganho** de cada receita (com números reais quando tiver) e desmarcar "a revisar".
2. Em **Catálogo de Sessões**, preencher o **Calendly URL** de cada modalidade e marcar **Publicada no portal** — assim o cliente vê o botão "Agendar".

## 8-B. 🟡 Proteção contra senha vazada — um interruptor, 30 segundos

**Ainda desligada.** Consta como resolvida na Fase 0 e não está: o advisor do Supabase acusa
`auth_leaked_password_protection` desabilitado. Com ela ligada, o Supabase confere toda senha nova
contra a base do HaveIBeenPwned e recusa as que já vazaram em incidentes conhecidos.

**Por que importa aqui:** as senhas do AI OS são criadas por gente de fora — cliente aceitando
convite, aluno se matriculando. Senha reaproveitada de um vazamento antigo é o vetor mais comum de
invasão de conta, e nenhuma outra defesa do sistema pega isso.

**Onde:** Supabase → projeto `ai-os` → **Authentication → Policies** (ou *Providers → Email*) →
ligar **"Prevent use of leaked passwords"**. Não exige redeploy nem mexe em quem já tem senha.

**Enquanto isso:** o item 9 (MFA) segue valendo, e a sua conta continua sem MFA desde que o
removemos.

## 9. 🟢 Segurança extra (MFA) — quando quiser
**Por que:** já existe suporte a MFA (2 fatores) para o admin; está **desligado** por padrão para não te travar.
**Passo a passo:**
1. Cadastre seu 2º fator em **Admin → Configurações** (Segurança).
2. Só depois, para **exigir** MFA de todos os admins: Vercel → env **`MFA_ENFORCE=true`** → redeploy.

## 10. 🔴 ASAAS está em SANDBOX — o financeiro nunca falou com a conta real
**Descoberto em 2026-07-30.** A chave configurada é de **homologação** (`$aact_hmlg_…`), e o
sandbox está vazio. A conta é a certa (SALESTRACK INTELIGENCIA DIGITAL LTDA, CNPJ 51807376000143),
só o ambiente é o de teste.

**O que isso causa hoje:**
- As 5 faturas da IMAGO (R$ 12.100, sendo R$ 3.000 vencidos) existem **só no banco do AI OS**.
  As cobranças reais estão na conta de produção do ASAAS, e as duas pontas não se enxergam.
- O webhook de pagamento aponta para o sandbox: quando o cliente pagar de verdade, **o AI OS não
  fica sabendo** e a fatura continua "aberta" para sempre.
- A régua de cobrança está construída e **não roda** até isto ser resolvido — de propósito: com o
  ambiente errado ela geraria boletos duplicados ou cobraria quem já pagou.

**Quem faz:** você.

**Passo a passo:**
1. ASAAS (produção) → Configurações → Integrações → **copiar a API Key de produção**
   (começa com `$aact_prod_`).
2. `npx vercel env rm ASAAS_API_KEY production` e depois
   `npx vercel env add ASAAS_API_KEY production` com a chave nova.
3. `npx vercel env rm ASAAS_ENV production` → `npx vercel env add ASAAS_ENV production` →
   valor **`production`**.
4. Ainda no ASAAS: Integrações → **Webhooks** → URL
   `https://ai-os-sable.vercel.app/api/asaas/webhook`, com token → mesmo valor de
   `ASAAS_WEBHOOK_TOKEN` (item 2 desta lista).
5. Redeploy e conferir com:
   `curl "https://ai-os-sable.vercel.app/api/admin/asaas-diag?key=$CRON_SECRET"` —
   deve dizer `ambiente_configurado: production` e mostrar os pagamentos.
6. Só então rodar a sincronização, que **espelha** o ASAAS sem criar nada:
   `curl "https://ai-os-sable.vercel.app/api/cron/cobranca?so_sincronizar=1&key=$CRON_SECRET"`

**Ordem importa:** sincronize antes de deixar a régua enviar. A primeira execução é a que mais
pode constranger — com o painel local desatualizado, ela cobraria quem já pagou.

## 11. 🔴 RH — o banco existe, o AI OS ainda não fala com ele
**Criado em 2026-07-30:** projeto Supabase **`salestrack-rh`** (ref `tsuejfuwpxqydtkwtwqd`), em
**sa-east-1 (São Paulo)**, com schema, RLS e criptografia prontos. A tela `/admin/rh` já existe e
explica a pendência a quem entrar.

**Quem faz:** você. São 4 variáveis.

**Passo a passo:**
1. Painel do RH → Settings → API → copie a **service_role key** (a secreta, não a anon):
   `https://supabase.com/dashboard/project/tsuejfuwpxqydtkwtwqd/settings/api`
2. Gere duas chaves aleatórias (guarde num gerenciador de senhas — **perdê-las torna os dados
   cifrados ilegíveis para sempre**):
   ```bash
   openssl rand -base64 32   # RH_ENCRYPTION_KEY
   openssl rand -base64 24   # RH_CPF_SALT
   ```
3. Cadastre as quatro na Vercel:
   ```bash
   npx vercel env add RH_SUPABASE_URL production      # https://tsuejfuwpxqydtkwtwqd.supabase.co
   npx vercel env add RH_SERVICE_ROLE_KEY production
   npx vercel env add RH_ENCRYPTION_KEY production
   npx vercel env add RH_CPF_SALT production
   ```
4. **Dê acesso a si mesmo.** Ser admin do AI OS não abre o RH — de propósito. No SQL Editor do
   banco de RH:
   ```sql
   insert into rh_papeis (user_id, email, papel)
   values (gen_random_uuid(), 'andre.kachan@salestrack.com.br', 'rh_admin');
   ```
5. Redeploy.

**Sobre as chaves de cifra:** CPF e salário são cifrados com elas. Se forem perdidas, o dado não
volta — não há recuperação. Se forem trocadas, o que foi cifrado com a anterior deixa de ser
legível. Guarde antes de cadastrar.

**Falta também:** apagar o projeto antigo da academy, que continua sendo cobrado (~US$10/mês) e
está vazio: `https://supabase.com/dashboard/project/ynyqfbngitodmkoloays/settings/general` →
Delete project. Enquanto não apagar, você paga dois.

## 12. 🟡 Histórico de execuções de IA (agent-control)
**Construído em 2026-07-30.** Toda chamada ao Claude passa a registrar entrada, saída, tokens,
custo, tempo e erro no **agent-control** — que é outro projeto Supabase (`mktjwqchdclqjxzabpow`).
A tela está em **Configurar → Custo de IA** e já explica a pendência.

**O que isso resolve:** hoje a fatura da Anthropic vem num número só. Com o registro, dá para
responder "quanto de IA gastamos com a IMAGO?" e "por que aquele agente falhou ontem?".

**Quem faz:** você. Duas variáveis.
```bash
npx vercel env add AGENT_CONTROL_URL production          # https://mktjwqchdclqjxzabpow.supabase.co
npx vercel env add AGENT_CONTROL_SERVICE_KEY production  # service_role do agent-control
```
A service_role está em:
`https://supabase.com/dashboard/project/mktjwqchdclqjxzabpow/settings/api`

**Sem isso os agentes funcionam normalmente** — o que falta é o histórico, não a execução. O
registro nunca derruba a resposta ao usuário: se o agent-control estiver fora do ar, a IA responde
igual e só o traço se perde.

**Não confundir com delegação de execução.** A execução continua no AI OS. Mover o processamento
para o agent-control depende do Trigger.dev, que ainda não está configurado — a ponte está pronta
para quando isso existir.

## 13. 🟡 Coleta externa no LinkedIn (Apify) — pendente de configuração
**Por que:** a coleta de curtidas/comentários em posts de terceiros, publicações e grupos está
**construída e desligada**. Ela não roda até a chave e os actors entrarem.

**Quem faz:** você.

**Passo a passo:**
1. Crie conta em [apify.com](https://apify.com) e copie o **API token** (Settings → Integrations).
2. No AI OS: **Configurar → Parâmetros e integrações** → provedor **`apify`** → cole o token.
3. No marketplace do Apify, escolha os actors e copie o ID de cada um (formato `usuario/nome`):
   - **quem reagiu a um post** — o mais eficiente, um post rende dezenas de pessoas
   - **atividade de um perfil** — curtidas e comentários da pessoa em posts de terceiros
   - **perfil completo** — usado para grupos
4. Cole os IDs em **Prospecção → Coleta externa**.
5. **Decida sobre a sessão:** actors que leem só conteúdo público **não** usam sua conta e não a
   arriscam. Se escolher usar, salve o cookie **`li_at`** em Parâmetros com o provedor
   **`linkedin_li_at`** — ele é a sua sessão inteira, quem o tiver entra na sua conta.
6. Cadastre as fontes (perfis que publicam sobre IA) e **ligue** a coleta.

**Antes de ligar:** a raspagem contraria os termos de uso do LinkedIn e o risco é o bloqueio da
conta configurada, que é a sua pessoal. O balanceamento está em `docs/LIA_PROSPECCAO.md` §6, e o
sistema tem teto diário, pausa variável e parada automática — mas nenhum deles elimina o risco.

**O que já funciona sem isto:** Apollo (buscas automáticas), reações aos seus próprios posts
(ingestão por colagem) e suas mensagens (exportação oficial). Nenhum depende do Apify.

## 14. 🔴 WhatsApp (Z-API) — construído por inteiro, nunca ligado

**Por que subiu de "opcional" para pendência:** o AI OS tem o canal completo — envio, recebimento em
tempo real, inbox unificada com e-mail, templates, fila de aprovação e agora a **resposta assistida**
(o agente escreve o rascunho, você revisa e envia). Sem a credencial, tudo isso existe e não roda.
O número mostra o tamanho: **204 conversas de e-mail ativas contra 1 de WhatsApp, parada em 07/07**.

**Quem faz:** você. Leva menos de 10 minutos.

**Passo a passo:**
1. Em [z-api.io](https://z-api.io), abra a instância e copie **ID da instância**, **Token** e, se a
   sua conta exigir, o **Client-Token**.
2. No AI OS: **Configurar → Parâmetros e integrações** → provedor **`zapi`** → cole
   `instance_id`, `token` e (se houver) `client_token`.
3. Na Vercel, defina `WHATSAPP_WEBHOOK_KEY` com um valor aleatório e longo. **Sem ela o webhook
   responde 503 e não recebe nada** — é proposital: antes ele aceitava qualquer chamada, e quem
   descobrisse a URL inseria mensagem forjada na sua inbox. Defina a chave ANTES do passo 4.
4. Faça o deploy e, na inbox (**Relacionamento**), clique em **Ativar recebimento** — o AI OS
   registra o webhook na Z-API sozinho, já com a chave.
5. Mande uma mensagem para o número e confirme que a conversa aparece.

**Ligar a resposta assistida (opcional, depois que o canal funcionar):**
Em **Configurar → Agentes de IA**, o agente **Resposta assistida da caixa** existe e está **desligado
de propósito** — um agente que começa a escrever no WhatsApp sem ninguém ter pedido é surpresa no
canal errado. Ligue quando quiser: ele passa a preparar um rascunho a cada mensagem que a triagem
marcar como "precisa de você", e o rascunho espera na conversa. **Nada é enviado sem alguém clicar em
enviar.** A tela de Agentes mostra quantos rascunhos saíram como estavam, quantos foram editados e
quantos foram descartados. O mesmo agente serve o e-mail — e no e-mail ele já pode rodar hoje, sem
depender da Z-API.

## 15. 🟡 E-mail marketing — o disparo já funciona, o retorno não

**O que já funciona sem configurar nada:** montar campanha, usar os modelos, ver a prévia (que é o
HTML real, não uma aproximação) e **enviar teste para você mesmo** — a `RESEND_API_KEY` já está em
produção. O disparo para a lista também funciona.

**Falta uma coisa só:**

1. **`RESEND_WEBHOOK_SECRET`** — sem ele, abertura, clique, bounce e reclamação ficam em **zero** no
   painel da campanha. O e-mail sai; o retorno não volta.

   **O segredo é emitido pelo Resend**, não escolhido por nós — ele assina cada chamada com esse
   valor, e a rota confere. Por isso este item depende de alguém abrir o painel do Resend.

   1. Resend → **Webhooks → Add Endpoint**
      URL: `https://ai-os-sable.vercel.app/api/resend/webhook`
      *(quando o DNS do item 1 subir, trocar para `https://ai-os.salestrack.com.br/api/resend/webhook`
      — o Resend permite editar a URL sem gerar segredo novo.)*
   2. Marcar os cinco eventos: `email.delivered`, `email.opened`, `email.clicked`, `email.bounced`,
      `email.complained`.
   3. Copiar o **Signing Secret** (`whsec_…`) → Vercel → env `RESEND_WEBHOOK_SECRET` (Production) →
      **redeploy** (variável nova só vale a partir do próximo build).

   **O detalhe que costuma passar batido:** abertura e clique dependem de dois interruptores no
   Resend, em **Domains → salestrack.com.br → Open Tracking / Click Tracking**, que vêm
   **desligados**. Com o webhook configurado e esses interruptores desligados, `delivered`, `bounced`
   e `complained` chegam, e `opened`/`clicked` nunca chegam — e a impressão é de que o webhook
   falhou. *Click tracking reescreve os links do e-mail para passarem por um domínio do Resend;
   é o preço de saber quem clicou.*

   *Bounce e reclamação não são só métrica:* eles bloqueiam o endereço para sempre, e é isso que
   protege a reputação do domínio — a mesma que os e-mails transacionais usam.

   **Como conferir que está fechado agora** (é o esperado enquanto a env não existe):
   ```
   curl -s -X POST https://ai-os-sable.vercel.app/api/resend/webhook -d '{}'
   → {"error":"not_configured"}   ·   HTTP 503
   ```
   Depois de configurar, o mesmo comando deve devolver **401** (rota ligada, assinatura inválida).
   Se continuar 503, a variável não chegou no build.
2. ~~**`EMAIL_MARKETING_FROM`**~~ — **decidido em 31/07/2026: não configurar.** As campanhas saem
   de `Salestrack AI <aios@salestrack.com.br>`, o mesmo endereço dos avisos do sistema.

   *O que isso significa, para não ser surpresa depois:* remetente e reputação de entrega são
   compartilhados. Se uma campanha juntar reclamações de spam, quem sente o efeito são também os
   e-mails transacionais — convite de acesso, aviso de proposta lida, contrato assinado. O
   domínio `salestrack.com.br` está verificado no Resend, então trocar depois é só definir a
   variável na Vercel; nenhum código muda. Separar de verdade (isolando reputação) pede um
   subdomínio próprio, tipo `news.salestrack.com.br`, com DNS e verificação novos.

**A lista está vazia, e isso não é um defeito.** Só entra quem **autorizou** receber marketing — e
dado de prospecção (Apollo, coleta pública) **nunca** vira lista de marketing, mesmo com
consentimento registrado. A lista cresce pelos formulários dos sites, onde a pessoa marca a caixa de
aceite. Até lá, dá para montar e testar campanhas à vontade.

## 17. 🟡 Direitos do titular — a porta está aberta, falta divulgar

A página `ai-os.salestrack.com.br/privacidade/direitos` (hoje em
`ai-os-sable.vercel.app/privacidade/direitos`) entrou no ar. Quem pede acesso, correção ou exclusão
dos próprios dados agora abre o pedido sozinho, confirma pelo e-mail e o prazo de 15 dias começa a
correr automaticamente — antes disso, o pedido só existia se alguém transcrevesse à mão um e-mail
que chegou em `aios@salestrack.com.br`.

**Duas coisas que dependem de você:**

1. **Publicar o link nos dois sites.** Dentro do AI OS todas as superfícies já apontam para lá
   (página de inscrição, tela de descadastro, rodapé de campanha, rodapé do Estúdio e o aviso de
   transparência da prospecção). Os sites `salestrack.com.br` e `andrekachan.com.br` são
   repositórios separados e ainda mandam escrever para o encarregado — vale colocar o link no
   rodapé e na política de privacidade dos dois. **É um deploy em cada site; me avise que eu faço.**

2. **Ler a caixa `aios@salestrack.com.br`.** Ela continua sendo canal válido, e quem escrever por
   lá em vez de usar a página não entra no registro sozinho — é preciso abrir o pedido em
   *Configurar › LGPD*. O registro é o que prova que foi atendido no prazo.

**O que já funciona sozinho:** pedido com prazo perto de vencer vira aviso na tela de Hoje, e
prazo vencido vira alerta crítico. O e-mail do encarregado é avisado no instante da confirmação.

## 16. 🟢 Opcionais (só se precisar)
- **Stripe:** cobrança internacional (alternativa à ASAAS). Envs `STRIPE_SECRET_KEY`, `STRIPE_WEBHOOK_SECRET` e `PAYMENT_PROVIDER=stripe`. Só se for cobrar fora do Brasil.

## 18. 🟢 Os dois sites no GitHub — dois repositórios a criar

Nem `salestrack.com.br` nem `andrekachan.com.br` publicam por push: os dois sobem por
`vercel deploy --prod` rodado à mão, porque nenhum dos dois projetos está conectado a um
repositório remoto. Enquanto for assim, não há histórico do que foi ao ar nem como voltar atrás.

**Já feito:** `~/salestrack-website` virou repositório git (não era) e ganhou o primeiro commit, com
a identidade `andre.kachan@salestrack.com.br` — o endereço que a Vercel exige, e cuja ausência foi
o que bloqueou o deploy do outro site. Os dois foram auditados: nenhuma chave em arquivo nem no
histórico.

**O que falta, e é seu:** criar em github.com/new, na conta `salestrackapp`, dois repositórios
**privados**, sem README/.gitignore/licença (o conteúdo já existe no disco):

- `salestrack-website`
- `andrekachan-website`

O token no Keychain é um fine-grained PAT com escopo só do `ai-os` — ele não cria repositório, e é
por isso que este passo não pôde ser automatizado. Criados os dois, eu ligo os remotos, subo os
históricos e conecto os projetos da Vercel, e push volta a publicar sozinho.

**Nada quebra enquanto não for feito** — os dois sites seguem publicando pela CLI.

---

## Referência rápida de status dos envs (Vercel Production)
**Já configurado:** Supabase (URL/anon/service), NEXT_PUBLIC_SITE_URL, RESEND_API_KEY, MAILERLITE_API_KEY/GROUP_ID, ADMIN_EMAILS, ASAAS_API_KEY/ENV, PAYMENT_PROVIDER, DOCUSIGN_USER_ID/ACCOUNT_ID/BASE_URL, **CALENDLY_WEBHOOK_TOKEN**, **READAI_WEBHOOK_TOKEN**.
**Falta setar:** `ASAAS_WEBHOOK_TOKEN`, `EMAIL_FROM`, `DOCUSIGN_INTEGRATION_KEY`, `DOCUSIGN_PRIVATE_KEY`, `SALESTRACK_CNPJ`, `SALESTRACK_ENDERECO`, **`WHATSAPP_WEBHOOK_KEY`** (item 14). (Opcionais: `DOCUSIGN_CONNECT_SECRET`, Stripe, `MFA_ENFORCE`, `LINKEDIN_ACCESS_TOKEN`.)

**Segredos que ficam na tabela `integration_secrets`, não em env:** `apollo` (✅ configurado),
`zapi` (⏳ pendente — item 14), `apify` (⏳ pendente — item 13), `linkedin_li_at` (⏳ opcional, item 13).

**agent-control (projeto separado):** `AGENT_CONTROL_URL`, `AGENT_CONTROL_SERVICE_KEY` — item 12.

**Banco de RH (projeto separado):** `RH_SUPABASE_URL`, `RH_SERVICE_ROLE_KEY`, `RH_ENCRYPTION_KEY`,
`RH_CPF_SALT` — todas pendentes, item 11.

**Como setar um env:** `npx vercel env add NOME production` (cola o valor) → depois `npx vercel deploy --prod --yes`. Posso fazer isso por você quando me passar os valores.
