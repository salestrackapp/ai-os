# Catálogo de produções do Estúdio (linhas)

Cada **tipo de entrega** é uma **linha** (`defineLine`) sobre o núcleo do R3.1. O motor cuida do ciclo
(gerar com IA → revisar → aprovar → renderizar → publicar); a linha só descreve **o quê** produz.

## Design & marca
- **Design único: Salestrack AI v2** (ink/Montserrat/violeta) para TODA entrega. Não existe segundo design.
- `brandDefault` é **atribuição** (logo/assinatura: `salestrack` ou `andre_kachan`), **não** troca o design.
- A **identidade do programa** (logo do cliente, capa, `accent` restrito à paleta v2) é resolvida no render.

## Famílias (R3.2) e aprofundamento
| Família | Arquivo | Aprofunda em |
|---|---|---|
| Documentos & Publicações | `documentos.ts` | R3.3 |
| Apresentações | `apresentacoes.ts` | R3.4 |
| Formação (workshops/cursos/treinamentos/palestras) | `formacao.ts` | R3.5 (testes/certificados) |
| Mensagens & Copy (post/mensagem/whatsapp/e-mail) | `mensagens.ts` | R3.6 |
| Arte & Criativos | `arte.ts` | R3.7 (imagem final) |
| Vídeo (roteiro + storyboard) | `video.ts` | R3.8 (render de vídeo) |

## Como adicionar um novo tipo ("nova entrega = novo `defineLine`")
1. Escolha a **família** mais próxima (ou proponha uma nova em `define-line.ts` → `FAMILIES`).
2. No arquivo da família, crie um `defineLine({ key, label, family, brandDefault, kind, renderTarget, contentSchema, buildPrompt, toContent })`.
   - Reuse os schemas/mapeadores de `schemas.ts` (`docSchema`, `copySchema`, `artSchema`, `videoSchema`) quando servirem.
   - `commChannel` (whatsapp|email|post|generic) marca a linha como **elegível ao R4** (Comunicação) após aprovação.
   - `deepenedIn` documenta que o componente especializado chega numa onda futura (baseline funciona já).
3. Exporte a linha no array da família e ela é registrada automaticamente pelo `index.ts`.
4. Pronto: o tipo aparece no catálogo do Estúdio e é produzível pelo fluxo do R3.1.

> Regra de ouro: **o Estúdio fabrica o ativo; a Comunicação (R4) orquestra o envio.** Nada é enviado sem aprovação.
