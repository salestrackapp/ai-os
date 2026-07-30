# Desligamento da academy antiga — inventário e exportação

**Feito em 2026-07-30, antes de qualquer exclusão.** Nada foi apagado ainda.

Alvo: o sistema em `capacita-salestrack.vercel.app`, sustentado pelo projeto Supabase
`ynyqfbngitodmkoloays` (região **us-east-2**) e pelo repositório `~/salestrack-ai-academy`.

---

## 1. Inventário do banco

Cinco tabelas, todas em `public`, **todas com RLS desabilitada**:

| Tabela | Linhas | Conteúdo |
|---|---|---|
| `academy_users` | **2** | as duas contas são do André, ambas `role = admin` |
| `academy_sessions` | **4** | tokens de sessão, válidos até 2026-08-04 |
| `academy_progress` | **0** | vazia |
| `academy_agents` | **0** | vazia |
| `academy_content` | **0** | vazia — o conteúdo nunca esteve no banco |

As duas contas:

| E-mail | Papel | Ativa | Último acesso |
|---|---|---|---|
| `andre.kachan@salestrack.com.br` | admin | sim | 2026-07-28 15:16 |
| `andre@salestrack.ai` | admin | **não** | 2026-07-28 15:15 |

**Não há nenhum aluno.** Isso confirma o que a investigação da Fase 2 já havia apurado, e é o
que torna o desligamento simples: não existe gente para migrar, nem progresso para preservar.

## 2. Exportação

`dados-exportados.json` — as 5 tabelas.

Duas coisas foram **deliberadamente omitidas** da exportação:
- os **hashes de senha** (bcrypt, `$2b$10$`, 60 chars);
- os **tokens de sessão**.

Guardá-los recriaria, num arquivo do repositório do AI OS, exatamente a exposição que o
desligamento existe para encerrar. Não há para que servirem: as contas são do André e ele já
tem acesso ao AI OS pelo Supabase Auth.

`academy-fonte-original.html` — o HTML de 289 KB com o curso inteiro, copiado do repositório.
SHA-256 conferido contra a origem: `56ef5bb6c1a970fc692812ebfbacc36242510c9b95997d8b61e8798b652b00fe`.

## 3. Verificação de conteúdo: nada se perdeu

Extraí os literais da fonte com `node:vm` e comparei com o que está no AI OS:

| | Fonte (`academy.html`) | AI OS (produção) |
|---|---|---|
| Módulos | 6 | **6** |
| Seções / aulas | 32 | **32** |
| Tarefas | 17 | **17** |
| Tarefas por módulo | 2,3,3,3,3,3 | **2,3,3,3,3,3** |
| Prompts (`DB_P`) | 24 | **24** |
| Ferramentas (`DB_T`) | 28 | **28** |
| Glossário (`DB_G`) | 20 | **20** |
| Checklist (`CL`) | 15 | **15** |
| **Total de referências** | 87 | **87** |

Bate item por item. Além disso, `tests/academy-content.test.ts` já compara o conteúdo
**folha por folha** contra a fonte, com uma asserção de igualdade — não é só contagem.

## 4. Achados de segurança

**a) RLS desabilitada nas 5 tabelas, e a aplicação usa a chave ANÔNIMA.**
Quem tiver a chave anon lê e escreve tudo — inclusive `academy_users` (com os hashes) e
`academy_sessions` (com tokens de sessão vivos). A chave anon é, por desenho, uma chave pública.
Neste app ela fica só no lado servidor (`pages/api/*`), o que reduz a exposição, mas não a
elimina: é uma credencial que não deveria ter esse poder. **Isto é um argumento a favor de
apagar o projeto em vez de deixá-lo parado.**

**b) Senha em texto puro comitada no git.**
`README-DEPLOY.md:21` → `Senha: salestrack2025`, presente no histórico em pelo menos 3 commits.
Rotacionar a senha **não** limpa o histórico; só apagar o repositório resolve.

**Verificado:** comparei `salestrack2025` com os hashes das duas contas via `crypt()`.
**Já não vale em nenhuma delas** — você trocou. Então não há acesso aberto neste momento; o
que resta é o histórico do git, que continua expondo uma senha que já foi usada em produção.

**c) Quatro sessões válidas até 2026-08-04.**
Se o projeto não for apagado antes disso, elas expiram sozinhas. Apagar o projeto invalida na hora.

## 5. Execução do desligamento — 2026-07-30, autorizado pelo André

| # | Ação | Estado |
|---|---|---|
| 1 | Projeto Vercel `capacita-salestrack` (`prj_CEqjj5452UubmuHbJWhXKYdwc8fv`) | ✅ **apagado** — `capacita-salestrack.vercel.app` responde 404 |
| 2 | Tabelas do Supabase `ynyqfbngitodmkoloays` | ✅ **derrubadas** — schema `public` vazio; hashes de senha e os 4 tokens de sessão deixaram de existir |
| 3 | Repositório `~/salestrack-ai-academy` (273 MB) | ✅ **apagado** — não havia remoto, então o histórico do git com a senha em texto puro acabou de fato |

### ⚠️ Falta um passo, e só o André pode fazer

**O projeto Supabase em si não foi apagado.** O MCP não expõe exclusão de projeto, e a pausa
foi recusada: `Project is not free-tier`. Ou seja, **ele é um projeto pago da organização
`Salestrack` (plano pro) e continua custando ~US$ 10/mês sem uso nenhum.**

Os dados já não estão lá — o risco de exposição foi encerrado no passo 2. O que resta é
custo e um projeto fora de `sa-east-1` no inventário, o que ainda conta para a documentação
de residência de dados da LGPD.

Para concluir, no painel do Supabase:

1. Abrir `https://supabase.com/dashboard/project/ynyqfbngitodmkoloays/settings/general`
2. Rolar até **Delete project**
3. Digitar o nome do projeto (`salestrack-ai-academy`) para confirmar

Depois disso, os 5 projetos restantes ficam **todos em `sa-east-1`** — e aí a pendência de
transferência internacional do §11 do plano mestre pode ser fechada de vez.

## 6. O que ficou preservado

- `academy-fonte-original.html` — o curso inteiro, SHA-256 conferido contra a origem antes de apagar
- `supabase/seed/academy_trilha.json` no repositório do AI OS — 117 KB, o pacote versionado
- `tests/academy-content.test.ts` — compara folha por folha contra a fonte

Conferido no momento da exclusão: o hash do arquivo aqui era idêntico ao do repositório apagado.
