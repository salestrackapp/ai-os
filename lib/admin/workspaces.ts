import { AREAS, type SubSection } from "./nav";
export type WorkspaceGroup={label:string;items:SubSection[]};
export type Workspace={key:string;label:string;href:string;icon:string;groups:WorkspaceGroup[]};
const all=AREAS.flatMap(a=>a.sections);
const extra:SubSection[]=[
 {href:"/admin/hoje",label:"Visão operacional",icon:"dashboard",desc:"Acompanhamento das jornadas e entregas."},
 {href:"/admin/dashboard",label:"Indicadores gerais",icon:"activity",desc:"Visão consolidada da operação."},
 {href:"/admin/configuracoes",label:"Conta e segurança",icon:"shield",desc:"Acesso e autenticação da conta."},
];
const labels:Record<string,string>={"/admin/crm":"Funil de negócios","/admin/crm/contas":"Empresas","/admin/crm/contatos":"Contatos","/admin/crm/importar":"Importar dados","/admin/central":"Meu dia","/admin/prospeccao/buscas":"Buscas no Apollo","/admin/prospeccao/sinais-linkedin":"Sinais públicos do LinkedIn"};
const catalog=[...all,...extra].map(s=>({...s,label:labels[s.href]||s.label}));
const used=new Set<string>();
function group(label:string,paths:string[]):WorkspaceGroup {
 return {label,items:paths.map(h=>{const s=catalog.find(s=>s.href===h);if(!s)throw Error(`Destino ausente: ${h}`);if(used.has(h))throw Error(`Destino duplicado: ${h}`);used.add(h);return s;})};
}
export const WORKSPACES:Workspace[]=[
 {key:"dia",label:"Meu dia",href:"/admin/central",icon:"dashboard",groups:[group("Execução",["/admin/central","/admin/tarefas"]),group("Visão da operação",["/admin/hoje","/admin/dashboard"])]},
 {key:"crm",label:"CRM",href:"/admin/crm",icon:"crm",groups:[group("Base e funil",["/admin/crm","/admin/crm/contas","/admin/crm/contatos","/admin/crm/importar"]),group("Diagnóstico",["/admin/rota"]),group("Propostas e contratos",["/admin/propostas","/admin/contratos","/admin/catalogo","/admin/juridico"])]},
 {key:"prospeccao",label:"Prospecção",href:"/admin/prospeccao",icon:"target",groups:[group("Encontrar oportunidades",["/admin/prospeccao","/admin/prospeccao/buscas","/admin/prospeccao/sinais-linkedin","/admin/prospeccao/mensagens","/admin/prospeccao/coleta-externa","/admin/sinais"]),group("Engajar",["/admin/prospeccao/cadencias","/admin/prospeccao/aprovacao"])]},
 {key:"relacionamento",label:"Relacionamento",href:"/admin/relacionamento",icon:"chat",groups:[group("Atendimento",["/admin/relacionamento","/admin/relacionamento/relatorios"]),group("Regras e configuração",["/admin/comunicacao","/admin/relacionamento/config"])]},
 {key:"projetos",label:"Projetos e clientes",href:"/admin/jornadas",icon:"rocket",groups:[group("Projetos",["/admin/jornadas","/admin/jornadas/nova","/admin/entregas"]),group("Clientes",["/admin/clientes","/admin/onboarding","/admin/programas"]),group("Acompanhamento",["/admin/consultor","/admin/roi"])]},
 {key:"conteudo",label:"Conteúdo e capacitação",href:"/admin/estudio-area",icon:"book",groups:[group("Materiais",["/admin/entregaveis","/admin/entregaveis/novo","/admin/biblioteca-templates","/admin/entregaveis/identidade"]),group("Método e formação",["/admin/estudio","/admin/metodo","/admin/academy/matriculas","/admin/academy/prova","/admin/academy/referencias","/academy"]),group("Marketing",["/admin/marketing","/admin/marketing/email","/admin/marketing/email/lista"])]},
 {key:"gestao",label:"Gestão",href:"/admin/administracao",icon:"wallet",groups:[group("Pessoas e finanças",["/admin/rh","/admin/administracao","/admin/financeiro","/admin/monetizacao"])]},
 {key:"config",label:"Configurações e IA",href:"/admin/configuracoes",icon:"settings",groups:[group("Integrações e agentes",["/admin/configuracoes/parametros","/admin/agentes","/admin/operacoes","/admin/operacoes/ia","/admin/configuracoes/notificacoes"]),group("Conta e equipe",["/admin/configuracoes","/admin/configuracoes/equipe","/admin/plataforma"]),group("Governança",["/admin/configuracoes/contratos","/admin/configuracoes/sinais","/admin/lgpd","/admin/lgpd/registro","/admin/lgpd/incidentes","/admin/configuracoes/auditoria"]),group("Ajuda e padrões",["/admin/ajuda","/admin/design-system"])]},
];
// Uma seção nova permanece acessível no diretório até receber agrupamento editorial.
const remaining=catalog.filter(s=>!used.has(s.href)&&s.href!=="/admin/ferramentas");
if(remaining.length)WORKSPACES[7].groups.push({label:"Outras ferramentas",items:remaining});
export const TOOLS=WORKSPACES.flatMap(w=>w.groups.flatMap(g=>g.items.map(s=>({...s,workspace:w.label,workspaceKey:w.key,group:g.label}))));
export function activeTool(path:string){return TOOLS.filter(s=>path===s.href||path.startsWith(s.href+"/")).sort((a,b)=>b.href.length-a.href.length)[0];}
export function workspaceForPath(path:string){
 const hit=activeTool(path);if(hit)return WORKSPACES.find(w=>w.key===hit.workspaceKey);
 if(path==="/admin/estudio-area")return WORKSPACES.find(w=>w.key==="conteudo");
 if(path==="/admin/comercial")return WORKSPACES.find(w=>w.key==="crm");
 return undefined;
}
export function searchTools(query:string,workspace=""){
 const normal=(s:string)=>s.normalize("NFD").replace(/[\u0300-\u036f]/g,"").toLowerCase();
 const terms=normal(query).trim().split(/\s+/).filter(Boolean);
 return TOOLS.filter(s=>(!workspace||s.workspaceKey===workspace)&&terms.every(t=>normal(`${s.label} ${s.desc} ${s.workspace} ${s.group}`).includes(t)));
}
