/**
 * O que conta como dado corporativo.
 *
 * Decisão do André (2026-07-30): prospecção opera **somente com dado corporativo**, e o que
 * decide isso é o DOMÍNIO DO E-MAIL. Não é uma etiqueta informativa — é o critério de entrada.
 * O motivo é o balanceamento do legítimo interesse: abordar alguém no papel profissional dele é
 * defensável; alcançar a caixa pessoal da mesma pessoa não é a mesma coisa, e é onde a base cai.
 * Telefone não é filtrado (ver `telefoneCorporativo`).
 *
 * Espelha `fn_email_corporativo` / `fn_telefone_corporativo` no banco. As duas existem de
 * propósito: o gatilho é a garantia (vale para PostgREST direto, Server Action e tela), e esta
 * versão é para dizer ao operador QUAIS linhas foram recusadas, e por quê, sem derrubar o lote
 * inteiro numa exceção. Divergir seria bug — o teste em `tests/lgpd-corporativo.test.ts` trava
 * as duas listas contra a mesma tabela de casos.
 *
 * Sem dependência de `server-only`: roda no cliente para avisar antes de mandar.
 */

/** Provedores de caixa pessoal. Domínio aqui = a pessoa, não a empresa. */
export const PROVEDORES_PESSOAIS = [
  "gmail.com", "googlemail.com", "hotmail.com", "hotmail.com.br", "outlook.com", "outlook.com.br",
  "live.com", "msn.com", "yahoo.com", "yahoo.com.br", "ymail.com", "icloud.com", "me.com", "mac.com",
  "aol.com", "protonmail.com", "proton.me", "tutanota.com", "gmx.com", "zoho.com", "mail.com",
  "bol.com.br", "uol.com.br", "terra.com.br", "ig.com.br", "globo.com", "r7.com", "oi.com.br",
  "yandex.com", "qq.com", "163.com", "126.com",
] as const;

export function emailCorporativo(email: string | null | undefined): boolean {
  const e = (email ?? "").trim().toLowerCase();
  if (!e || e.indexOf("@") < 1) return false;
  const dominio = e.split("@")[1] ?? "";
  return !PROVEDORES_PESSOAIS.includes(dominio as (typeof PROVEDORES_PESSOAIS)[number]);
}

/**
 * Telefone não é filtrado desde 2026-07-30 (decisão do André).
 *
 * O critério de dado corporativo é o DOMÍNIO DO E-MAIL, que é onde está a linha entre o papel
 * profissional e a vida privada. O número vem do registro profissional da fonte licenciada — é o
 * telefone que a pessoa usa para trabalhar, não um número que descobrimos por fora.
 *
 * A função permanece (sempre verdadeira) em vez de ser removida: é o ponto único onde um filtro
 * volta a existir, se algum dia for preciso. Espelha `fn_telefone_corporativo` no banco.
 */
export function telefoneCorporativo(_tel: string | null | undefined): boolean {
  return true;
}

/** Motivo legível da recusa, para a tela de importação. Devolve null quando o dado passa. */
export function motivoRecusa(email: string | null | undefined, tel?: string | null): string | null {
  if (email && !emailCorporativo(email)) {
    return `${email} é caixa pessoal (${email.split("@")[1]}). A prospecção só trata dado corporativo.`;
  }
  if (!telefoneCorporativo(tel)) {
    return "Telefone recusado pela regra vigente.";
  }
  return null;
}
