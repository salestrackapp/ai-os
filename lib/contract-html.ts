import "server-only";
import { brl, BRAND_LABELS, proposalTotals, type ProposalItem } from "@/lib/types";
import { deliverablesOf } from "@/lib/service-desc";

const esc = (s: unknown) => String(s ?? "").replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c] as string));

export type ContractData = {
  title: string;
  org: { name: string; cnpj?: string | null };
  signerName?: string | null;
  frentes?: string[] | null;
  items: ProposalItem[];
  installments?: number | null;
  monthlyFee?: number | null;
  validUntil?: string | null;
};

const SALESTRACK_NOME = "Salestrack Inteligência Digital LTDA";

/** É item de sessão ao vivo (para créditos de sessão)? */
const isSession = (name: string) => /sess(ã|a)o|mentoria|palestra|workshop|treinamento|academy/i.test(name);

/**
 * Minuta de contrato em HTML autossuficiente (papel claro, tipografia da marca, acentos gold).
 * Documento legível/imprimível para assinatura; inclui a âncora /assinatura_contratante/ para o Docusign.
 */
export function contractHtml(d: ContractData): string {
  const cnpj = process.env.SALESTRACK_CNPJ ?? "[CNPJ Salestrack]";
  const endereco = process.env.SALESTRACK_ENDERECO ?? "[Endereço Salestrack]";
  const { byBrand, total } = proposalTotals(d.items);
  const ak = byBrand["andre_kachan"] ?? 0, st = byBrand["salestrack"] ?? 0, aios = byBrand["ai_os"] ?? 0;
  const inst = d.installments && d.installments > 1 ? d.installments : 1;
  const parcela = inst > 1 ? total / inst : total;
  const sessionItems = d.items.filter((it) => isSession(it.name));

  const rows = d.items.map((it) => `<tr>
    <td style="padding:8px 10px;border-bottom:1px solid #e6e0d5">${esc(it.name)}</td>
    <td style="padding:8px 10px;border-bottom:1px solid #e6e0d5">${esc(BRAND_LABELS[it.brand] ?? it.brand)}</td>
    <td style="padding:8px 10px;border-bottom:1px solid #e6e0d5;text-align:right">${it.qty}</td>
    <td style="padding:8px 10px;border-bottom:1px solid #e6e0d5;text-align:right">${esc(brl((Number(it.qty)||0)*(Number(it.price)||0)))}</td>
  </tr>`).join("");

  const clause = (n: number, titulo: string, corpo: string) =>
    `<section style="margin:22px 0">
      <h3 style="font-family:Georgia,serif;color:#0F1A24;font-size:16px;margin:0 0 8px">${n}. ${titulo}</h3>
      <div style="color:#2b2b2b;font-size:13px;line-height:1.6">${corpo}</div>
    </section>`;

  const escopoEntregas = d.items.map((it) => {
    const ent = deliverablesOf(it.description);
    if (!ent.length) return "";
    return `<div style="margin:6px 0"><b>${esc(it.name)}</b><ul style="margin:4px 0 0 18px">${ent.map((e) => `<li>${esc(e)}</li>`).join("")}</ul></div>`;
  }).join("");

  return `<!doctype html><html lang="pt-BR"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1">
<title>Contrato — ${esc(d.title)}</title></head>
<body style="margin:0;background:#f4f1ea;color:#0F1A24;font-family:'DM Sans',Arial,sans-serif">
<div style="max-width:820px;margin:0 auto;background:#fffdf8;padding:48px 56px;border:1px solid #e6e0d5">
  <p style="letter-spacing:.28em;text-transform:uppercase;color:#C89B3C;font-size:11px;margin:0 0 6px">Contrato de Prestação de Serviços</p>
  <h1 style="font-family:Georgia,serif;font-size:30px;line-height:1.1;margin:0 0 6px;color:#0F1A24">${esc(d.title)}</h1>
  <p style="color:#6b6b6b;font-size:12px;margin:0 0 24px">André Kachan · Salestrack AI — AI Operation System</p>

  ${clause(1, "Das Partes",
    `<p><b>CONTRATADA:</b> ${esc(SALESTRACK_NOME)}, inscrita no CNPJ sob nº ${esc(cnpj)}, com sede em ${esc(endereco)}.</p>
     <p><b>CONTRATANTE:</b> ${esc(d.org.name)}${d.org.cnpj ? `, inscrita no CNPJ sob nº ${esc(d.org.cnpj)}` : ""}, neste ato representada por ${esc(d.signerName || "[representante]")}.</p>`)}

  ${clause(2, "Do Objeto",
    `<p>Prestação do programa de transformação com inteligência artificial <b>${esc(d.title)}</b>, contemplando as frentes: ${(d.frentes ?? []).map(esc).join(", ") || "a definir"}.</p>
     <table style="width:100%;border-collapse:collapse;margin-top:10px;font-size:13px">
       <thead><tr>
         <th style="text-align:left;padding:8px 10px;border-bottom:2px solid #C89B3C">Item</th>
         <th style="text-align:left;padding:8px 10px;border-bottom:2px solid #C89B3C">Marca</th>
         <th style="text-align:right;padding:8px 10px;border-bottom:2px solid #C89B3C">Qtd</th>
         <th style="text-align:right;padding:8px 10px;border-bottom:2px solid #C89B3C">Valor</th>
       </tr></thead><tbody>${rows}</tbody></table>
     <p style="margin-top:8px;font-size:12px;color:#555">Subtotal André Kachan (conhecimento): <b>${esc(brl(ak))}</b> · Subtotal Salestrack AI (execução): <b>${esc(brl(st))}</b>${aios ? ` · AI OS: <b>${esc(brl(aios))}</b>` : ""}.</p>
     ${escopoEntregas ? `<div style="margin-top:12px;font-size:12px;color:#333"><b>Escopo e entregas:</b>${escopoEntregas}</div>` : ""}`)}

  ${clause(3, "Do Investimento e Forma de Pagamento",
    `<p>Investimento de implantação: <b>${esc(brl(total))}</b>${inst > 1 ? `, em <b>${inst}</b> parcelas mensais de <b>${esc(brl(parcela))}</b>` : ", à vista"}.</p>
     <p>Mensalidade <b>“Plataforma AI OS — forma e canal de entrega do programa”</b>: <b>${esc(brl(d.monthlyFee ?? 0))}/mês</b>, com reajuste anual pelo IPCA.</p>`)}

  ${clause(4, "Da Plataforma de IA",
    `<p>O programa opera sobre plataforma de IA corporativa contratada pelo CONTRATANTE — recomendação primária: <b>Claude Team ou Enterprise (Anthropic)</b>. A contratação e manutenção da assinatura é condição para a experiência completa do programa.</p>`)}

  ${sessionItems.length ? clause(5, "Dos Créditos de Sessão",
    `<p>Ficam incluídos os seguintes créditos de sessões ao vivo, com validade de 12 (doze) meses a partir da assinatura:</p>
     <ul style="margin:6px 0 0 18px">${sessionItems.map((it) => `<li>${esc(it.name)} — ${it.qty} crédito(s)</li>`).join("")}</ul>`) : ""}

  ${clause(sessionItems.length ? 6 : 5, "Da Vigência e Rescisão",
    `<p>O contrato vigora a partir da assinatura, pelo prazo do programa contratado, renovável. A rescisão imotivada por qualquer parte exige aviso prévio de 30 (trinta) dias, sem prejuízo das parcelas de implantação já vencidas.</p>`)}

  ${clause(sessionItems.length ? 7 : 6, "Da Confidencialidade e Propriedade Intelectual",
    `<p>As partes manterão sigilo sobre informações trocadas. O método, as skills, os prompts, os agentes e os materiais desenvolvidos permanecem <b>propriedade da CONTRATADA</b>, sendo concedida ao CONTRATANTE licença de uso durante a vigência.</p>`)}

  ${clause(sessionItems.length ? 8 : 7, "Da Proteção de Dados (LGPD)",
    `<p>As partes observarão a Lei nº 13.709/2018. Para os dados do programa, o CONTRATANTE atua como <b>controlador</b> e a CONTRATADA como <b>operadora</b>, tratando dados apenas para a execução do objeto.</p>`)}

  ${clause(sessionItems.length ? 9 : 8, "Do Foro",
    `<p>Fica eleito o foro da Comarca de <b>São Paulo/SP</b> para dirimir controvérsias.</p>`)}

  <div style="margin-top:40px;display:flex;gap:40px;flex-wrap:wrap">
    <div style="flex:1;min-width:220px">
      <div style="border-top:1px solid #0F1A24;padding-top:6px;font-size:12px">/assinatura_contratante/<br><b>CONTRATANTE</b><br>${esc(d.org.name)}<br>${esc(d.signerName || "")}</div>
    </div>
    <div style="flex:1;min-width:220px">
      <div style="border-top:1px solid #0F1A24;padding-top:6px;font-size:12px"><br><b>CONTRATADA</b><br>${esc(SALESTRACK_NOME)}</div>
    </div>
  </div>

  <p style="margin-top:36px;text-align:center;letter-spacing:.24em;text-transform:uppercase;color:#C89B3C;font-size:10px">André Kachan · Salestrack AI</p>
</div></body></html>`;
}
