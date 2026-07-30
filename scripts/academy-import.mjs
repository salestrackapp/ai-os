/**
 * Extrai a trilha da Academy do HTML de origem e semeia no Supabase.
 *
 *   node scripts/academy-import.mjs <caminho-do-academy.html> [--seed]
 *
 * Sem --seed, apenas extrai para supabase/seed/academy_trilha.json e imprime o manifesto.
 * Com --seed, também grava no banco (idempotente por chave natural).
 *
 * Por que node:vm e não regex: TRILHA, DB_P, DB_T, DB_G e CL são literais de objeto/array com
 * template strings. Avaliar num contexto vazio devolve os objetos reais, sem risco de erro de
 * transcrição — a migração vira cópia, não reinterpretação.
 */
import fs from "node:fs";
import path from "node:path";
import vm from "node:vm";
import crypto from "node:crypto";
import { createClient } from "@supabase/supabase-js";

const HTML = process.argv[2];
const SEMEAR = process.argv.includes("--seed");
if (!HTML) { console.error("uso: node scripts/academy-import.mjs <academy.html> [--seed]"); process.exit(1); }

const src = fs.readFileSync(HTML, "utf8");

/** Lê um literal de array pelo nome, equilibrando colchetes e respeitando strings. */
function literal(nome) {
  const re = new RegExp(`(?:const|let|var)\\s+${nome}\\s*=\\s*\\[`);
  const m = re.exec(src);
  if (!m) throw new Error(`literal ${nome} não encontrado`);
  const abre = src.indexOf("[", m.index);
  let d = 0, aspas = null, esc = false;
  for (let p = abre; p < src.length; p++) {
    const ch = src[p];
    if (esc) { esc = false; continue; }
    if (ch === "\\") { esc = true; continue; }
    if (aspas) { if (ch === aspas) aspas = null; continue; }
    if (ch === '"' || ch === "'" || ch === "`") { aspas = ch; continue; }
    if (ch === "[") d++;
    else if (ch === "]" && --d === 0) return vm.runInNewContext("(" + src.slice(abre, p + 1) + ")");
  }
  throw new Error(`literal ${nome} não fechou`);
}

// TRILHA é a fonte de verdade. MODS é DESCARTADO de propósito: ele diverge da TRILHA
// (diz 2 tarefas onde há 3, nos módulos 2 a 5), e é essa divergência que faz a academy antiga
// marcar módulo como concluído cedo demais.
const TRILHA = literal("TRILHA");

// Nome de cliente real não vira exemplo de material didático: troca por marcador genérico.
// Aplicado na importação para valer também numa reimportação do conteúdo de origem.
function anonimizar(v) {
  if (typeof v === "string") return v.replace(/Nouryon/g, "[nome da empresa]");
  if (Array.isArray(v)) return v.map(anonimizar);
  if (v && typeof v === "object") return Object.fromEntries(Object.entries(v).map(([k, x]) => [k, anonimizar(x)]));
  return v;
}
const refs = anonimizar({ prompts: literal("DB_P"), tools: literal("DB_T"), glossario: literal("DB_G"), checklist: literal("CL") });

const CURSO = {
  slug: "agentes-de-ia",
  titulo: "Agentes de IA",
  subtitulo: "Do conceito ao agente em produção, com segurança e ROI medido.",
  nivel: "iniciante",
  carga_horaria_min: TRILHA.reduce((a, m) => a + (parseInt(String(m.time).replace(/\D/g, ""), 10) || 0), 0),
};

const modulos = anonimizar(TRILHA).map((m) => ({
  ordem: m.n,
  titulo: m.title,
  icone: m.icon ?? null,
  cor: m.cor ?? null,
  objetivo: m.objetivo ?? null,
  tempo_label: m.time ?? null,
  tempo_min: parseInt(String(m.time ?? "").replace(/\D/g, ""), 10) || null,
  // a seção é copiada INTEGRALMENTE; tipo e titulo saem para colunas próprias e o resto vira corpo
  licoes: (m.sections ?? []).map((s, i) => {
    const { tipo, titulo, ...corpo } = s;
    return { ordem: i, tipo, titulo, corpo };
  }),
  tarefas: (m.tasks ?? []).map((t, i) => ({ ordem: i, texto: t })),
}));

const pacote = { curso: CURSO, modulos, referencias: refs };

const destino = path.join(process.cwd(), "supabase", "seed", "academy_trilha.json");
fs.mkdirSync(path.dirname(destino), { recursive: true });
fs.writeFileSync(destino, JSON.stringify(pacote, null, 2));

// ── Manifesto ────────────────────────────────────────────────────────────────
const licoes = modulos.flatMap((m) => m.licoes);
const tarefas = modulos.flatMap((m) => m.tarefas);
const porTipo = licoes.reduce((a, l) => ({ ...a, [l.tipo]: (a[l.tipo] ?? 0) + 1 }), {});
console.log(`módulos ${modulos.length} · aulas ${licoes.length} · tarefas ${tarefas.length}`);
console.log(`referências: prompts ${refs.prompts.length} · tools ${refs.tools.length} · glossário ${refs.glossario.length} · checklist ${refs.checklist.length}`);
console.log(`tipos (${Object.keys(porTipo).length}):`, Object.entries(porTipo).map(([t, n]) => `${t}=${n}`).join(" "));
console.log("sha256 por módulo:");
for (const m of modulos) {
  const h = crypto.createHash("sha256").update(JSON.stringify(m)).digest("hex").slice(0, 12);
  console.log(`  ${String(m.ordem).padStart(2)} ${h}  ${m.titulo}`);
}
console.log(`\ngravado em ${path.relative(process.cwd(), destino)}`);

if (!SEMEAR) process.exit(0);

// ── Semeadura ────────────────────────────────────────────────────────────────
for (const linha of fs.readFileSync(".env.local", "utf8").split("\n")) {
  const i = linha.indexOf("=");
  if (i > 0 && !linha.startsWith("#")) process.env[linha.slice(0, i).trim()] ||= linha.slice(i + 1).trim().replace(/^["']|["']$/g, "");
}
const sb = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY, { auth: { persistSession: false } });

const { data: cursoRow, error: eCurso } = await sb.from("academy_courses")
  .upsert({ ...CURSO, status: "publicado", acesso: "restrito", certificado: true }, { onConflict: "slug" })
  .select("id").single();
if (eCurso) throw eCurso;
console.log(`\ncurso ${cursoRow.id}`);

for (const m of modulos) {
  const { data: mod, error: eMod } = await sb.from("academy_modules")
    .upsert({
      course_id: cursoRow.id, ordem: m.ordem, titulo: m.titulo, icone: m.icone,
      cor: m.cor, objetivo: m.objetivo, tempo_label: m.tempo_label, tempo_min: m.tempo_min,
    }, { onConflict: "course_id,ordem" })
    .select("id").single();
  if (eMod) throw eMod;

  if (m.licoes.length) {
    const { error } = await sb.from("academy_lessons").upsert(
      m.licoes.map((l) => ({ module_id: mod.id, ordem: l.ordem, titulo: l.titulo, tipo: l.tipo, corpo: l.corpo })),
      { onConflict: "module_id,ordem" });
    if (error) throw error;
  }
  if (m.tarefas.length) {
    const { error } = await sb.from("academy_tasks").upsert(
      m.tarefas.map((t) => ({ module_id: mod.id, ordem: t.ordem, texto: t.texto })),
      { onConflict: "module_id,ordem" });
    if (error) throw error;
  }
  console.log(`  módulo ${m.ordem}: ${m.licoes.length} aulas, ${m.tarefas.length} tarefas`);
}
console.log("\nsemeadura concluída.");

// ── Referências (87 registros: prompts, ferramentas, glossário, checklist) ────
// Mapeadas para COLUNAS reais — a tela de edição precisa ser um formulário, não um editor de JSON.
const linhas = [
  ...refs.prompts.map((p, i) => ({
    tipo: "prompt", chave: p.id, ordem: i, nome: p.nome, categoria: p.area,
    icone: p.icon, cor: p.cor, conteudo: p.prompt, impacto: p.impacto,
    ferramentas: Array.isArray(p.tools) ? p.tools.join("\n") : String(p.tools ?? ""),
  })),
  ...refs.tools.map((t, i) => ({
    tipo: "ferramenta", chave: t.id, ordem: i, nome: t.nome, categoria: t.cat,
    icone: t.icon, sistema: t.sis, conteudo: t.desc, parametros: t.params, retorno: t.ret,
  })),
  ...refs.glossario.map((g, i) => ({
    tipo: "termo", chave: null, ordem: i, nome: g.t, categoria: g.cat, cor: g.cor,
    conteudo: g.def, termo_en: g.en, exemplo: g.ex,
  })),
  ...refs.checklist.map((c, i) => ({
    tipo: "checklist", chave: c.id, ordem: i, nome: c.txt, categoria: c.cat,
    conteudo: c.det, risco: String(c.risk ?? "").toLowerCase().replace("é", "e"),
  })),
];

// glossário não tem id na fonte; usa (tipo, ordem) como identidade para a reimportação
for (const l of linhas) if (l.chave === null) l.chave = `termo-${l.ordem}`;

const { error: eRef } = await sb.from("academy_referencias").upsert(linhas, { onConflict: "tipo,chave" });
if (eRef) throw eRef;
const porTipoRef = linhas.reduce((a, l) => ({ ...a, [l.tipo]: (a[l.tipo] ?? 0) + 1 }), {});
console.log("referências:", Object.entries(porTipoRef).map(([t, n]) => `${t}=${n}`).join(" "));
