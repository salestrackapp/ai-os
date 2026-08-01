/**
 * O texto que a pessoa lê ao marcar a caixa — e que fica guardado como evidência.
 *
 * ── Por que num módulo só ─────────────────────────────────────────────────────────────────────
 * Ele aparece em dois lugares: no rótulo da caixa (navegador) e na linha gravada em
 * `consent_records` (servidor). Se fossem duas cópias, bastaria alguém editar uma para a evidência
 * deixar de corresponder ao que a pessoa realmente leu — e é exatamente essa correspondência que
 * faz o registro valer alguma coisa numa auditoria. Módulo puro, sem "server-only", para os dois
 * lados importarem o mesmo.
 *
 * ── Por que a finalidade é descrita por extenso ───────────────────────────────────────────────
 * "Receber e-mails da Salestrack" não diz sobre o quê. A LGPD pede finalidade determinada (art. 6º,
 * I), e quem consente precisa saber o que vai chegar. Listar as áreas é mais honesto e é o que
 * evita a sensação de assunto trocado no meio do caminho.
 *
 * ── Mudar este texto tem consequência ─────────────────────────────────────────────────────────
 * Quem já consentiu, consentiu sob a redação da época — que continua gravada na própria linha de
 * `consent_records`, junto com a data. Ampliar a finalidade aqui NÃO amplia retroativamente o que
 * essas pessoas autorizaram; para isso seria preciso pedir de novo.
 */
export const TEXTO_ACEITE_NEWSLETTER =
  "Quero receber os e-mails da Salestrack AI sobre IA aplicada ao dia a dia das empresas — "
  + "vendas, marketing, operações, atendimento, backoffice, governança e formação de times. "
  + "Sei que posso sair a qualquer momento pelo link no rodapé de cada mensagem.";
