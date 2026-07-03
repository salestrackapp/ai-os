# AI OS · Relatório da Fase 3 — Fechar (Contratos + Billing + Kickoff)

**Status: implementada, build verde, RLS 18/18, e2e de idempotência ok, deploy no ar.**
URL: **https://ai-os-sable.vercel.app** · Contratos `/admin/contratos` · Financeiro `/admin/financeiro`.

> Numeração: migração **006** (`006_contratos_billing.sql`) — as 004/005 já eram da Fase 2.

## O que foi construído
- **Migration 006:** `contracts` (content_html, sent_at, signer_name/email, signed_manually), tabela `contract_events`, `invoices` (kind, installment_n, installments_total, contract_id, hosted_url), `subscriptions.contract_id`, `projects` (kickoff_checklist, status), bucket de storage `contratos`.
- **Contrato a partir da proposta aprovada:** na proposta `aprovada` → **Gerar contrato** → `lib/contract-html.ts` produz a **minuta completa** (partes, objeto com colunas AK×ST, investimento parcelado + mensalidade AI OS com reajuste IPCA, cláusula de plataforma Claude v4, créditos de sessão, vigência, confidencialidade/PI, LGPD, foro SP). Lista `/admin/contratos` + detalhe `/admin/contratos/[id]` (preview em iframe, eventos, ações, aviso jurídico no rodapé do admin).
- **Assinatura — Docusign + fallback manual:** `lib/docusign.ts` (JWT Grant via `node:crypto`, envelope a partir do HTML, âncora `/assinatura_contratante/`); botão **Enviar para assinatura**; webhook `POST /api/docusign/webhook` (HMAC, `envelope-completed` → baixa PDF → Storage → assina + `content_hash` do PDF → kickoff; `recipient-declined` → cancelado). **Sem envs Docusign:** botão vira **Registrar assinatura manual** (upload do PDF + nome/e-mail → mesmo update de assinatura + `signed_manually` + kickoff).
- **Billing — Stripe + fallback manual:** `lib/stripe.ts` (REST via fetch); no kickoff cria/reusa Customer, **N faturas de implantação** (send_invoice, vencimentos mensais) e a **assinatura mensal** da Plataforma AI OS. Webhook `POST /api/stripe/webhook` (assinatura Stripe; `invoice.paid`→paga, `invoice.payment_failed`→WhatsApp admin, `customer.subscription.updated/deleted`→status). **Sem envs Stripe:** kickoff grava faturas/assinatura no banco como *aberta/ativa* (acompanhamento manual) e a tela **Financeiro** tem **Registrar fatura/assinatura manual** e **marcar paga**.
- **Financeiro `/admin/financeiro`:** cards **MRR**, **A receber**, **Em atraso** (âmbar) e **Clientes ativos**; tabelas de Assinaturas e Faturas (com link Stripe quando houver).
- **Kickoff idempotente `lib/kickoff.ts`:** `runKickoff(contractId)` executa em ordem e grava cada passo no `projects.kickoff_checklist`: `project.created → org.activated → stack.registered → session_credits.seeded → billing.started → notified`. Reexecutar **não duplica** (guardas de existência + upserts). Falha num passo → evento `kickoff_erro`, não desfaz anteriores, e o detalhe do contrato mostra **Reexecutar kickoff**.

## Decisões documentadas
- **Documento Docusign:** enviado como **HTML** (Docusign aceita `fileExtension: html`), com a âncora de assinatura embutida. Se a conta exigir PDF, adicionar conversão HTML→PDF antes do envelope.
- **Visual da minuta:** papel claro (creme/branco) com tipografia da marca e acentos gold — legível/imprimível para assinatura (mantém a identidade sem o navy escuro, inadequado para impressão).
- **Créditos de sessão:** semeados apenas de itens **André Kachan** (sessões ao vivo), evitando falso-positivo com produtos de execução (ex.: "AI Sprint").

## Configuração para produção (Stripe BR — o que ativar no dashboard)
- No Stripe: ativar **Boleto** e **Pix** (além de cartão) em *Settings → Payment methods*; conta em **BRL**; configurar o **webhook** para `/api/stripe/webhook` e copiar o `STRIPE_WEBHOOK_SECRET`.
- Docusign: começar na **conta demo** (`DOCUSIGN_BASE_URL=https://demo.docusign.net/restapi`), conceder consentimento ao Integration Key (JWT), e configurar o **Connect** apontando para `/api/docusign/webhook` com `DOCUSIGN_CONNECT_SECRET`.
- Envs novas documentadas no `.env.example` (Docusign, Stripe, `SALESTRACK_CNPJ`, `SALESTRACK_ENDERECO`).

## Roteiro de teste ponta a ponta (manual)
1. **Aprovar** uma proposta (portal `/p/{token}` → Aprovar).
2. Na proposta → **Gerar contrato** → confira a minuta (cláusulas de plataforma e mensalidade) em `/admin/contratos/[id]`.
3. **Assinar:**
   - *Com Docusign (demo):* **Enviar para assinatura** → assinar no e-mail → o webhook marca assinado e dispara o kickoff.
   - *Sem Docusign:* **Registrar assinatura manual** → suba um PDF → marca assinado (com hash) e dispara o kickoff.
4. **Kickoff:** veja o **checklist** ✓ no contrato (projeto criado, org onboarding, stack, créditos, billing, notificado). Clique **Reexecutar kickoff** → nada duplica.
5. **Financeiro:** `/admin/financeiro` mostra as **N faturas** de implantação (vencimentos mensais) e a **assinatura** ativa; **MRR** correto; marque uma fatura como paga.
6. **Trava:** tente editar o contrato assinado → **erro do banco** (imutável); `content_hash` preenchido.

## Verificações automatizadas
- **build** verde · **`npm run test:rls` 18/18** (novos: cliente de outra org não lê `contracts`/`invoices`/`subscriptions`; anônimo não lê nenhum).
- **e2e de idempotência (service role):** rodar o kickoff **2×** mantém **1 projeto, 3 faturas, 1 assinatura** e créditos estáveis.

## Pendências / ressalvas
- **Docusign/Stripe ao vivo** não foram testados aqui (sem contas/credenciais) — o código está atrás de `*_configured()` e documentado para homologação; o **fluxo manual equivalente foi testado** e é o caminho degradado.
- **Aviso jurídico:** a minuta é template base — validar com assessoria jurídica antes do primeiro envio real (aviso fixo no admin).
- **Meta:** `docs/META_VERIFICACAO.md` para iniciar a verificação do Business Manager agora (prazo 3–10 dias úteis).

## Fora de escopo (próximas fases)
Portal do cliente, conector MCP, Playbook, Sessões (F4) · Open API e multi-IA (F5) · white-label N2/N3 e Meta Cloud API (F6) · dunning por agente (F5/6 — nesta fase só alerta).
