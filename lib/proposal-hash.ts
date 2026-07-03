import "server-only";
import crypto from "node:crypto";
import { BRAND_LABELS, proposalTotals } from "@/lib/types";
import type { ProposalDoc } from "@/components/proposals/ProposalDocument";

const esc = (s: unknown) => String(s ?? "").replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c] as string));

/** HTML canônico e determinístico da proposta (sem React) — base do content_hash. */
export function proposalHtml(p: ProposalDoc): string {
  const items = p.items ?? [];
  const { byBrand, total } = proposalTotals(items);
  const rows = items.map((it) => `<tr><td>${esc(it.name)}</td><td>${esc(BRAND_LABELS[it.brand] ?? it.brand)}</td><td>${it.qty}</td><td>${it.price}</td></tr>`).join("");
  const phases = (p.timeline ?? []).map((f) => `<li>${f.n}. ${esc(f.titulo)} (${f.meses}m): ${esc(f.descricao)}</li>`).join("");
  const frentes = (p.frentes ?? []).map((f) => `<span>${esc(f)}</span>`).join("");
  return [
    `<article data-proposal>`,
    `<h1>${esc(p.title)}</h1>`,
    `<p class="client">${esc(p.client_name)}</p>`,
    `<p class="valid">${esc(p.valid_until)}</p>`,
    `<div class="frentes">${frentes}</div>`,
    `<table class="invest"><tbody>${rows}</tbody></table>`,
    `<p class="subtotals">AK:${byBrand["andre_kachan"] ?? 0}|ST:${byBrand["salestrack"] ?? 0}|AIOS:${byBrand["ai_os"] ?? 0}|TOTAL:${total}</p>`,
    `<ol class="timeline">${phases}</ol>`,
    `<div class="platform">${esc(p.platform_plan_md)}</div>`,
    `<p class="monthly">AI_OS_MENSAL:${p.monthly_platform_fee ?? 0}</p>`,
    `<p class="installments">${p.installments ?? 1}</p>`,
    `<div class="conditions">${esc(p.conditions_md)}</div>`,
    `<p class="version">v${p.version ?? 1}</p>`,
    `</article>`,
  ].join("");
}

export function proposalHash(p: ProposalDoc): string {
  return crypto.createHash("sha256").update(proposalHtml(p), "utf8").digest("hex");
}
