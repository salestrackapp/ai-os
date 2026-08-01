"use client";
import { useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { salvarCampanha, testarCampanha, enviarParaAprovacao } from "@/app/admin/marketing/email/actions";
import { BLOCOS_DISPONIVEIS, blocoVazio, renderEmail, variaveisUsadas, VARIAVEIS, type Bloco } from "@/lib/marketing/blocos";
import type { Segmento } from "@/lib/marketing/audiencia";

/**
 * O editor.
 *
 * ── A prévia é o mesmo renderizador do envio ──────────────────────────────────────────────────
 * `renderEmail` é módulo puro e roda aqui no navegador exatamente como roda no servidor na hora de
 * disparar. Não existe "versão da prévia": o que aparece no quadro à direita é byte a byte o que
 * sai. Prévia aproximada é pior do que prévia nenhuma — dá confiança sem dar garantia.
 *
 * ── Por que iframe ───────────────────────────────────────────────────────────────────────────
 * O HTML de e-mail traz `<body>`, tabelas e estilos próprios. Injetado na página, herdaria o CSS do
 * admin e mostraria algo que nenhum cliente de e-mail vai renderizar. O iframe isola.
 */

type Props = {
  id: string;
  inicial: {
    nome: string; assunto: string; preheader: string; remetente: string;
    blocos: Bloco[]; segmento: Segmento; status: string;
  };
  origens: { origem: string; total: number }[];
  contagem: { podem: number; excluidos: number };
  emailDoUsuario: string;
  remetentePadrao: string;
};

const campo = "w-full rounded-ds-input border border-hairline bg-[var(--bg-1)] px-3 py-2 font-montserrat text-[14px] text-[color:var(--fg-1)] outline-none focus:border-[color:var(--brand-light)]";
const rotulo = "mb-1 block font-montserrat text-[12px] font-medium uppercase tracking-[.12em] text-[color:var(--fg-3)]";
const btnMini = "ds-focus rounded-ds-input border border-hairline px-2 py-1 font-montserrat text-[12px] text-[color:var(--fg-2)] hover:bg-[var(--bg-2)] disabled:opacity-30";

export function EmailBuilder({ id, inicial, origens, contagem, emailDoUsuario, remetentePadrao }: Props) {
  const [nome, setNome] = useState(inicial.nome);
  const [assunto, setAssunto] = useState(inicial.assunto);
  const [preheader, setPreheader] = useState(inicial.preheader);
  const [remetente, setRemetente] = useState(inicial.remetente);
  const [blocos, setBlocos] = useState<Bloco[]>(inicial.blocos);
  const [segmento, setSegmento] = useState<Segmento>(inicial.segmento);
  const [sel, setSel] = useState<number | null>(inicial.blocos.length ? 0 : null);
  const [emailTeste, setEmailTeste] = useState(emailDoUsuario);
  const [msg, setMsg] = useState<{ tom: "ok" | "aviso" | "erro"; texto: string } | null>(null);
  const [pendente, iniciar] = useTransition();
  const router = useRouter();

  const editavel = !["enviando", "enviada"].includes(inicial.status);

  /**
   * A prévia usa os EXEMPLOS das variáveis, nunca deixa `{{nome}}` cru na tela. Ver a chave
   * literal na prévia treina a pessoa a ignorá-la — e é assim que ela vai parar no e-mail real.
   */
  const html = useMemo(() => renderEmail({
    assunto, preheader, blocos, remetente: remetente || remetentePadrao,
    unsubscribeUrl: "#exemplo-descadastro", endereco: emailDoUsuario,
    dados: Object.fromEntries(VARIAVEIS.map((v) => [v.chave, v.exemplo])),
  }), [assunto, preheader, blocos, remetente, remetentePadrao, emailDoUsuario]);

  const faltando = useMemo(() => {
    const conhecidas: string[] = VARIAVEIS.map((v) => v.chave);
    return variaveisUsadas(blocos).filter((v) => !conhecidas.includes(v));
  }, [blocos]);

  const mudar = (i: number, patch: Partial<Bloco>) =>
    setBlocos((b) => b.map((x, k) => (k === i ? ({ ...x, ...patch } as Bloco) : x)));
  const mover = (i: number, d: -1 | 1) => setBlocos((b) => {
    const j = i + d; if (j < 0 || j >= b.length) return b;
    const c = [...b]; [c[i], c[j]] = [c[j], c[i]]; setSel(j); return c;
  });
  const remover = (i: number) => setBlocos((b) => { const c = b.filter((_, k) => k !== i); setSel(null); return c; });
  const adicionar = (tipo: Bloco["tipo"]) => setBlocos((b) => { setSel(b.length); return [...b, blocoVazio(tipo)]; });

  const salvar = (depois?: () => void) => iniciar(async () => {
    const r = await salvarCampanha(id, { nome, assunto, preheader, blocos, remetente, segmento });
    if (!r.ok) { setMsg({ tom: "erro", texto: r.erro ?? "Não deu para salvar." }); return; }
    setMsg({ tom: "ok", texto: "Salvo." });
    router.refresh();
    depois?.();
  });

  const testar = () => iniciar(async () => {
    const s = await salvarCampanha(id, { nome, assunto, preheader, blocos, remetente, segmento });
    if (!s.ok) { setMsg({ tom: "erro", texto: s.erro ?? "Salve antes de testar." }); return; }
    const r = await testarCampanha(id, emailTeste);
    setMsg(r.ok
      ? { tom: "ok", texto: `Teste enviado para ${emailTeste}. Confira também no celular — metade das aberturas acontece lá.` }
      : { tom: "erro", texto: r.erro ?? "Não deu para enviar o teste." });
  });

  const paraAprovacao = () => salvar(() => iniciar(async () => {
    const r = await enviarParaAprovacao(id);
    setMsg(r.ok
      ? { tom: "aviso", texto: "Enviada para aprovação. O disparo só fica disponível depois de aprovada." }
      : { tom: "erro", texto: r.erro ?? "Não deu para enviar para aprovação." });
    router.refresh();
  }));

  return (
    <div className="grid gap-5 lg:grid-cols-[minmax(0,1fr)_460px]">
      {/* ── coluna de edição ── */}
      <div className="space-y-5">
        <div className="rounded-ds-card border border-hairline bg-[var(--bg-1)] p-4">
          <div className="grid gap-3 sm:grid-cols-2">
            <div><label className={rotulo}>Nome interno</label>
              <input className={campo} value={nome} onChange={(e) => setNome(e.target.value)} disabled={!editavel} /></div>
            <div><label className={rotulo}>Remetente</label>
              <input className={campo} value={remetente} onChange={(e) => setRemetente(e.target.value)} placeholder={remetentePadrao} disabled={!editavel} /></div>
          </div>
          <div className="mt-3">
            <label className={rotulo}>Assunto — é o que decide se abrem</label>
            <input className={campo} value={assunto} onChange={(e) => setAssunto(e.target.value)} disabled={!editavel} />
            <p className="mt-1 font-montserrat text-[12px] text-[color:var(--fg-4)]">
              {assunto.length} caracteres{assunto.length > 60 ? " · o celular corta perto de 40" : ""}
            </p>
          </div>
          <div className="mt-3">
            <label className={rotulo}>Prévia (preheader) — a segunda linha na caixa de entrada</label>
            <input className={campo} value={preheader} onChange={(e) => setPreheader(e.target.value)} disabled={!editavel} />
          </div>
          <p className="mt-3 font-montserrat text-[12.5px] text-[color:var(--fg-3)]">
            Variáveis: {VARIAVEIS.map((v) => <code key={v.chave} className="mr-2 rounded bg-[var(--bg-2)] px-1.5 py-0.5 font-jbmono text-[11.5px]">{`{{${v.chave}}}`}</code>)}
            <span className="block mt-1">Use <code className="font-jbmono text-[11.5px]">{"{{nome|olá}}"}</code> para definir o que aparece quando não sabemos o nome.</span>
          </p>
          {faltando.length > 0 && (
            <p className="mt-2 rounded-ds-input bg-[#FDECEC] px-3 py-2 font-montserrat text-[12.5px] text-[#B42318]">
              Variável desconhecida: {faltando.join(", ")}. Vai sair vazia no e-mail.
            </p>
          )}
        </div>

        {/* blocos */}
        <div className="rounded-ds-card border border-hairline bg-[var(--bg-1)] p-4">
          <p className="mb-3 font-montserrat text-[14px] font-semibold text-[color:var(--fg-1)]">Conteúdo</p>
          <div className="space-y-2">
            {blocos.length === 0 && <p className="font-montserrat text-[13px] text-[color:var(--fg-3)]">Sem blocos ainda. Adicione o primeiro abaixo.</p>}
            {blocos.map((b, i) => (
              <div key={i} className={`rounded-ds-card border p-3 ${sel === i ? "border-[color:var(--brand)] bg-[var(--tile)]" : "border-hairline"}`}>
                <div className="flex items-center gap-2">
                  <button type="button" onClick={() => setSel(sel === i ? null : i)}
                    className="flex-1 text-left font-montserrat text-[13px] font-medium text-[color:var(--fg-1)]">
                    {BLOCOS_DISPONIVEIS.find((x) => x.tipo === b.tipo)?.rotulo}
                    <span className="ml-2 font-normal text-[color:var(--fg-4)]">{resumo(b)}</span>
                  </button>
                  <button type="button" className={btnMini} onClick={() => mover(i, -1)} disabled={!editavel || i === 0} aria-label="Subir">↑</button>
                  <button type="button" className={btnMini} onClick={() => mover(i, 1)} disabled={!editavel || i === blocos.length - 1} aria-label="Descer">↓</button>
                  <button type="button" className={btnMini} onClick={() => remover(i)} disabled={!editavel} aria-label="Remover">✕</button>
                </div>
                {sel === i && editavel && <div className="mt-3 space-y-2">{editor(b, (p) => mudar(i, p))}</div>}
              </div>
            ))}
          </div>

          {editavel && (
            <div className="mt-4 border-t border-hairline pt-3">
              <p className={rotulo}>Adicionar bloco</p>
              <div className="flex flex-wrap gap-1.5">
                {BLOCOS_DISPONIVEIS.map((b) => (
                  <button key={b.tipo} type="button" title={b.descricao} onClick={() => adicionar(b.tipo)}
                    className="ds-focus rounded-ds-pill border border-hairline px-2.5 py-1 font-montserrat text-[12.5px] text-[color:var(--fg-2)] hover:border-[color:var(--brand-light)]">
                    + {b.rotulo}
                  </button>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* quem recebe */}
        <div className="rounded-ds-card border border-hairline bg-[var(--bg-1)] p-4">
          <p className="mb-1 font-montserrat text-[14px] font-semibold text-[color:var(--fg-1)]">Quem recebe</p>
          <p className="mb-3 font-montserrat text-[12.5px] leading-snug text-[color:var(--fg-3)]">
            A lista sai de quem <b>autorizou</b> receber marketing — não da base de contatos. Quem veio de
            coleta pública ou de terceiro nunca entra, mesmo com registro de consentimento.
          </p>
          <div className="grid gap-3 sm:grid-cols-3">
            <div><label className={rotulo}>Origem</label>
              <select className={campo} value={segmento.origem ?? ""} disabled={!editavel}
                onChange={(e) => setSegmento((s) => ({ ...s, origem: e.target.value || null }))}>
                <option value="">Todas</option>
                {origens.map((o) => <option key={o.origem} value={o.origem}>{o.origem} ({o.total})</option>)}
              </select></div>
            <div><label className={rotulo}>Vínculo</label>
              <select className={campo} value={segmento.vinculo ?? ""} disabled={!editavel}
                onChange={(e) => setSegmento((s) => ({ ...s, vinculo: (e.target.value || null) as Segmento["vinculo"] }))}>
                <option value="">Todos</option>
                <option value="clientes">Só clientes</option>
                <option value="leads">Só quem ainda não é cliente</option>
              </select></div>
            <div><label className={rotulo}>Abriu nos últimos</label>
              <select className={campo} value={segmento.abriuNosUltimosDias ?? ""} disabled={!editavel}
                onChange={(e) => setSegmento((s) => ({ ...s, abriuNosUltimosDias: e.target.value ? Number(e.target.value) : null }))}>
                <option value="">Sem filtro</option>
                <option value="30">30 dias</option>
                <option value="90">90 dias</option>
                <option value="180">180 dias</option>
              </select></div>
          </div>
          <p className="mt-3 font-montserrat text-[13px] text-[color:var(--fg-2)]">
            Com os filtros salvos: <b>{contagem.podem}</b> pode(m) receber
            {contagem.excluidos > 0 && <> · <b>{contagem.excluidos}</b> bloqueado(s) por consentimento, procedência ou supressão</>}.
            <span className="block text-[12px] text-[color:var(--fg-4)]">O número é recalculado ao salvar, e de novo no momento do disparo.</span>
          </p>
        </div>
      </div>

      {/* ── coluna da prévia + ações ── */}
      <div className="space-y-4">
        <div className="rounded-ds-card border border-hairline bg-[var(--bg-1)] p-3">
          <p className="mb-2 font-montserrat text-[13px] font-medium text-[color:var(--fg-2)]">Prévia — igual ao que sai</p>
          <iframe title="Prévia do e-mail" srcDoc={html} className="h-[560px] w-full rounded-[10px] border border-hairline bg-white" />
        </div>

        <div className="rounded-ds-card border border-hairline bg-[var(--bg-1)] p-4 space-y-3">
          {msg && (
            <p className={`rounded-ds-input px-3 py-2 font-montserrat text-[13px] ${msg.tom === "ok" ? "bg-[var(--tile)] text-[color:var(--brand-deep)]" : msg.tom === "aviso" ? "bg-[#FFF7E6] text-[color:var(--fg-1)]" : "bg-[#FDECEC] text-[#B42318]"}`}>{msg.texto}</p>
          )}

          {editavel ? (
            <>
              <div>
                <label className={rotulo}>Enviar teste para</label>
                <div className="flex gap-2">
                  <input className={campo} value={emailTeste} onChange={(e) => setEmailTeste(e.target.value)} />
                  <button type="button" disabled={pendente} onClick={testar}
                    className="ds-focus shrink-0 rounded-ds-input border border-hairline-strong px-3 font-montserrat text-[13px] text-[color:var(--fg-2)] hover:bg-[var(--bg-2)] disabled:opacity-50">
                    Testar
                  </button>
                </div>
                <p className="mt-1 font-montserrat text-[12px] text-[color:var(--fg-4)]">O teste não conta nas métricas da campanha.</p>
              </div>

              <div className="flex flex-wrap gap-2 border-t border-hairline pt-3">
                <button type="button" disabled={pendente} onClick={() => salvar()}
                  className="ds-focus h-10 rounded-ds-input border border-hairline-strong bg-[var(--bg-1)] px-4 font-montserrat text-sm font-medium text-[color:var(--fg-2)] hover:bg-[var(--bg-2)] disabled:opacity-50">
                  {pendente ? "Salvando…" : "Salvar"}
                </button>
                {inicial.status !== "aguardando_aprovacao" && (
                  <button type="button" disabled={pendente} onClick={paraAprovacao}
                    className="ds-focus h-10 rounded-ds-input bg-brand px-4 font-montserrat text-sm font-semibold text-white shadow-ds-brand hover:bg-brand-hover disabled:opacity-50">
                    Enviar para aprovação
                  </button>
                )}
              </div>
            </>
          ) : (
            <p className="font-montserrat text-[13px] text-[color:var(--fg-3)]">
              Esta campanha já saiu e não pode mais ser editada — o registro precisa corresponder ao que as pessoas receberam. Duplique-a para criar uma nova versão.
            </p>
          )}
        </div>
      </div>
    </div>
  );
}

function resumo(b: Bloco): string {
  if (b.tipo === "titulo" || b.tipo === "texto") return `“${b.texto.slice(0, 44)}${b.texto.length > 44 ? "…" : ""}”`;
  if (b.tipo === "botao") return `“${b.label}”`;
  if (b.tipo === "lista") return `${b.itens.length} item(ns)`;
  if (b.tipo === "citacao") return `“${b.texto.slice(0, 34)}…”`;
  if (b.tipo === "imagem") return b.url ? "com imagem" : "sem URL ainda";
  return "";
}

function editor(b: Bloco, mudar: (p: Partial<Bloco>) => void) {
  const area = `${campo} min-h-[80px] leading-relaxed`;
  switch (b.tipo) {
    case "titulo":
      return <>
        <textarea className={area} value={b.texto} onChange={(e) => mudar({ texto: e.target.value } as Partial<Bloco>)} />
        <select className={campo} value={b.nivel ?? 2} onChange={(e) => mudar({ nivel: Number(e.target.value) as 1 | 2 } as Partial<Bloco>)}>
          <option value={1}>Título principal</option><option value={2}>Subtítulo</option>
        </select>
      </>;
    case "texto":
      return <textarea className={area} value={b.texto} onChange={(e) => mudar({ texto: e.target.value } as Partial<Bloco>)} />;
    case "botao":
      return <>
        <input className={campo} value={b.label} placeholder="Texto do botão" onChange={(e) => mudar({ label: e.target.value } as Partial<Bloco>)} />
        <input className={campo} value={b.url} placeholder="https://…" onChange={(e) => mudar({ url: e.target.value } as Partial<Bloco>)} />
      </>;
    case "imagem":
      return <>
        <input className={campo} value={b.url} placeholder="URL pública da imagem" onChange={(e) => mudar({ url: e.target.value } as Partial<Bloco>)} />
        <input className={campo} value={b.alt ?? ""} placeholder="Descrição (aparece com imagens desligadas)" onChange={(e) => mudar({ alt: e.target.value } as Partial<Bloco>)} />
        <input className={campo} value={b.link ?? ""} placeholder="Link ao clicar (opcional)" onChange={(e) => mudar({ link: e.target.value } as Partial<Bloco>)} />
      </>;
    case "lista":
      return <textarea className={area} value={b.itens.join("\n")} placeholder="Um item por linha"
        onChange={(e) => mudar({ itens: e.target.value.split("\n") } as Partial<Bloco>)} />;
    case "citacao":
      return <>
        <textarea className={area} value={b.texto} onChange={(e) => mudar({ texto: e.target.value } as Partial<Bloco>)} />
        <input className={campo} value={b.autor ?? ""} placeholder="Quem disse" onChange={(e) => mudar({ autor: e.target.value } as Partial<Bloco>)} />
      </>;
    case "espaco":
      return <input className={campo} type="number" min={4} max={80} value={b.altura ?? 24}
        onChange={(e) => mudar({ altura: Number(e.target.value) } as Partial<Bloco>)} />;
    default:
      return null;
  }
}
