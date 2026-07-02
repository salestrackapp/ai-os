import Link from "next/link";

export default function Home() {
  return (
    <main className="min-h-screen flex items-center justify-center px-6">
      <div className="max-w-xl text-center">
        <p className="text-[11px] uppercase tracking-[.3em] text-gold mb-6">Salestrack Inteligência Digital</p>
        <h1 className="font-serif text-6xl font-semibold leading-none">
          AI Operation <em className="text-gold not-italic italic">System</em>
        </h1>
        <p className="mt-6 text-muted">
          O sistema operacional da transformação com IA. Todas as IAs, todas as ferramentas, um único método.
        </p>
        <p className="mt-2 text-sm text-muted2">Acesso restrito a clientes e à equipe Salestrack.</p>
        <div className="mt-10">
          <Link href="/login" className="btn-gold">Entrar na plataforma →</Link>
        </div>
        <p className="mt-16 text-[11px] tracking-[.08em] text-muted2">ai-os.salestrack.com.br · André Kachan · Salestrack AI</p>
      </div>
    </main>
  );
}
