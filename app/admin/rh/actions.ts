"use server";
import { revalidatePath } from "next/cache";
import { exigirRh, comChaveDeCifra, rhClient, auditarRh } from "@/lib/rh/client";

/**
 * Ações do RH.
 *
 * Toda ação passa por `exigirRh(papel)` — a autorização vive no banco de RH, não aqui. Ser admin
 * do AI OS não abre nada disto.
 */

export async function cadastrarPessoa(dados: {
  nome: string; email: string; cpf: string; cargo: string; departamento: string;
  regime: string; admissao: string;
}) {
  await exigirRh("rh_admin");
  if (!dados.nome.trim()) throw new Error("Informe o nome.");
  if (!dados.admissao) throw new Error("Informe a data de admissão.");

  await comChaveDeCifra(async (sb) => {
    // O CPF é cifrado e hasheado no BANCO, não aqui: assim ele nunca trafega em claro entre a
    // aplicação e o log de consulta, e a chave não precisa sair do servidor de banco.
    const { data: cifrado } = dados.cpf.trim()
      ? await sb.rpc("rh_cifrar", { p_texto: dados.cpf.replace(/\D/g, "") })
      : { data: null };
    const { data: hash } = dados.cpf.trim()
      ? await sb.rpc("rh_hash_cpf", { p_cpf: dados.cpf })
      : { data: null };

    const { error } = await sb.from("employees").insert({
      nome: dados.nome.trim(),
      email_corporativo: dados.email.trim().toLowerCase() || null,
      cpf_cifrado: cifrado, cpf_hash: hash,
      cargo: dados.cargo.trim() || null,
      departamento: dados.departamento.trim() || null,
      regime: dados.regime, admissao: dados.admissao,
    });
    if (error) {
      throw new Error(/duplicate|unique/i.test(error.message)
        ? "Já existe alguém com este e-mail ou CPF."
        : error.message);
    }
  });

  await auditarRh({ acao: "pessoa.cadastrada", recurso: "employees", detalhe: { nome: dados.nome } });
  revalidatePath("/admin/rh");
}

export async function desligarPessoa(id: string, data: string, motivo: string) {
  await exigirRh("rh_admin");
  if (!data) throw new Error("Informe a data do desligamento.");
  const sb = rhClient();
  const { error } = await sb.from("employees")
    .update({ desligamento: data, motivo_desligamento: motivo.trim() || null, updated_at: new Date().toISOString() })
    .eq("id", id);
  if (error) throw new Error(error.message);
  await auditarRh({ acao: "pessoa.desligada", recurso: "employees", employeeId: id, detalhe: { data } });
  revalidatePath("/admin/rh");
}

export async function registrarAusencia(dados: {
  employeeId: string; tipo: string; inicio: string; fim: string; observacao: string;
}) {
  await exigirRh("rh_gestor");
  if (!dados.inicio || !dados.fim) throw new Error("Informe as datas.");
  if (dados.fim < dados.inicio) throw new Error("A data final não pode ser antes da inicial.");

  const sb = rhClient();
  const { error } = await sb.from("ausencias").insert({
    employee_id: dados.employeeId, tipo: dados.tipo,
    inicio: dados.inicio, fim: dados.fim,
    observacao: dados.observacao.trim() || null,
    // Registrada pelo RH já nasce aprovada; pedido do próprio colaborador entraria como solicitada.
    status: "aprovada", aprovado_em: new Date().toISOString(),
  });
  if (error) throw new Error(error.message);
  await auditarRh({
    acao: "ausencia.registrada", recurso: "ausencias", employeeId: dados.employeeId,
    detalhe: { tipo: dados.tipo, inicio: dados.inicio, fim: dados.fim },
  });
  revalidatePath("/admin/rh");
}

/**
 * Lê a remuneração. Passa pela função do banco, que verifica papel E audita a leitura — não há
 * caminho que decifre salário sem deixar rastro.
 */
export async function verRemuneracao(employeeId: string): Promise<{ valor: number; tipo: string; desde: string }[]> {
  await exigirRh("rh_admin");
  return comChaveDeCifra(async (sb) => {
    const { data, error } = await sb.rpc("rh_ler_remuneracao", { p_employee_id: employeeId });
    if (error) throw new Error(error.message);
    return (data ?? []).map((r: Record<string, unknown>) => ({
      valor: Number(r.valor), tipo: String(r.tipo), desde: String(r.vigencia_inicio),
    }));
  });
}

export async function registrarRemuneracao(dados: {
  employeeId: string; valor: string; tipo: string; desde: string; motivo: string;
}) {
  await exigirRh("rh_admin");
  const valor = Number(dados.valor.replace(/\./g, "").replace(",", "."));
  if (!Number.isFinite(valor) || valor <= 0) throw new Error("Informe um valor válido.");

  await comChaveDeCifra(async (sb) => {
    const { data: cifrado } = await sb.rpc("rh_cifrar", { p_texto: String(valor) });
    // Encerra a vigência anterior: sem isso, duas remunerações ficariam "vigentes" ao mesmo tempo
    // e nenhum relatório saberia qual vale.
    await sb.from("employee_remuneracao")
      .update({ vigencia_fim: dados.desde })
      .eq("employee_id", dados.employeeId).eq("tipo", dados.tipo).is("vigencia_fim", null);

    const { error } = await sb.from("employee_remuneracao").insert({
      employee_id: dados.employeeId, valor_cifrado: cifrado, tipo: dados.tipo,
      vigencia_inicio: dados.desde, motivo: dados.motivo.trim() || null,
    });
    if (error) throw new Error(error.message);
  });

  await auditarRh({
    acao: "remuneracao.registrada", recurso: "employee_remuneracao",
    employeeId: dados.employeeId, detalhe: { tipo: dados.tipo, desde: dados.desde },
  });
  revalidatePath("/admin/rh");
}
