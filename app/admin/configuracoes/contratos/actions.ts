"use server";
import { revalidatePath } from "next/cache";
import { setSetting, getContractSettings } from "@/lib/settings";
import { audit } from "@/lib/audit";
import { exigirAdmin } from "@/lib/auth";

export async function saveContractSettings(formData: FormData) {
  await exigirAdmin();
  const cur = await getContractSettings();
  const extras: { titulo: string; corpo: string }[] = [];
  const titulos = formData.getAll("extra_titulo").map(String);
  const corpos = formData.getAll("extra_corpo").map(String);
  for (let i = 0; i < titulos.length; i++) {
    if (titulos[i].trim() && (corpos[i] ?? "").trim()) extras.push({ titulo: titulos[i].trim(), corpo: (corpos[i] ?? "").trim() });
  }
  const value = {
    ...cur,
    contratada_nome: String(formData.get("contratada_nome") ?? cur.contratada_nome).trim(),
    contratada_cnpj: String(formData.get("contratada_cnpj") ?? cur.contratada_cnpj).trim(),
    contratada_endereco: String(formData.get("contratada_endereco") ?? cur.contratada_endereco).trim(),
    foro: String(formData.get("foro") ?? cur.foro).trim(),
    aviso_previo_dias: Number(formData.get("aviso_previo_dias")) || cur.aviso_previo_dias,
    creditos_validade_meses: Number(formData.get("creditos_validade_meses")) || cur.creditos_validade_meses,
    reajuste_indice: String(formData.get("reajuste_indice") ?? cur.reajuste_indice).trim(),
    clausula_plataforma: String(formData.get("clausula_plataforma") ?? cur.clausula_plataforma).trim(),
    clausula_confidencialidade: String(formData.get("clausula_confidencialidade") ?? cur.clausula_confidencialidade).trim(),
    clausula_lgpd: String(formData.get("clausula_lgpd") ?? cur.clausula_lgpd).trim(),
    clausula_rescisao: String(formData.get("clausula_rescisao") ?? cur.clausula_rescisao).trim(),
    clausulas_extras: extras,
  };
  await setSetting("contract", value);
  await audit("settings.contract", "app_settings", "contract", { keys: Object.keys(value) });
  revalidatePath("/admin/configuracoes/contratos");
}
