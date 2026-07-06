# Formação (R3.5) — Família C

Entrega **multi-ativo**: currículo + slides (R3.4) + materiais (R3.3) + **teste** + **certificado**, no design v2 + identidade.

## Arquitetura
- O **agregado** é um `studio_deliverable` (line = tipo, content = documento + `content.formacao` com o payload estruturado). Herda status/versão/**imutabilidade**/RLS/auditoria do R3.1.
- **4 tipos = presets** sobre a mesma base (`lib/studio/lines/formacao.ts`): `palestra`, `workshop`, `treinamento`, `curso`. Diferem em estrutura/duração e se pedem `teste`.

## Componentes
- **Currículo/módulos + material** → document renderer (R3.3): o `toContent` monta seções (módulos, avaliação, certificação) e guarda o payload em `content.formacao`.
- **Slides** → `composeFormacaoDeck(payload)` reusa `composeDeck`/`moduleDeck` (R3.4). Ação `gerarSlidesDaFormacaoAction` cria um entregável `apresentacao` (PPTX) — sem duplicar render.
- **Teste** → `lib/studio/formacao/teste.ts` (`testeSchema` + `corrigirTeste`). O teste é gerado pela IA (presets treinamento/curso), renderiza no corpo do documento, e `corrigirTeste(teste, respostas)` é o **gancho de correção** das objetivas para o portal (correção automática; dissertativa = manual).
- **Certificado** → `lib/studio/render/certificate.ts` (`buildCertificateHtml`, v2 paisagem + assinatura por `brand_attribution`). Ação `emitirCertificadoAction` renderiza PDF, sobe ao bucket e grava em `formacao_certificados` (auditado; **reemissão** incrementa `version`).

## Gate/publicação
O pacote passa pelo ciclo do R3.1 (gerar → revisar → aprovar → publicar). Aprovado **trava o conteúdo**;
mudança exige **nova versão**. Certificados só são emitidos com a formação aprovada/publicada.
