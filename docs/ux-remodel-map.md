# AI OS · Mapa de re-hospedagem (U5) — 4 destinos por jornada

O admin passou de 8 áreas por função para **4 destinos por jornada**. As telas **não mudaram de arquivo** — só a espinha de navegação. **Hoje** é o cockpit/landing (topo/logo + atalho no menu), não um dos 4 destinos.

## Destinos

### 1 · Jornadas → `/admin/jornadas`
Painel Kanban das jornadas paralelas + ficha-jornada do cliente. Absorve:
`/admin/clientes` (→ redireciona ao painel) · `/admin/clientes/[id]` (ficha-jornada) · `/admin/relacionamento` · `/admin/programas` · `/admin/onboarding` · `/admin/consultor` · `/admin/roi` · `/admin/financeiro` (faturas do cliente).

### 2 · Comercial → `/admin/comercial`
Captação e fechamento: `/admin/crm` · `/admin/prospeccao` · `/admin/propostas` · `/admin/contratos` · `/admin/tarefas` · `/admin/catalogo` (ofertas) · `/admin/sinais`.

### 3 · Estúdio → `/admin/entregaveis`
Fábrica de entregáveis multiformato (UC): `/admin/entregaveis` · `/admin/entregaveis/novo` · `/admin/comunicacao` (régua) · `/admin/estudio` (Método) · `/admin/biblioteca-templates` · `/admin/entregaveis/identidade`.

### 4 · Configurar → `/admin/configuracoes`
`/admin/configuracoes/parametros` (integrações/chaves/gate/SLA) · `/admin/configuracoes/equipe` · `/admin/configuracoes/auditoria` · `/admin/operacoes` (FinOps) · `/admin/design-system`.

## Redirects (telas absorvidas)
- `/admin/clientes` → `/admin/jornadas`
- `/admin/metodo` → `/admin/estudio-area`
- `/admin/plataforma` → `/admin/configuracoes`
- `/admin/monetizacao` → arquivada (fora do menu; modelo sem mensalidade de plataforma)

## Anti-trava (defaults aplicados)
- **Gate de envio** (`rel_send_policy`) default → **`direto_autorizado`** (envio direto; assuntos sensíveis ainda pedem aprovação).
- **Nova jornada** cria cliente sem exigir contrato/CNPJ; diagnóstico já sai com link.
- **Compartilhar por link** presente em cada entrega (ficha-jornada, entregável, diagnóstico).
- **Revelação progressiva**: portal do cliente e cockpit mostram o que serve à etapa atual.
