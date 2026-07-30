"use client";
/**
 * Página viva do Design System v6 (identidade Academy) — restrita a admin (gate no layout /admin).
 * Renderiza cada componente isolado, em todos os estados, para aprovação visual.
 */
import { useState } from "react";
import {
  Eyebrow, Section, Kpi, Badge, StatusDot, MonoTag, EmptyState, PrimaryActionBar,
  Button, Card, CardFeatured, CopilotCard, CopilotInline,
  Label, Input, Textarea, Select, Field, Table, Tabs, Breadcrumbs, Stepper,
  Dialog, Drawer, ToastProvider, useToast, CycleSteps, ContentArea,
} from "@/components/ds";
import { Icon } from "@/components/ui/icons";

const SWATCHES = [
  ["Brand", "#4F1FFF"], ["Brand light", "#7C4DFF"], ["Brand hover", "#3E14E0"], ["Brand deep", "#310CB8"],
  ["Spark (raro)", "#EBF212"], ["Ink", "#0B0B16"], ["Tile", "#EEEAFF"],
  ["Success", "#18A06B"], ["Warn", "#E8A317"], ["Danger", "#E5685F"],
  ["Gray 50", "#F7F7FA"], ["Gray 500", "#6B6B7C"], ["Gray 900", "#12121C"],
];

const ROWS = [
  { agent: "Prospecção", status: "rodando", leads: "128", conv: "+34%" },
  { agent: "Consultor", status: "ativo", leads: "—", conv: "12 conversas" },
  { agent: "ROI / Sucesso", status: "em curso", leads: "—", conv: "3 relatórios" },
];

function Swatch({ name, hex }: { name: string; hex: string }) {
  const light = ["#EBF212", "#EEEAFF", "#F7F7FA"].includes(hex);
  return (
    <div className="rounded-ds-input border border-hairline bg-[var(--bg-1)] p-1.5">
      <div className="h-12 w-full rounded-[9px] border border-hairline" style={{ background: hex }} />
      <p className="mt-1.5 px-1 font-montserrat text-[13px] font-medium text-[color:var(--fg-1)]">{name}</p>
      <p className="px-1 font-jbmono text-[11px] text-[color:var(--fg-3)]">{hex}</p>
      {light && <p className="px-1 font-jbmono text-[11px] text-[color:var(--warn)]">nunca texto claro</p>}
    </div>
  );
}

function Block({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="rounded-ds-panel border border-hairline bg-[var(--bg-1)] p-6 shadow-ds-xs">
      <h2 className="ds-h3 mb-5">{title}</h2>
      {children}
    </section>
  );
}

function Showcase() {
  const toast = useToast();
  const [dialog, setDialog] = useState(false);
  const [drawer, setDrawer] = useState(false);
  const [loading, setLoading] = useState(false);

  return (
    <div className="ds relative min-h-screen overflow-hidden rounded-ds-panel bg-[var(--bg-2)] p-6 sm:p-10">
      <div aria-hidden className="pointer-events-none absolute inset-0" style={{ background: "var(--wash-bloom)" }} />
      <div className="relative mx-auto max-w-[1160px] space-y-8">
        {/* Cabeçalho */}
        <header>
          <Breadcrumbs items={[{ label: "Admin", href: "/admin" }, { label: "Design system" }]} className="mb-4" />
          <Eyebrow>Salestrack AI · v5</Eyebrow>
          <h1 className="ds-display mt-3">Design system</h1>
          <p className="ds-lead mt-3 max-w-2xl">A linguagem visual do centro de operações de IA. Violeta como acento único, lime como spark raro, ink e Montserrat. Calmo, premium, técnico.</p>
          <div className="mt-4 flex flex-wrap gap-2">
            <MonoTag>Montserrat 800</MonoTag><MonoTag>#4F1FFF</MonoTag><MonoTag>JetBrains Mono</MonoTag>
          </div>
        </header>

        <Block title="Cores">
          <div className="grid grid-cols-3 gap-3 sm:grid-cols-4 lg:grid-cols-6">
            {SWATCHES.map(([n, h]) => <Swatch key={h} name={n} hex={h} />)}
          </div>
        </Block>

        <Block title="Tipografia">
          <div className="space-y-3">
            <p className="ds-display">Display 800</p>
            <p className="ds-h1">Heading 1 — sentence case</p>
            <p className="ds-h2">Heading 2 — sentence case</p>
            <p className="ds-h3">Heading 3</p>
            <p className="ds-lead">Lead — a métrica é a prova; o copiloto é proativo.</p>
            <p className="ds-body">Body — corpo em Montserrat regular, 15–16px, altura 1.6, leitura calma e confortável.</p>
            <p className="ds-small">Small — legenda e apoio.</p>
            <p className="ds-mono">MONO · dado técnico · v5.0 · /admin/design-system</p>
            <div><Eyebrow>Posicionamento</Eyebrow></div>
          </div>
        </Block>

        <Block title="Botões — uma primary por tela">
          <div className="flex flex-wrap items-center gap-3">
            <Button variant="primary">Ação primária</Button>
            <Button variant="secondary">Secundária</Button>
            <Button variant="ghost">Ghost</Button>
            <Button variant="accent">Spark (raro)</Button>
            <Button variant="primary" loading={loading} onClick={() => { setLoading(true); setTimeout(() => setLoading(false), 1400); }}>
              {loading ? "Salvando" : "Testar loading"}
            </Button>
            <Button variant="secondary" disabled>Desabilitado</Button>
            <Button variant="primary" size="sm">Pequeno</Button>
            <Button variant="primary" size="lg" leftIcon={<Icon name="sparkles" size={16} />}>Grande</Button>
          </div>
        </Block>

        <Block title="Formulários">
          <div className="grid gap-5 sm:grid-cols-2">
            <Field label="Nome do programa" hint="Aparece no portal do cliente." required>
              {(p) => <Input placeholder="Ex.: Programa de IA — Clínica" {...p} />}
            </Field>
            <Field label="Segmento">
              {(p) => <Select {...p}><option>Saúde</option><option>Varejo</option><option>Serviços</option></Select>}
            </Field>
            <Field label="Objetivo" error="Descreva o objetivo em pelo menos uma frase." className="sm:col-span-2">
              {(p) => <Textarea placeholder="O que este programa entrega…" {...p} />}
            </Field>
          </div>
        </Block>

        <Block title="Cards + featured + tile lavanda">
          <div className="grid gap-4 lg:grid-cols-3">
            <Card icon={<Icon name="target" size={20} />} eyebrow="Frente" title="Prospecção inteligente" bloom>
              Sinais, não volume. O agente qualifica e propõe o próximo passo.
            </Card>
            <CardFeatured icon={<Icon name="rocket" size={20} />} eyebrow="Recomendado" title="Implementar agentes"
              footer={<Button variant="accent" size="sm">Começar</Button>}>
              A etapa atual do método — colocar as automações prioritárias no ar.
            </CardFeatured>
            <Card icon={<Icon name="shield" size={20} />} eyebrow="Governança" title="Stack de IA sob controle">
              Política, catálogo e página pública de segurança do cliente.
            </Card>
          </div>
        </Block>

        <Block title="KPIs — dado como insight">
          <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
            <Kpi value="+340%" label="Leads qualificados" delta="mês" tone="up" />
            <Kpi value="18" label="Receitas concluídas" delta="+6" tone="up" />
            <Kpi value="92%" label="Progresso do programa" />
            <Kpi value="R$ 4.500" label="Margem / cliente" delta="−3%" tone="down" />
          </div>
        </Block>

        <Block title="Copiloto — proativo (achado + ação)">
          <div className="grid gap-4 lg:grid-cols-2">
            <CopilotCard agent="Copiloto de operações" status="ativo"
              finding="Identifiquei 3 oportunidades de melhoria operacional para esta semana."
              actionLabel="Ver as 3 ações" metric={{ value: "3", label: "achados priorizados" }}
              onAction={() => toast("Abrindo achados…")} />
            <CopilotInline agent="Consultor" finding="O programa está 92% na fase de implementação — falta capacitar o time no Playbook."
              actionLabel="Sugerir próxima sessão" onAction={() => toast("Sessão sugerida", "success")} />
          </div>
        </Block>

        <Block title="Badges e status">
          <div className="flex flex-wrap items-center gap-3">
            <Badge>Neutro</Badge><Badge tone="brand">Marca</Badge><Badge tone="success">Ativo</Badge>
            <Badge tone="warn">Pendente</Badge><Badge tone="danger">Bloqueado</Badge>
            <span className="mx-2 h-5 w-px bg-[var(--border-strong)]" />
            <StatusDot status="ativo" live /><StatusDot status="rodando" live /><StatusDot status="em curso" />
            <StatusDot status="pausado" /><MonoTag>id_8f2a3</MonoTag>
          </div>
        </Block>

        <Block title="Tabela">
          <Table
            columns={[
              { key: "agent", header: "Agente" },
              { key: "status", header: "Estado", render: (r) => <StatusDot status={r.status as string} live={r.status !== "em curso"} /> },
              { key: "leads", header: "Leads", align: "right", mono: true },
              { key: "conv", header: "Resultado", align: "right", mono: true },
            ]}
            rows={ROWS} getKey={(r) => r.agent as string}
          />
        </Block>

        <Block title="Tabs, stepper e overlays">
          <Tabs tabs={[
            { id: "geral", label: "Geral", content: <p className="ds-body">Conteúdo da aba geral.</p> },
            { id: "avancado", label: "Avançado", content: <p className="ds-body">Conteúdo avançado.</p> },
            { id: "hist", label: "Histórico", content: <p className="ds-body">Sem histórico ainda.</p> },
          ]} />
          <div className="mt-6"><Stepper steps={["Diagnóstico", "Escopo", "Provisionar", "Ativar"]} current={2} /></div>
          <div className="mt-6 flex flex-wrap gap-3">
            <Button variant="secondary" onClick={() => setDialog(true)}>Abrir dialog</Button>
            <Button variant="secondary" onClick={() => setDrawer(true)}>Abrir drawer</Button>
            <Button variant="secondary" onClick={() => toast("Publicado", "success")}>Toast: publicado</Button>
            <Button variant="secondary" onClick={() => toast("Salvo")}>Toast: salvo</Button>
          </div>
        </Block>

        <Block title="Estado vazio">
          <EmptyState icon={<Icon name="fileText" size={22} />} title="Nenhum entregável ainda"
            description="Gere um relatório executivo a partir de um ROI, deal ou prospect."
            action={<Button variant="primary">Gerar primeiro</Button>} />
        </Block>

        <Block title="Ciclo — AI Operating Method">
          <CycleSteps currentStep={2} onEdit={(k) => toast(`Editar etapa: ${k}`)} />
        </Block>

        <PrimaryActionBar
          secondary={<span className="ds-small">Design system v5 · Salestrack AI v2</span>}
          primary={<Button variant="primary" onClick={() => toast("Visual aprovado", "success")}>Aprovar visual</Button>}
        />
      </div>

      <Dialog open={dialog} onClose={() => setDialog(false)} title="Confirmar publicação"
        footer={<><Button variant="ghost" onClick={() => setDialog(false)}>Cancelar</Button><Button variant="primary" onClick={() => { setDialog(false); toast("Publicado", "success"); }}>Publicar</Button></>}>
        Esta ação torna o conteúdo visível para o cliente. Você pode reverter depois.
      </Dialog>
      <Drawer open={drawer} onClose={() => setDrawer(false)} title="Detalhes do agente"
        footer={<Button variant="primary" onClick={() => setDrawer(false)}>Fechar</Button>}>
        <div className="space-y-3">
          <StatusDot status="rodando" live />
          <p>Painel lateral para inspeção e edição. Fecha com Escape, clique fora ou o botão.</p>
        </div>
      </Drawer>
    </div>
  );
}

export default function DesignSystemPage() {
  return (
    <ContentArea>
      <ToastProvider><Showcase /></ToastProvider>
    </ContentArea>
  );
}
