# Vídeo (R3.8) — Família F · fecha a Onda R3

O AI OS **produz e aprova** o roteiro + storyboard; o **render final** roda nas ferramentas de vídeo da
**Salestrack** (server-only) — nunca em sistemas do cliente. Sem credencial, o **storyboard é o entregável**.

## Modelo
Agregado = `studio_deliverable` (line `video_roteiro`, `content.video` = `VideoPayload`) + colunas de estado de
render (`render_status`/`render_tool`/`video_ref`, migration 024). Herda status/versão/imutabilidade/RLS/auditoria.

## Fluxo
1. IA gera **roteiro** (`narracao[]`, `textos_tela[]`) + **storyboard** (`cenas[]`: visual/duração/narração/texto_tela/arte?).
2. Storyboard renderiza em **PDF/HTML v2** (`render/storyboard.ts`): cada cena com um **frame 16:9** (reusa a linguagem da **Arte R3.7**), abertura/encerramento marcados como **slides (R3.4)**, cena de número usa dado real (lime).
3. Humano **aprova o storyboard** (R3.1, imutável). Só então:
4. **Render** (`video/render-tool.ts` `triggerVideoRender`): `videoToolFor(tipo)` escolhe HeyGen (apresentador/avatar) ou Higgsfield (geração) se houver credencial no servidor; senão **`render_status='pendente'`** (graceful — build passa). Ação `dispararRenderVideoAction`.
5. **Distribuição (R4):** vídeo aprovado é `comm_eligible` (commChannel `post`) → post com vídeo. Envio/cadência = R4.

## Reuso
- Frames de cena → linguagem visual da **Arte (R3.7)**.
- Abertura/encerramento → **slides (R3.4)**.
- Nada de render próprio duplicado; ferramentas de vídeo são plug-ins server-only.
