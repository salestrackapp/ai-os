/**
 * Calculadora de ROI de um agente — a lógica pura.
 *
 * Porte fiel de roi() da academy antiga (content/academy.html:2399). O teste compara com um
 * vetor de entrada conhecido, para provar que o número que o aluno vê é o mesmo de hoje.
 *
 * Deliberadamente separada do módulo de ROI do ai-os (roi_reports): aquele é relatório mensal
 * publicado por org, com narrativa da IA; este é simulação de um agente, feita por alguém que
 * pode nem ter empresa. Misturar os dois exigiria organização e poluiria o histórico do cliente.
 */

export type EntradaRoi = {
  horasPorTarefa: number;      // rh
  tarefasPorMes: number;       // rv
  custoHora: number;           // rc
  custoErrosMes: number;       // re
  custoDesenvolvimento: number;// rd (único)
  custoApiMes: number;         // ra
  custoInfraMes: number;       // ri
  percentualAutomatizado: number; // rp (0–100)
};

export type SaidaRoi = {
  economiaMensal: number;
  custoMensal: number;
  ganhoLiquidoMes: number;
  roiPercentual: number;
  paybackMeses: number | null;  // null = não se paga com os números informados
  ganhoAnual: number;
  meses: { mes: number; investimentoAcumulado: number; economiaAcumulada: number; saldo: number }[];
};

export function entradaVazia(): EntradaRoi {
  return { horasPorTarefa: 0, tarefasPorMes: 0, custoHora: 0, custoErrosMes: 0,
    custoDesenvolvimento: 0, custoApiMes: 0, custoInfraMes: 0, percentualAutomatizado: 0 };
}

export function calcularRoiAgente(e: EntradaRoi): SaidaRoi {
  const p = (e.percentualAutomatizado || 0) / 100;
  const economiaMensal = (e.horasPorTarefa * e.tarefasPorMes * e.custoHora * p) + (e.custoErrosMes * p);
  const custoMensal = e.custoApiMes + e.custoInfraMes;
  const ganhoLiquidoMes = economiaMensal - custoMensal;
  const roiPercentual = custoMensal > 0 ? (ganhoLiquidoMes / custoMensal) * 100 : 0;
  const paybackMeses = ganhoLiquidoMes > 0 ? e.custoDesenvolvimento / ganhoLiquidoMes : null;
  const ganhoAnual = ganhoLiquidoMes * 12 - e.custoDesenvolvimento;

  const meses: SaidaRoi["meses"] = [];
  let investimento = e.custoDesenvolvimento;
  let economia = 0;
  for (let m = 1; m <= 12; m++) {
    investimento += custoMensal;
    economia += economiaMensal;
    meses.push({ mes: m, investimentoAcumulado: investimento, economiaAcumulada: economia, saldo: economia - investimento });
  }

  return { economiaMensal, custoMensal, ganhoLiquidoMes, roiPercentual, paybackMeses, ganhoAnual, meses };
}

export function reais(n: number): string {
  return "R$ " + Math.round(n).toLocaleString("pt-BR");
}
