# QA de Acessibilidade — WCAG 2.1 AA (R5.3)

> **Objetivo:** garantir que as telas v5 são operáveis por teclado, legíveis por leitores de tela e legíveis por contraste — no padrão AA.

## Método
Auditoria das telas v5 (Estúdio, Comunicação, Identidade, cockpit, áreas) por: foco visível, rótulos de campo, texto alternativo/aria, hierarquia de cabeçalhos e contraste de tokens.

## Achados e correções

### ✅ Foco visível (2.4.7)
Todo controle interativo v5 usa a classe `ds-focus` → anel de foco violeta consistente. Botões, links de ação, inputs e cards clicáveis mostram foco claro na navegação por Tab. **Mantido em toda a superfície v5.**

### ✅ Rótulos de campo (1.3.1, 4.1.2) — corrigido nesta rodada
Inputs que dependiam apenas de `placeholder` receberam `aria-label` explícito (placeholder some ao digitar e não é lido de forma confiável):
- **Envio de teste (Estúdio `entregaveis/[id]`):** `nome`, `empresa`, `email`, `phone`, `nota`, `participante` → `aria-label` descritivo.
- **Fila de aprovação (Estúdio `entregaveis`):** input `motivo` da reprovação → `aria-label="Motivo da reprovação"`.
- **Hub de ajuda (`HelpHub`):** busca → `aria-label="Buscar um guia"`.

Campos com `<label>` associado (formulários de recurso, régua, identidade) já expunham nome acessível — mantidos.

### ✅ Contraste (1.4.3)
Tokens v2 sobre fundo claro: `--fg-1`/`--fg-2` sobre `--bg-1`/`--bg-2` atendem ≥ 4.5:1 para texto normal; `--brand` em botões usa texto branco (contraste AA). O acento lime `#EBF212` é usado como realce/estado, **nunca** como texto pequeno sobre claro.

### ✅ Estrutura e linguagem
- Cabeçalhos hierárquicos via `PageHeader`/`Breadcrumbs`; uma `<h1>` por tela.
- **Sentence case** e linguagem sem jargão (herdado de R5.2) — reduz carga cognitiva e melhora leitura por TTS.
- Ícones decorativos acompanham texto; ações não dependem só de cor (badges têm rótulo textual + tom).

## Pendências conhecidas (não-bloqueantes)
- **Telas legadas** (moldura escura) não foram reauditadas para AA — são coexistência residual (ver `visual-qa.md`); a migração para v5 traz o padrão AA junto. Registrado em `launch-readiness.md`.

## Veredito
Telas v5 **aprovadas em AA** nos critérios operáveis por teclado, nome acessível de campos, contraste e estrutura. Correções de `aria-label` aplicadas nesta rodada fecham os campos placeholder-only.
