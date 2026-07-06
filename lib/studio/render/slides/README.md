# Motor de slides (R3.4) — Apresentações + base reutilizável

Um deck é `{ title, slides[] }` (ver `Deck`/`DeckSlide` em `lib/deliverables/types.ts`). Cada slide tem
um `layout` (biblioteca em `layouts.ts`) + campos + `notes` (notas do apresentador). Sai em **PPTX**
(`deckToPptx`) e **preview HTML** (`deckToHtml`), sempre no design **Salestrack AI v2** + identidade do programa.

## Layouts disponíveis
`capa · divisor · conteudo · estatistica · citacao · comparacao · imagem · encerramento` (todos v2).

## Como a linha "Apresentação" usa
`lib/studio/lines/apresentacoes.ts` → `apresentacaoLine`: a IA gera `{ titulo, slides[] }` (roteiro + conteúdo
+ notas), `toContent` devolve `content.deck`, e o pipeline (`render/index` → `htmlToPptx`/`buildDeliverableHtml`)
detecta `content.deck` e chama o motor. Estatística só com número real (RAG/`studioExtraContext`).

## Como a FORMAÇÃO (R3.5) reaproveita
Monte um deck multi-parte com `composeDeck(title, sections)` — junta blocos de slides preservando **uma capa**
e a numeração. Helper pronto: `moduleDeck(titulo, partes)` (abertura + módulos + encerramento).

```ts
import { moduleDeck, slideDivisor, slideConteudo } from "@/lib/studio/lines/apresentacoes";
import { slideEstatistica } from "@/lib/studio/render/slides/layouts";

const deck = moduleDeck("Curso de IA na Prática", [
  [slideDivisor("Módulo 1 · Fundamentos"), slideConteudo("Bom prompt", { bullets: ["Contexto", "Objetivo"] })],
  [slideDivisor("Módulo 2 · Aplicação"), slideEstatistica({ value: "3", label: "receitas em uso" })],
]);
// deck → guardar em content.deck de um entregável (kind apresentacao) → PPTX + preview pelo mesmo motor.
```

Regra: a Formação **compõe** decks; não reimplementa render. Um motor, muitos usos.
