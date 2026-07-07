# Ativar WhatsApp + Gmail (passo a passo das credenciais)

> Onde colar tudo: **Admin → Configurações → Integrações** (`/admin/configuracoes/parametros?cat=integracoes`). Os campos são **write-only** (nunca exibidos de volta) e valem **na hora** (sem redeploy). Depois de salvar, aperte **Testar conexão**.

## 1) WhatsApp (Z-API)
1. Entre em **app.z-api.io**, crie uma **instância** e conecte seu número lendo o **QR Code** no WhatsApp (Aparelhos conectados).
2. Na página da instância, copie **ID da instância** e **Token da instância** (é só isso que precisa para enviar).
3. No Console → Integrações → **Z-API (WhatsApp)**, preencha:
   - **ID da instância** · **Token da instância**
   - **Client-Token** — **opcional**. Só preencha se você tiver ativado a *segurança de conta* na Z-API (fica em **Conta → Segurança → Token de segurança da conta**, não na página da instância). Se não usa, **deixe vazio**.
   - **Números admin** (que recebem as notificações internas), separados por vírgula, com DDI: `5531999999999,5531988888888`
4. Salvar → **Testar conexão**. Fica verde quando as credenciais autenticam (ID + Token corretos). Se aparecer "inválida", confira o ID e o Token; o Client-Token não é obrigatório.

## 2) Gmail (enviar + ler pela sua caixa)
No **Google Cloud Console** (console.cloud.google.com), com a conta do e-mail que vai enviar:
1. **Criar projeto** (ou usar um existente).
2. **APIs e serviços → Biblioteca**: ativar **Gmail API** e **Google Calendar API**.
3. **Tela de consentimento OAuth**: tipo *Externo*, publique (ou deixe em teste e adicione seu e-mail como testador). Escopos: `.../auth/gmail.send`, `.../auth/gmail.readonly`, `.../auth/calendar.readonly`.
4. **Credenciais → Criar credenciais → ID do cliente OAuth**, tipo **App para computador** (Desktop) — mais simples para gerar o refresh token. Anote **Client ID** e **Client Secret**.
5. **Gerar o Refresh Token** (uma vez). Atalho recomendado: **OAuth 2.0 Playground** (developers.google.com/oauthplayground):
   - Engrenagem (⚙) → marque **Use your own OAuth credentials** → cole Client ID/Secret.
   - Em *Step 1*, cole os escopos acima → **Authorize APIs** → faça login com a conta remetente e autorize.
   - Em *Step 2*, **Exchange authorization code for tokens** → copie o **Refresh token**.
6. No Console → Integrações → **Google OAuth (Gmail/Calendar)**, preencha:
   - OAuth Client ID · OAuth Client Secret · Refresh Token · **E-mail remetente** (o Gmail que envia).
7. Salvar → **Testar conexão** (troca o refresh token por um access token — verde = ok).

> Observação de segurança: eu (assistente) **não** digito chaves. Você cola tudo você mesmo nessa tela; os valores nunca me são exibidos.

## 3) Como o sistema usa
- **E-mail dos clientes** (régua/ativação) passa a sair **pela sua caixa do Gmail** automaticamente quando o Google está configurado (fallback Resend, senão modo manual).
- **Caixa do cliente** (admin): na ficha do cliente → **Caixa de e-mail** você vê as conversas recentes do Gmail com os contatos dele e envia a ativação/boas-vindas pela sua conta.
- **WhatsApp**: a régua e as notificações usam a Z-API; envio a cliente exige **opt-in** (consentimento).
- **Precedência das chaves:** Console (o que você colar) → variável de ambiente. Dá para migrar para env depois sem mudar código.

## 4) Limites e bom senso
- Gmail: ~**500 envios/dia** e melhor para **1-a-1** (ativação). Para volume/campanha, use Resend/MailerLite.
- Sem credencial, **nada quebra**: os envios ficam em **modo manual** (conteúdo pronto para copiar) e o app segue funcionando.
