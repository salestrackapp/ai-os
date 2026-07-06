# Auditoria de simplicidade (R5.2)

Medição na UI real dos **caminhos de ouro**. Persona-alvo: quem **não domina IA** e cansa de plataformas.
Regra do passe: **aditivo** — nenhuma funcionalidade removida; só menos cliques, menos jargão, menos desordem.

## 1 · Cliques-para-concluir (antes → depois)

| Caminho de ouro | Cliques antes | Campos à vista antes | Cliques depois | Campos à vista depois | O que mudou |
|---|---|---|---|---|---|
| **Admin · Produzir + aprovar um entregável** | 3 (tipo¹ + cliente + Rascunhar + Aprovar) | 5 (tipo, cliente, marca, foco, botão) | **2** (cliente pré-selecionado quando há 1) | **2** (o que produzir, cliente) | Cliente único pré-selecionado; marca/foco recolhidos em "Mais opções"; entregável já nasce "em revisão" → aprova direto |
| **Admin · Ativar a régua** | 1 (Criar régua padrão) | — | **1** | — | Formulário "Adicionar passo" (7 campos) recolhido por padrão → tela mínima |
| **Admin · Cadastrar cliente** | ~4 (fluxo Fase 8) | vários | ~4 | vários | Baseline (fora do escopo deste passe; fluxo maduro, não mexido p/ evitar regressão) |
| **Admin · Criar + fechar proposta** | ~5 (fluxo F2/F3) | vários | ~5 | vários | Baseline (fora do escopo; funil comercial maduro) |
| **Portal · Entender a Jornada** | 0 (é a tela inicial) | — | 0 | — | Já mínimo; "Você está aqui" em destaque |
| **Portal · Ver resultados** | 1 (Visão geral) | — | 1 | — | Já mínimo |

¹ "tipo de produção" já vinha com default (Dica do programa) → 0 clique efetivo.

**Resumo:** os dois caminhos que este passe tocou (produzir+aprovar, ativar régua) ficaram **mais curtos e mais limpos**
(produção: 5→2 campos à vista, 3→2 cliques com cliente único; régua: 7 campos densos → recolhidos). Os fluxos comerciais
(cadastrar/proposta) ficam como baseline — maduros e fora do escopo desta varredura, para não arriscar regressão.

## 2 · Inventário de jargão (antes → depois)

| Jargão (antes) | Onde | Reescrita (depois) |
|---|---|---|
| "R4.3", "R4.2", "R3.3/R3.4…" (códigos internos) | Comunicação, detalhe do entregável | **removidos** das telas (viram PT simples) |
| "ativo do Estúdio", "ativo (elegível)" | Comunicação, envio de teste | "**material**" / "material aprovado" |
| "modo supervisionado" | Fila de envio | "por padrão, **você aprova antes de sair**" |
| "elegível para orquestração" | Estúdio/Comunicação | "**pronto para a Comunicação enviar**" |
| "Organização" | Estúdio (form) | "**Cliente**" |
| "Tipo de produção" | Estúdio (form) | "**O que produzir**" |
| "Criar manual" | Estúdio | "**Criar sem IA (manual)**" (e recolhido) |

Termos mantidos (são conceitos reais e explicados no [glossário](./glossario.md)): **gatilho**, **régua**, **entregável**, **playbook**, **frente**.

## 3 · Telas densas → simplificadas

| Tela | Antes | Depois |
|---|---|---|
| Estúdio · Nova produção | 5 campos sempre visíveis | 2 visíveis + "Mais opções" recolhido |
| Estúdio · Criar manual | card aberto competindo com "Nova produção" | recolhido em "Criar sem IA (manual)" |
| Comunicação · Adicionar passo | 7 campos sempre visíveis | recolhido em "Adicionar um passo" |

## 4 · Uma ação primária por tela (verificação)
- Estúdio: **Rascunhar com IA** (primária); "Criar sem IA" é secundária/recolhida. ✅
- Comunicação: **Criar régua padrão** (vazio) / aprovar envio na fila (uso). ✅
- Detalhe do entregável: **Aprovar → Publicar** conforme o estado. ✅

## 5 · Preservado
- **Nenhuma funcionalidade removida** — marca, foco, criar-manual e o formulário completo da régua continuam, só recolhidos.
- Undo (R2.1), a11y (foco/teclado nos `<details>` e selects), identidade **v2** e **RLS** intocados.
