import { registerLine } from "../define-line";
import { dicaLine } from "./dica";
import { documentosLines } from "./documentos";
import { apresentacoesLines } from "./apresentacoes";
import { formacaoLines } from "./formacao";
import { mensagensLines } from "./mensagens";
import { arteLines } from "./arte";
import { videoLines } from "./video";

/** Catálogo completo do Estúdio (R3.2) — todas as famílias registradas sobre o núcleo R3.1. */
export const LINES = [
  dicaLine,
  ...documentosLines,
  ...apresentacoesLines,
  ...formacaoLines,
  ...mensagensLines,
  ...arteLines,
  ...videoLines,
];

LINES.forEach((l) => registerLine(l));
