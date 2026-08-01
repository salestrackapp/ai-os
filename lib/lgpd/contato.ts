/**
 * O endereço de contato do encarregado de dados (DPO) e da via de saída.
 *
 * ── Por que uma constante ─────────────────────────────────────────────────────────────────────
 * Ele aparece em oito lugares: formulário de inscrição, rodapé de e-mail de marketing, rodapé do
 * Estúdio, aviso de transparência da prospecção, página de descadastro e tela de LGPD. Espalhado
 * como literal, trocá-lo vira uma caçada — e o que sobrar desatualizado é justamente um canal que
 * a LGPD obriga a manter aberto (art. 41, §2º).
 *
 * Módulo puro: é lido tanto por página quanto por gerador de e-mail.
 *
 * ── O que este endereço promete ───────────────────────────────────────────────────────────────
 * Quem escreve para cá está exercendo um direito com PRAZO: pedido de titular tem 15 dias para ser
 * respondido. A caixa precisa ser lida por gente, não só usada para enviar.
 */
export const EMAIL_ENCARREGADO = "aios@salestrack.com.br";

/** Como o encarregado é nomeado nos textos públicos. A LGPD exige identificação, não só um e-mail. */
export const NOME_ENCARREGADO = "André Kachan";

/**
 * A via de exercício dos direitos — a página, não a caixa de e-mail.
 *
 * As duas continuam abertas de propósito, mas não são equivalentes: o e-mail depende de alguém
 * transcrever o pedido à mão para o prazo de 15 dias começar a contar, e um pedido esquecido na
 * caixa é indistinguível de um pedido que nunca chegou. Pela página o pedido entra sozinho, com
 * prazo, e vira alerta se ninguém responder. Por isso é ela que vai na frente em todo texto novo.
 */
export const CAMINHO_DIREITOS = "/privacidade/direitos";

/** A política de privacidade — o "o que vocês fazem", ao lado do "quero mexer nos meus dados". */
export const CAMINHO_PRIVACIDADE = "/privacidade";

/** Absoluta, para quando o texto sai do domínio: e-mail, PDF, mensagem de prospecção. */
export function urlDireitos(): string {
  const base = process.env.NEXT_PUBLIC_SITE_URL ?? "https://ai-os-sable.vercel.app";
  return `${base.replace(/\/$/, "")}${CAMINHO_DIREITOS}`;
}
