"use client";
/**
 * Casca da Academy — reprodução fiel do layout da academy anterior:
 * barra superior escura com faixa ciano, barra lateral navy com "NAVEGAÇÃO" e "MEUS AGENTES",
 * e conteúdo sobre fundo claro.
 *
 * A diferença estrutural em relação à anterior: lá era uma página só trocando divs; aqui cada
 * destino é rota de verdade, então dá para favoritar, voltar pelo navegador e mandar link.
 */
import Link from "next/link";
import Image from "next/image";
import { usePathname } from "next/navigation";
import { useState } from "react";

export type AgenteResumo = { id: string; nome: string; status: string };

const DESTINOS = [
  { label: "Início", href: "/academy", icone: "🏠" },
  { label: "Trilha de Aprendizado", href: "/academy/trilha", icone: "📚" },
  { label: "Criar Agente", href: "/academy/agente", icone: "🤖" },
  { label: "Biblioteca", href: "/academy/biblioteca", icone: "📖" },
  { label: "Avaliação", href: "/academy/prova", icone: "📝" },
  { label: "Certificados", href: "/academy/certificados", icone: "🏅" },
];

const CORES_STATUS: Record<string, string> = {
  rascunho: "var(--amber)", pronto: "var(--green)", publicado: "var(--cyan)",
};

export function AcademyChrome({ email, agentes, children }: { email: string; agentes: AgenteResumo[]; children: React.ReactNode }) {
  const path = usePathname();
  const [aberto, setAberto] = useState(false);
  const ativo = (href: string) => (href === "/academy" ? path === "/academy" : path.startsWith(href));

  const lateral = (
    <div className={`acad-sidebar ${aberto ? "is-open" : ""}`}>
      <p className="acad-sidebar-title">Navegação</p>
      <nav aria-label="Navegação da Academy">
        {DESTINOS.map((d) => (
          <Link key={d.href} href={d.href} onClick={() => setAberto(false)}
            aria-current={ativo(d.href) ? "page" : undefined}
            className={`acad-nav-item ${ativo(d.href) ? "is-active" : ""}`}>
            <span className="acad-nav-icon" aria-hidden>{d.icone}</span>
            <span className="truncate">{d.label}</span>
          </Link>
        ))}
      </nav>

      <div className="acad-agents mt-auto">
        <p className="acad-sidebar-title">Meus agentes</p>
        {agentes.length === 0 ? (
          <p className="px-5 pb-1 text-[12px] text-white/35">Nenhum agente ainda.</p>
        ) : (
          agentes.map((a) => (
            <Link key={a.id} href={`/academy/agente?id=${a.id}`} className="acad-agent-item">
              <span className="acad-agent-dot" style={{ background: CORES_STATUS[a.status] ?? "var(--amber)" }} aria-hidden />
              <span className="truncate">{a.nome}</span>
              <span className="acad-badge acad-badge-amber ml-auto shrink-0 capitalize">{a.status}</span>
            </Link>
          ))
        )}
        <Link href="/academy/agente" className="acad-novo-agente block text-center">+ Novo Agente</Link>
      </div>
    </div>
  );

  return (
    <div className="academy min-h-screen">
      <header className="acad-topbar">
        <button onClick={() => setAberto((v) => !v)} aria-label="Abrir menu" className="lg:hidden text-white/70">
          <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round">
            <line x1="4" y1="6" x2="20" y2="6" /><line x1="4" y1="12" x2="20" y2="12" /><line x1="4" y1="18" x2="20" y2="18" />
          </svg>
        </button>
        {/* logo original da academy: texto branco + selo AI, feito para fundo escuro */}
        <Link href="/academy" className="shrink-0">
          <Image src="/salestrack-academy-logo.png" alt="Salestrack AI" width={128} height={20} priority
            className="h-[22px] w-auto" />
        </Link>
        <span className="acad-topbar-sep hidden sm:block" aria-hidden />
        <span className="acad-topbar-name hidden sm:block">Salestrack AI <span>Academy</span></span>
        <a href="https://claude.ai" target="_blank" rel="noreferrer" className="acad-topbar-btn">Agentes no Claude</a>
      </header>

      {aberto && <div className="fixed inset-0 z-[190] bg-black/40 lg:hidden" onClick={() => setAberto(false)} aria-hidden />}
      {lateral}
      <main className="acad-main">{children}</main>

      <span className="sr-only">{email}</span>
    </div>
  );
}
