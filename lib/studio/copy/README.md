# Mensagens & Copy (R3.6) — Família D · fronteira com a Comunicação (R4)

O Estúdio **produz** a copy por canal; a Comunicação (R4) **orquestra** o envio. Aqui nada é enviado.

## Canais (linhas)
`post` · `mensagem` · `whatsapp` · `email_mkt` (em `lib/studio/lines/mensagens.ts`). Cada um tem
`contentSchema` com **regras de canal** (`copy/channel.ts`: limites, WhatsApp texto-puro) e gera 1–2 **variantes**.

## Render por canal
- **E-mail** → `render/email.ts` (`buildEmailHtml`): HTML **MailerLite-ready** (CSS inline, 600px, cabeçalho ink v2 + acento, CTA violeta, rodapé com `{{unsubscribe}}` e `{{company_address}}`).
- **WhatsApp/Mensagem/Post** → `render/message.ts` (`buildMessageHtml`): preview v2 com `{{variaveis}}` destacadas, hashtags, sugestão de arte (post → R3.7) e variantes.
- `buildDeliverableHtml` detecta `content.email`/`content.message` e delega.

## Merge fields & PII
- Variáveis `{{nome}}` são **extraídas e expostas** (`content.message.variaveis` / `content.email.variaveis`).
- Na **aprovação**, `engine.approveDeliverable` roda `detectPII` para linhas da família `mensagens` e **bloqueia** e-mail/telefone/CPF reais — só placeholders passam. O preenchimento é no envio (R4).

## Handoff para o R4 (o que a Comunicação lê)
Ao aprovar, a peça fica `comm_eligible = true` com `comm_channel` (post|whatsapp|email|generic). O R4 descobre os
ativos elegíveis e lê do `content`:
- `content.message` → `{ canal, plataforma?, texto, variaveis[], hashtags?, sugestao_visual?, cta?, variantes? }`
- `content.email` → `{ assunto, preheader?, corpo[], cta?, variaveis[] }`

O R4 só orquestra **ativos aprovados**; preenche as `variaveis` no momento do envio. **Cadência/agendamento/envio = R4.**
