# AI OS · O que ainda falta configurar

> Guia único do que **está pendente** para o sistema rodar 100% em produção.
> Ordem = prioridade (o topo destrava mais coisa). Cada item diz **por que importa**, **quem faz** e o **passo a passo**.
> App em produção: **https://ai-os-sable.vercel.app** · Domínio final: **ai-os.salestrack.com.br** (pendente DNS).
> Envs ficam em: Vercel → projeto `ai-os` → **Settings → Environment Variables** (sempre em *Production*). Depois de mudar env, **fazer um redeploy**.

Legenda: 🔴 destrava função · 🟡 melhora/recomendado · 🟢 opcional.

---

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

## 2. 🔴 Liberar o domínio no Supabase Auth
**Por que:** sem isso, os e-mails de login/recuperação de senha apontam para a URL errada e o acesso quebra.
**Quem faz:** você, no painel Supabase (não há automação para isso).
**Passo a passo:**
1. Supabase → projeto `ai-os` → **Authentication → URL Configuration**.
2. **Site URL:** `https://ai-os.salestrack.com.br` (enquanto o domínio não sobe, use `https://ai-os-sable.vercel.app`).
3. **Redirect URLs:** adicione `https://ai-os-sable.vercel.app/**` **e** `https://ai-os.salestrack.com.br/**`.
4. Salvar.

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

## 9. 🟢 Segurança extra (MFA) — quando quiser
**Por que:** já existe suporte a MFA (2 fatores) para o admin; está **desligado** por padrão para não te travar.
**Passo a passo:**
1. Cadastre seu 2º fator em **Admin → Configurações** (Segurança).
2. Só depois, para **exigir** MFA de todos os admins: Vercel → env **`MFA_ENFORCE=true`** → redeploy.

## 10. 🟢 Opcionais (só se precisar)
- **WhatsApp (Z-API):** notificações por WhatsApp. Envs `WHATSAPP_PROVIDER`, credenciais Z-API e `WHATSAPP_WEBHOOK_KEY`. Sem isso, o canal fica em modo degradado (não envia).
- **Stripe:** cobrança internacional (alternativa à ASAAS). Envs `STRIPE_SECRET_KEY`, `STRIPE_WEBHOOK_SECRET` e `PAYMENT_PROVIDER=stripe`. Só se for cobrar fora do Brasil.

---

## Referência rápida de status dos envs (Vercel Production)
**Já configurado:** Supabase (URL/anon/service), NEXT_PUBLIC_SITE_URL, RESEND_API_KEY, MAILERLITE_API_KEY/GROUP_ID, ADMIN_EMAILS, ASAAS_API_KEY/ENV, PAYMENT_PROVIDER, DOCUSIGN_USER_ID/ACCOUNT_ID/BASE_URL, **CALENDLY_WEBHOOK_TOKEN**, **READAI_WEBHOOK_TOKEN**.
**Falta setar:** `ASAAS_WEBHOOK_TOKEN`, `EMAIL_FROM`, `DOCUSIGN_INTEGRATION_KEY`, `DOCUSIGN_PRIVATE_KEY`, `SALESTRACK_CNPJ`, `SALESTRACK_ENDERECO`. (Opcionais: `DOCUSIGN_CONNECT_SECRET`, WhatsApp/Z-API, Stripe, `MFA_ENFORCE`.)

**Como setar um env:** `npx vercel env add NOME production` (cola o valor) → depois `npx vercel deploy --prod --yes`. Posso fazer isso por você quando me passar os valores.
