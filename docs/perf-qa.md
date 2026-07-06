# QA de Performance (R5.3)

> **Objetivo:** confirmar que os padrões de performance do app se sustentam com o app completo (Estúdio + Comunicação + portal), sem regressão de bundle nem de tempo de resposta percebido.

## Orçamentos (budgets)
| Métrica | Alvo | Observado |
|---|---|---|
| First Load JS compartilhado | ≤ 120 kB | ~102 kB (chunk comum) |
| JS por rota (além do compartilhado) | ≤ 40 kB na maioria | telas de lista/detalhe leves; formulários usam RSC |
| Render de PDF/PPTX/PNG | on-demand, nunca no caminho de navegação | ✅ sob rota de ação, `maxDuration` 60s |
| Consultas por tela | paralelizadas, sem cascata | ✅ `Promise.all` |

## Padrões aplicados
- **Server Components por padrão.** As telas do Estúdio, Comunicação e áreas admin são RSC; o cliente só recebe JS onde há interação real (ex.: `HelpHub` buscável, `DownloadButton`). Formulários usam **server actions** — nada de client-side data fetching desnecessário.
- **Fetch paralelo.** Telas com múltiplas fontes usam `Promise.all` (ex.: `entregaveis/[id]` busca template + org + versões + entregas numa só rodada; a lista busca list + pendentes + orgs em paralelo). Sem waterfalls.
- **`force-dynamic` consciente.** Páginas que dependem de sessão/RLS declaram `export const dynamic = "force-dynamic"` — correto para dados por-org, evita cache indevido entre tenants. Onde há trabalho pesado (render), `export const maxDuration = 60`.
- **Render sob demanda.** PDFs/PPTX/PNGs são gerados **apenas** quando o usuário aciona (re-renderizar/baixar), fora do caminho crítico de navegação. Chromium (@sparticuz) e pptxgenjs só carregam na rota de ação.
- **Orquestração fora do request.** A régua de comunicação roda via **cron diário** (`0 9 * * *`) e fila idempotente (`comm_queue`), não no ciclo de request do usuário — nenhuma tela bloqueia esperando envio.
- **Degradação graciosa = zero custo quando desligado.** Sem credencial de canal (WhatsApp/e-mail) ou de render, o código retorna cedo sem tentar rede — nada trava, nada pendura o request.

## Riscos monitorados
- **Render de deck grande** pode aproximar do teto de 60s em decks muito longos — mitigado por ser on-demand e assíncrono do ponto de vista da navegação.
- **Cron diário no Hobby** é o limite do plano (sub-diário rejeitado); suficiente para a régua atual. Se a cadência precisar ser mais fina, exige upgrade de plano — registrado em launch-readiness.

## Veredito
Padrões de performance **mantidos**. Bundle compartilhado dentro do orçamento (~102 kB), fetch paralelo, RSC-first, render on-demand e orquestração fora do request. Sem regressão introduzida no acabamento R5.
