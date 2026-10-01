import {describe,it,expect,vi,beforeAll} from 'vitest';
import {render,screen,fireEvent,within} from '@testing-library/react';
import {WORKSPACES,TOOLS,activeTool,workspaceForPath,searchTools} from '@/lib/admin/workspaces';
import {AREAS,sectionLabelForPath} from '@/lib/admin/nav';
import {WorkspaceNav} from '@/components/admin/WorkspaceNav';
import {ToolDirectory} from '@/components/salestrack-os/ToolDirectory';
import {QuickSearch} from '@/components/admin/QuickSearch';
import {AppShell,Sidebar} from '@/components/ds/layout/AppShell';
import {RoutineBoard} from '@/components/salestrack-os/RoutineBoard';
import {buildRoutine} from '@/lib/salestrack-os/model';
vi.mock('next/navigation',()=>({usePathname:()=>'/admin/crm/contas/123'}));
vi.mock('@/app/admin/central/actions',()=>({updateProgress:vi.fn().mockResolvedValue({ok:true})}));
beforeAll(()=>{
 Object.defineProperty(window,'matchMedia',{writable:true,value:()=>({matches:true,addEventListener:vi.fn(),removeEventListener:vi.fn()})});
 HTMLDialogElement.prototype.showModal=function(){this.setAttribute('open','');};
 HTMLDialogElement.prototype.close=function(){this.removeAttribute('open');};
});
describe('Navegação unificada',()=>{
 it('preserva todos os destinos sem duplicar ferramentas',()=>{
  expect(new Set(TOOLS.map(s=>s.href)).size).toBe(TOOLS.length);
  for(const s of AREAS.flatMap(a=>a.sections).filter(s=>s.href!='/admin/ferramentas'))expect(TOOLS.some(t=>t.href===s.href),s.href).toBe(true);
  expect(WORKSPACES.filter(w=>w.label==='CRM')).toHaveLength(1);
 });
 it('seleciona a seção mais específica e o contexto ROTA correto',()=>{
  expect(activeTool('/admin/crm/contas/123')?.label).toBe('Empresas');
  expect(activeTool('/admin/crm/123')?.label).toBe('Funil de negócios');
  expect(workspaceForPath('/admin/rota')?.key).toBe('crm');
  expect(workspaceForPath('/admin/central')?.key).toBe('dia');
  expect(sectionLabelForPath('/admin/crm/contatos')).toBe('CRM · contatos');
 });
 it('busca sem acento e com mais de uma palavra',()=>{
  expect(searchTools('sinais publicos').map(t=>t.href)).toContain('/admin/prospeccao/sinais-linkedin');
  expect(searchTools('contratos','crm').every(t=>t.workspaceKey==='crm')).toBe(true);
  expect(searchTools('naoexistexyz')).toHaveLength(0);
 });
 it('marca somente Empresas como seção atual no CRM',()=>{
  render(<WorkspaceNav/>);
  const nav=screen.getByRole('navigation',{name:'Seções de CRM'});
  expect(within(nav).getByRole('link',{name:'Empresas'})).toHaveAttribute('aria-current','page');
  expect(within(nav).getByRole('link',{name:'Funil de negócios'})).not.toHaveAttribute('aria-current');
 });
 it('limpa busca vazia e mantém acesso às áreas',()=>{
  render(<ToolDirectory/>);fireEvent.change(screen.getByRole('searchbox'),{target:{value:'naoexistexyz'}});
  expect(screen.getByText(/Nenhuma ferramenta encontrada/)).toBeInTheDocument();
  fireEvent.click(screen.getByRole('button',{name:'Limpar filtros'}));
  expect(screen.getByRole('link',{name:/Funil de negócios/})).toBeInTheDocument();
 });
 it('abre busca pelo teclado e restaura foco ao fechar',()=>{
  render(<QuickSearch/>);fireEvent.keyDown(window,{ctrlKey:true,key:'k'});
  expect(screen.getByRole('dialog')).toHaveAttribute('open');
  expect(screen.getByRole('searchbox')).toHaveFocus();
  fireEvent.click(screen.getByRole('button',{name:'Fechar'}));
  expect(screen.queryByRole('dialog')).toBeNull();
  expect(screen.getByRole('button',{name:/Buscar ferramenta/})).toHaveFocus();
 });
 it('no celular expandir submenu não fecha o painel; Escape fecha',()=>{
  render(<AppShell sidebar={<Sidebar groups={[{items:[{label:'Grupo',href:'/grupo',children:[{label:'Filho',href:'/filho'}]}]}]}/>}>Conteúdo</AppShell>);
  fireEvent.click(screen.getByRole('button',{name:'Abrir menu'}));
  fireEvent.click(screen.getByRole('button',{name:'Abrir Grupo'}));
  expect(screen.getByRole('button',{name:'Fechar menu'})).toHaveAttribute('aria-expanded','true');
  expect(screen.getByRole('link',{name:'Filho'})).toBeInTheDocument();
  fireEvent.keyDown(document,{key:'Escape'});
  expect(screen.getByRole('button',{name:'Abrir menu'})).toHaveAttribute('aria-expanded','false');
  expect(screen.getByRole('button',{name:'Abrir menu'})).toHaveFocus();
 });
 it('apresenta seis atividades e permite expandir a fila',()=>{
  const items=buildRoutine('2026-10-01',[],Array.from({length:8},(_,i)=>({id:String(i),title:`Tarefa ${i}`,due_date:'2026-10-01'})));
  const {container}=render(<RoutineBoard items={items} progress={{}} day='2026-10-01'/>);
  expect(container.querySelectorAll('details')).toHaveLength(6);
  fireEvent.click(screen.getByRole('button',{name:/Mostrar mais/}));
  expect(container.querySelectorAll('details')).toHaveLength(12);
  fireEvent.change(screen.getByLabelText('Filtrar atividades'),{target:{value:'concluidas'}});
  expect(screen.getByText(/Nenhuma atividade neste filtro/)).toBeInTheDocument();
 });
});
