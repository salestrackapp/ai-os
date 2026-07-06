"use server";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { currentMembership } from "@/lib/auth";
import { audit } from "@/lib/audit";

async function requireAdmin() {
  const m = await currentMembership();
  if (!m?.isSalestrackAdmin) throw new Error("Sem permissão.");
  return m;
}

function slugify(s: string) {
  return s.toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "").replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "").slice(0, 60);
}

// ---------- Receitas ----------
export async function saveRecipe(id: string | null, formData: FormData) {
  await requireAdmin();
  const supabase = await createClient();
  const titulo = String(formData.get("titulo") ?? "").trim();
  if (!titulo) throw new Error("Título é obrigatório.");
  const passos = String(formData.get("passos") ?? "").split("\n").map((l) => l.trim()).filter(Boolean);
  const tempoRaw = String(formData.get("tempo_min") ?? "").trim();
  const trilhaId = String(formData.get("trilha_id") ?? "").trim();
  const row = {
    titulo,
    frente: String(formData.get("frente") ?? "").trim() || null,
    perfil: String(formData.get("perfil") ?? "operacional"),
    nivel: String(formData.get("nivel") ?? "iniciante"),
    tempo_min: tempoRaw ? Number(tempoRaw) : null,
    oque: String(formData.get("oque") ?? "").trim() || null,
    porque: String(formData.get("porque") ?? "").trim() || null,
    ganho: String(formData.get("ganho") ?? "").trim() || null,
    passos,
    prompt_pronto: String(formData.get("prompt_pronto") ?? "").trim() || null,
    trilha_id: trilhaId || null,
    ordem: Number(String(formData.get("ordem") ?? "0")) || 0,
    needs_review: formData.get("needs_review") === "on",
    published: formData.get("published") === "on",
    updated_at: new Date().toISOString(),
  };

  if (id) {
    const { error } = await supabase.from("playbook_recipes").update(row).eq("id", id);
    if (error) throw new Error(error.message);
    await audit("recipe.update", "playbook_recipes", id, { titulo }, undefined);
  } else {
    const slug = slugify(titulo) || `receita-${Date.now()}`;
    const { data, error } = await supabase.from("playbook_recipes").insert({ ...row, slug }).select("id").single();
    if (error) throw new Error(error.message);
    await audit("recipe.create", "playbook_recipes", data.id, { titulo }, undefined);
  }
  revalidatePath("/admin/estudio");
  revalidatePath("/portal/playbook");
  redirect("/admin/estudio");
}

export async function toggleRecipePublished(id: string, next: boolean) {
  await requireAdmin();
  const supabase = await createClient();
  const { error } = await supabase.from("playbook_recipes").update({ published: next, updated_at: new Date().toISOString() }).eq("id", id);
  if (error) throw new Error(error.message);
  await audit("recipe.publish", "playbook_recipes", id, { published: next }, undefined);
  revalidatePath("/admin/estudio"); revalidatePath("/portal/playbook");
}

export async function deleteRecipe(id: string) {
  await requireAdmin();
  const supabase = await createClient();
  const { error } = await supabase.from("playbook_recipes").delete().eq("id", id);
  if (error) throw new Error(error.message);
  await audit("recipe.delete", "playbook_recipes", id, null, undefined);
  revalidatePath("/admin/estudio"); revalidatePath("/portal/playbook");
}

// ---------- Trilhas ----------
export async function saveTrilha(formData: FormData) {
  await requireAdmin();
  const supabase = await createClient();
  const id = String(formData.get("id") ?? "").trim();
  const titulo = String(formData.get("titulo") ?? "").trim();
  if (!titulo) throw new Error("Título é obrigatório.");
  const row = {
    titulo,
    perfil: String(formData.get("perfil") ?? "operacional"),
    descricao: String(formData.get("descricao") ?? "").trim() || null,
    ordem: Number(String(formData.get("ordem") ?? "0")) || 0,
    published: formData.get("published") === "on",
  };
  if (id) {
    const { error } = await supabase.from("playbook_trilhas").update(row).eq("id", id);
    if (error) throw new Error(error.message);
  } else {
    const slug = slugify(titulo) || `trilha-${Date.now()}`;
    const { error } = await supabase.from("playbook_trilhas").insert({ ...row, slug });
    if (error) throw new Error(error.message);
  }
  await audit("trilha.save", "playbook_trilhas", id || undefined, { titulo }, undefined);
  revalidatePath("/admin/estudio"); revalidatePath("/portal/playbook");
}

// ---------- Criar Receita por IA ----------
export async function generateRecipeByAi(formData: FormData) {
  await requireAdmin();
  const { runCopilot } = await import("@/lib/agents/copilot");
  const tema = String(formData.get("tema") ?? "").trim();
  const trilhaId = String(formData.get("trilha_id") ?? "").trim();
  const perfil = String(formData.get("perfil") ?? "operacional");
  if (!tema) throw new Error("Descreva o tema da receita.");
  const task = `Crie uma Receita de Playbook (uso de IA no dia a dia com o Claude) sobre: "${tema}". Perfil-alvo: ${perfil}.
Responda SOMENTE com um JSON válido (sem markdown, sem cercas) com EXATAMENTE estas chaves:
{"titulo": string, "frente": string, "nivel": "iniciante"|"intermediario"|"avancado", "tempo_min": number, "oque": string, "porque": string, "ganho": string, "passos": [5 strings curtas e acionáveis], "prompt_pronto": string}
O "prompt_pronto" deve ser um prompt real e reutilizável para o Claude, com placeholders entre colchetes quando fizer sentido. Tom prático.`;
  const r = await runCopilot({ task, maxTokens: 1100 });
  if (r.degraded) throw new Error("IA indisponível (sem ANTHROPIC_API_KEY).");
  const m = r.text.match(/\{[\s\S]*\}/);
  if (!m) throw new Error("A IA não retornou JSON válido. Tente de novo.");
  let obj: Record<string, unknown>;
  try { obj = JSON.parse(m[0]); } catch { throw new Error("Falha ao interpretar a receita gerada. Tente de novo."); }
  const titulo = String(obj.titulo ?? tema).trim();
  const supabase = await createClient();
  const slug = (slugify(titulo) || `receita-${Date.now()}`);
  const passos = Array.isArray(obj.passos) ? obj.passos.map(String) : [];
  const { data, error } = await supabase.from("playbook_recipes").insert({
    slug, titulo, frente: String(obj.frente ?? "") || null, perfil,
    nivel: ["iniciante", "intermediario", "avancado"].includes(String(obj.nivel)) ? String(obj.nivel) : "iniciante",
    tempo_min: Number(obj.tempo_min) || null, oque: String(obj.oque ?? "") || null, porque: String(obj.porque ?? "") || null,
    ganho: String(obj.ganho ?? "") || null, passos, prompt_pronto: String(obj.prompt_pronto ?? "") || null,
    trilha_id: trilhaId || null, published: false, needs_review: true,
  }).select("id").single();
  if (error) throw new Error(error.message);
  await audit("recipe.ai_create", "playbook_recipes", data.id, { tema }, undefined);
  revalidatePath("/admin/estudio");
  redirect(`/admin/estudio/receita/${data.id}`);
}

// ---------- Prompts dos agentes internos ----------
export async function saveAgentPrompt(agentKey: string, formData: FormData) {
  await requireAdmin();
  const supabase = await createClient();
  const system_prompt = String(formData.get("system_prompt") ?? "").trim();
  if (!system_prompt) throw new Error("Prompt não pode ser vazio.");
  const ativar = formData.get("ativar") === "on";
  const { data: last } = await supabase.from("agent_prompts").select("versao").eq("agent_key", agentKey).order("versao", { ascending: false }).limit(1).maybeSingle();
  const versao = (last?.versao ?? 0) + 1;
  if (ativar) await supabase.from("agent_prompts").update({ ativo: false }).eq("agent_key", agentKey);
  const { error } = await supabase.from("agent_prompts").insert({ agent_key: agentKey, versao, system_prompt, ativo: ativar });
  if (error) throw new Error(error.message);
  await audit("agent_prompt.save", "agent_prompts", undefined, { agentKey, versao, ativo: ativar }, undefined);
  revalidatePath("/admin/estudio");
}

export async function setPromptActive(id: string, agentKey: string) {
  await requireAdmin();
  const supabase = await createClient();
  await supabase.from("agent_prompts").update({ ativo: false }).eq("agent_key", agentKey);
  const { error } = await supabase.from("agent_prompts").update({ ativo: true }).eq("id", id);
  if (error) throw new Error(error.message);
  await audit("agent_prompt.activate", "agent_prompts", id, { agentKey }, undefined);
  revalidatePath("/admin/estudio");
}

// ---------- Catálogo de sessões ----------
export async function saveCatalog(formData: FormData) {
  await requireAdmin();
  const supabase = await createClient();
  const id = String(formData.get("id") ?? "").trim();
  const titulo = String(formData.get("titulo") ?? "").trim();
  if (!titulo) throw new Error("Título é obrigatório.");
  const dur = String(formData.get("duracao_min") ?? "").trim();
  const row = {
    titulo,
    marca: String(formData.get("marca") ?? "AK"),
    modalidade: String(formData.get("modalidade") ?? "online"),
    duracao_min: dur ? Number(dur) : null,
    descricao: String(formData.get("descricao") ?? "").trim() || null,
    calendly_url: String(formData.get("calendly_url") ?? "").trim() || null,
    published: formData.get("published") === "on",
  };
  if (id) {
    const { error } = await supabase.from("session_catalog").update(row).eq("id", id);
    if (error) throw new Error(error.message);
  } else {
    const slug = slugify(titulo) || `sessao-${Date.now()}`;
    const { error } = await supabase.from("session_catalog").insert({ ...row, slug });
    if (error) throw new Error(error.message);
  }
  await audit("catalog.save", "session_catalog", id || undefined, { titulo }, undefined);
  revalidatePath("/admin/estudio"); revalidatePath("/portal/sessoes");
}
