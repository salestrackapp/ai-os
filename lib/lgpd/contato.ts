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
