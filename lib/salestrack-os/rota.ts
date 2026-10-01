import { z } from "zod";
export const ROTA = [
 { key: "resultado", name: "Resultado", question: "Qual prioridade empresarial justifica a transformação?", fields: [{key:"prioridade",label:"Prioridade e área envolvida"},{key:"indicador",label:"Indicador, linha de base e meta acordada"},{key:"decisor",label:"Decisor e responsável pelo resultado"}] },
 { key: "operacao", name: "Operação", question: "Como o trabalho acontece hoje e onde precisa mudar?", fields: [{key:"processo",label:"Processo atual e pessoas envolvidas"},{key:"evidencia",label:"Evidência do problema e fonte (separar hipóteses)"},{key:"futuro",label:"Processo futuro e critério de aceite"}] },
 { key: "tecnologia", name: "Tecnologia", question: "Quais dados, integrações e capacidades viabilizam a mudança?", fields: [{key:"sistemas",label:"Sistemas e dados disponíveis"},{key:"aplicacao",label:"Aplicação digital/IA e piloto proposto"},{key:"governanca",label:"Acessos, restrições, riscos e responsável"}] },
 { key: "aceleracao", name: "Aceleração", question: "Como implementar, garantir adoção e medir a evolução?", fields: [{key:"plano",label:"Plano de implementação, responsáveis e marcos"},{key:"adocao",label:"Capacitação e rotina de adoção"},{key:"medicao",label:"Cadência de medição e próximo passo com data"}] },
] as const;
export const rotaSchema = z.object({dealId:z.string().uuid(), revision:z.string().nullable(), answers:z.record(z.string().max(4000)).refine(a=>Object.keys(a).every(k=>ROTA.some(s=>s.fields.some(f=>f.key===k))),"Campo desconhecido")});
export type RotaAnswers = Record<string,string>;
export function rotaReadiness(answers:RotaAnswers) {
 return ROTA.map(s=>({...s,missing:s.fields.filter(f=>!(answers[f.key]||"").trim())}));
}
export function rotaHandoff(title:string, answers:RotaAnswers) {
 return `ROTA · ${title}\nRascunho de diagnóstico — revisar evidências e obter aceite do cliente.\n\n`+ROTA.map(s=>`${s.name}\n`+s.fields.map(f=>`${f.label}: ${answers[f.key]?.trim()||"PENDENTE — confirmar com o cliente"}`).join("\n")).join("\n\n");
}
export const ROTA_GUIDANCE = "Aplique ROTA: Resultado (prioridade, indicador e decisor), Operação (processo e evidência), Tecnologia (dados, sistemas, piloto e governança), Aceleração (implementação, adoção e mensuração). Identifique campos ausentes e recomende a próxima pergunta. Texto preenchido não prova validação pelo cliente. Não avance automaticamente o funil nem envie propostas.";

export function rotaNextSteps(deals:{id:string;title:string}[], records:Record<string,RotaAnswers>) {
 return deals.map(d=>({deal:d,missing:rotaReadiness(records[d.id]||{}).flatMap(s=>s.missing)})).filter(d=>d.missing.length>0).slice(0,3);
}
