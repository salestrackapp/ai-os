# Launch Readiness — AI OS / Salestrack AI (fecha Onda R5 e o roadmap)

> Estado de prontidão para operação. Fecha a **Onda R5** (acabamento) e o **roadmap**. Nada novo depois daqui — só operação e manutenção.

## Invariantes (gates de projeto) — todos ✅
| Invariante | Como é garantido | Status |
|---|---|---|
| **RLS por org** | Políticas por org + `test:rls` como gate de deploy | ✅ |
| **Auditoria em escritas** | Triggers/registro de auditoria nas mutações | ✅ |
| **Segredos server-only** | Sem chave em client bundle; adapters server-side | ✅ |
| **Degradação graciosa** | Sem credencial → nada quebra, retorno cedo | ✅ |
| **Aditivo / reversível** | Sem DROP; migrations só adicionam | ✅ |
| **IA rascunha → humano aprova → sistema publica** | Portão de aprovação + imutabilidade após aprovar | ✅ |
| **Imutável após aprovação** | Trava de conteúdo; mudança exige nova versão | ✅ |
| **PII só no envio** | Nunca gravada no ativo; render impessoal | ✅ |
| **Consentimento obrigatório** | Opt-in WhatsApp; envio bloqueado sem consentimento | ✅ |
| **Um design v2** | Marca = assinatura; guard-rails `marca-dupla`/`tema-não-vaza` | ✅ |
| **Sem mensalidade de plataforma** | `platformSubscriptionEnabled()` (flag), AI OS entrega ofertas | ✅ |

## QA desta onda
- **Visual:** `docs/visual-qa.md` — v5 100% tokens; telas legadas = coexistência aditiva isolada por _chrome_.
- **Performance:** `docs/perf-qa.md` — RSC-first, fetch paralelo, render on-demand, ~102 kB compartilhado.
- **Acessibilidade:** `docs/a11y-qa.md` — AA nas telas v5; `aria-label` fechados em campos placeholder-only.

## Pendências residuais (não-bloqueantes)
1. **Preços em `needs_review`** — catálogo com itens marcados para revisão humana antes de propor a clientes. Comportamento correto: exige aprovação, não vaza preço não-revisado.
2. **Credenciais de canal ausentes** — WhatsApp (Z-API) e e-mail (Resend) sem chave em produção → **degradação graciosa** (nada quebra; envios ficam em estado manual/bloqueado). Ver `docs/CONFIG_PENDENTE.md`.
3. **Credenciais de render de vídeo** — sem chave → linha de vídeo entrega roteiro/storyboard; render fica pendente. Graceful.
4. **DNS `ai-os.salestrack.com.br`** — apontamento pendente; app LIVE em `ai-os-sable.vercel.app` enquanto isso.
5. **Telas legadas do portal/admin** — migração residual para v5 (11 telas de portal + algumas admin), coexistência isolada. Não bloqueia operação.
6. **Cron diário (Hobby)** — cadência sub-diária exige upgrade de plano; régua atual opera bem em diário.

## Config de produção
Checklist completo em `docs/CONFIG_PENDENTE.md` (Supabase Auth URLs, webhooks Read AI/Calendly/ASAAS, EMAIL_FROM, chaves Docusign, dados de contrato).

## Veredito
**Pronto para operar.** Todos os invariantes verdes; pendências são de configuração/credencial (degradação graciosa cobre a ausência) e migração residual de UI — nenhuma bloqueia o uso. Roadmap encerrado na Onda R5.
