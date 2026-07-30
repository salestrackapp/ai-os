export default function SemAcesso() {
  return (
    <main className="min-h-screen flex items-center justify-center px-6 bg-navy text-cream">
      <div className="card p-10 text-center max-w-md">
        <p className="text-[13px] uppercase tracking-[.28em] text-gold mb-3">AI Operation System</p>
        <h1 className="font-serif text-3xl font-semibold mb-3">Acesso não configurado</h1>
        <p className="text-sm text-muted">Sua conta ainda não está vinculada a um programa. Fale com a equipe Salestrack (<a className="text-gold" href="mailto:andre.kachan@salestrack.com.br">andre.kachan@salestrack.com.br</a>) ou aguarde o convite do administrador da sua empresa.</p>
        <p className="mt-4 text-sm text-muted">Veio pela formação? <a className="text-gold" href="/academy">Ir para a Academy</a>.</p>
        <form action="/api/signout" method="post" className="mt-6"><button className="btn-ghost">Sair</button></form>
      </div>
    </main>
  );
}
