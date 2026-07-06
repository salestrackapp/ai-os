# AI OS · Integração das Sessões ao Vivo (webhooks nativos)

Modelo escolhido: **webhooks nativos** — o app recebe os eventos direto das plataformas, 24/7, sem depender de nenhuma sessão do Claude. Os tokens são segredos compartilhados (query `?token=`) e estão configurados como env vars **na Vercel (Production)** — não ficam neste repositório.

## Endpoints (produção)
- Calendly → `POST https://ai-os-sable.vercel.app/api/calendly/webhook?token=<CALENDLY_WEBHOOK_TOKEN>`
- Read AI  → `POST https://ai-os-sable.vercel.app/api/readai/webhook?token=<READAI_WEBHOOK_TOKEN>`

Os valores dos tokens estão na Vercel (Settings → Environment Variables) e no `.env.local`. Sem token/token errado → **401**. Com token → processa.

## Ciclo
1. **Calendly** dispara `invitee.created` → o app resolve a org pelo e-mail do participante e cria a **sessão `agendada`** (título, horário, link da sala, `calendly_ref`).
2. A reunião acontece no **Google Meet** (link vindo do Calendly/convite).
3. **Read AI** grava/transcreve e, ao terminar, dispara o webhook de relatório → o app localiza a sessão (por `meet_link` → `readai_ref` → e-mail de participante) e a marca **`realizada`**, gravando **resumo, gravação e action items**, e **debita 1 crédito** do tipo.

Se o e-mail do participante não casar com nenhuma org, o evento é registrado em auditoria (`session.calendly_unmatched` / `session.readai_unmatched`) e nada quebra — o admin pode lançar/fechar a sessão manualmente no programa.

## Como ligar em cada plataforma

### Read AI
1. read.ai → **Integrations → Webhooks** (ou API/Developer).
2. Adicionar endpoint: a URL do Read AI acima (com `?token=`).
3. Evento: relatório de reunião / *meeting end report*.
> O casamento com o cliente é por **e-mail do participante**: o cliente precisa entrar na reunião com o mesmo e-mail que usa no portal (ou o admin fecha a sessão manualmente).

### Calendly
1. Requer plano com **Webhooks** (Standard+). Criar a subscription via API:
   ```bash
   curl -X POST https://api.calendly.com/webhook_subscriptions \
     -H "Authorization: Bearer <SEU_CALENDLY_PERSONAL_TOKEN>" \
     -H "Content-Type: application/json" \
     -d '{
       "url": "https://ai-os-sable.vercel.app/api/calendly/webhook?token=<CALENDLY_WEBHOOK_TOKEN>",
       "events": ["invitee.created"],
       "organization": "<sua_org_uri>",
       "scope": "organization"
     }'
   ```
2. Garantir que os eventos do Calendly gerem link do **Google Meet** (Calendly → Event type → Location → Google Meet).

## Fallback manual (sempre disponível)
Mesmo com os webhooks ligados, o admin pode, em **/admin/programas/[id] → Sessões ao Vivo & créditos**: conceder créditos, agendar sessão manual e **fechar sessão** (resumo + gravação, debitando crédito). É o fallback quando o casamento automático não acontece.

## Rotação de token
Gerar novo: `node -e "console.log(require('crypto').randomBytes(24).toString('base64url'))"`; atualizar na Vercel (`vercel env rm` + `vercel env add ... production`), redeployar, e atualizar a URL na plataforma.
