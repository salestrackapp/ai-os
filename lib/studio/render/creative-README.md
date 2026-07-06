# Arte & Criativos (R3.7) — Família E

Motor **template v2 → PNG** (determinístico, pixel-fiel). IA propõe conceito/copy/template; humano aprova o visual.

## Templates & tamanhos
- Templates (`creative.ts` `CREATIVE_TEMPLATES`): `citacao · numero · anuncio · carrossel · capa · thumbnail`.
- Tamanhos (`CREATIVE_SIZES`): `1:1` (1080²) · `4:5` (1080×1350) · `9:16` (1080×1920) · `16:9` (1200×675).
- Card de **número** usa dado real (prova) — ROI injetado no contexto pelo `studioExtraContext`.

## Linhas & payload
`arte` (peça única) e `criativo_post` (carrossel) → `content.creative` (`CreativePayload`).
`buildDeliverableHtml` detecta `content.creative` e renderiza o **preview** (`buildCreativeHtml`, miniaturas dos slides).

## PNG
- `render/creative.ts` `buildCreativeSlideHtml(template, slide, size, opts, idx?)` → HTML no tamanho exato do preset.
- `render/creative-png.ts` `renderCreativePngs(creative, opts)` → PNGs via Chromium (deviceScaleFactor 2, @2x).
  **Graceful:** sem Chromium retorna null → usa o preview. Ação `baixarPngAction` sobe os PNGs ao bucket.

## Camada de imagem por IA (opcional, sob a marca)
`imagem_fundo` (url) entra como camada de fundo com overlay v2 por cima (texto/logo/acento).
Sem imagem → fundo v2 (gradiente/bloom). A marca nunca é definida pela IA de imagem.

## Par com Posts (R3.6) + carrossel
`creativeFromPost(sugestao, tamanho, postRef)` gera a arte de um post; ação `gerarArteDoPostAction`
cria a arte vinculada (`postRef`) — copy + arte prontos para a Comunicação (R4) publicar juntos.
Carrossel = `template: "carrossel"` com `slides[]` → N PNGs coerentes.
