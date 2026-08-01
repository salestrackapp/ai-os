import Link from "next/link";
import { SalestrackLogo } from "@/components/ds/SalestrackLogo";
import { lerRegistro } from "@/lib/lgpd/registro";
import { BASE_LEGAL_TEXTO } from "@/lib/lgpd/registro-conteudo";
import { EMAIL_ENCARREGADO, NOME_ENCARREGADO, CAMINHO_DIREITOS } from "@/lib/lgpd/contato";

export const dynamic = "force-dynamic";
export const metadata = {
  title: "Privacidade — Salestrack AI",
  description: "O que a Salestrack AI faz com dados pessoais: para quê, com que base legal, quem mais vê e por quanto tempo guardamos.",
};

/**
 * A política de privacidade.
 *
 * ── Por que ela é renderizada do banco ───────────────────────────────────────────────────────
 * O texto vem de `tratamento_operacoes`, a MESMA tabela que serve de registro interno do art. 37.
 * Uma política escrita à parte nasce certa e envelhece errada — liga-se uma integração nova, e o
 * documento continua descrevendo o sistema de seis meses atrás. Prometer publicamente uma coisa e
 * tratar outra não é detalhe de redação: é a infração.
 *
 * ── Por que não usa service role ─────────────────────────────────────────────────────────────
 * Página anônima lendo conteúdo público. `tratamento_operacoes` tem policy de select para `anon`,
 * então o cliente normal basta — e usar uma chave que lê o banco inteiro para exibir um texto que
 * qualquer um pode ler seria trocar poder por comodidade.
 */
export default async function PrivacidadePage() {
  const { operacoes, operadores } = await lerRegistro();
  const foraDoBrasil = [...new Set(operadores.filter((o) => !/^Brasil/.test(o.pais)).map((o) => o.pais))].sort();

  return (
    <main className="ds min-h-screen bg-[var(--bg-2)] px-6 py-12">
      <div className="mx-auto w-full max-w-3xl">
        <div className="mb-8"><SalestrackLogo width={140} /></div>

        <h1 className="mb-3 font-montserrat text-[32px] font-extrabold leading-tight tracking-[-0.02em] text-[color:var(--fg-1)]">
          Privacidade
        </h1>
        <p className="mb-4 font-montserrat text-[16px] leading-relaxed text-[color:var(--fg-2)]">
          Esta página diz o que a Salestrack AI faz com dados pessoais — os seus, se você é cliente,
          aluno, assinante da newsletter, ou alguém que recebeu uma mensagem nossa sem ter pedido.
        </p>
        <p className="mb-8 font-montserrat text-[14.5px] leading-relaxed text-[color:var(--fg-3)]">
          Ela não é um texto separado que alguém escreveu uma vez: é gerada do mesmo registro
          interno que usamos para operar. Quando o sistema muda, esta página muda junto — que é a
          única forma de ela continuar verdadeira.
        </p>

        <div className="mb-10 rounded-ds-card border border-[color:var(--brand)] bg-[var(--bg-1)] p-6">
          <p className="font-montserrat text-[15px] font-semibold text-[color:var(--fg-1)]">
            Quer ver, corrigir ou apagar seus dados?
          </p>
          <p className="mt-1.5 font-montserrat text-[14px] leading-relaxed text-[color:var(--fg-2)]">
            Não precisa ler o resto para isso. O pedido leva um minuto e respondemos em até 15 dias.
          </p>
          <Link href={CAMINHO_DIREITOS}
            className="ds-focus mt-4 inline-flex h-11 items-center rounded-ds-input bg-brand px-5 font-montserrat text-[15px] font-semibold text-white shadow-ds-brand hover:bg-brand-hover">
            Fazer um pedido sobre meus dados
          </Link>
        </div>

        <Secao titulo="Quem é o responsável">
          <p>
            A <b>Salestrack AI</b> é a controladora dos dados descritos aqui — é ela quem decide o
            que é coletado e para quê, inclusive quando o contato acontece pelo site pessoal do
            André Kachan.
          </p>
          <p>
            Encarregado de dados (DPO): <b>{NOME_ENCARREGADO}</b> ·{" "}
            <a href={`mailto:${EMAIL_ENCARREGADO}`} className="text-[color:var(--brand)] hover:underline">{EMAIL_ENCARREGADO}</a>.
            A LGPD exige que exista uma pessoa nomeada com um canal aberto (art. 41). É esta.
          </p>
        </Secao>

        <Secao titulo="O que tratamos, e por quê">
          <p>
            Cada bloco abaixo é uma operação diferente, com uma finalidade específica e uma base
            legal própria. A separação importa: o fato de você ter nos autorizado a mandar a
            newsletter não nos autoriza a fazer outra coisa com o seu endereço.
          </p>
        </Secao>

        <div className="mb-10 space-y-4">
          {operacoes.map((o) => (
            <section key={o.chave} className="rounded-ds-card border border-hairline bg-[var(--bg-1)] p-6">
              <h3 className="font-montserrat text-[17px] font-bold leading-snug text-[color:var(--fg-1)]">{o.nome}</h3>
              <p className="mt-1.5 font-montserrat text-[14.5px] leading-relaxed text-[color:var(--fg-2)]">{o.finalidade}</p>

              <dl className="mt-4 grid gap-x-6 gap-y-3 sm:grid-cols-2">
                <Item rotulo="Por que podemos" valor={BASE_LEGAL_TEXTO[o.baseLegal] ?? o.baseLegal} />
                <Item rotulo="De quem são os dados" valor={o.titulares} />
                <Item rotulo="Que dados" valor={o.dados} />
                <Item rotulo="De onde vêm" valor={o.origem} />
                <Item rotulo="Quem mais vê" valor={o.compartilhamento} />
                <Item rotulo="Por quanto tempo" valor={o.retencao} />
              </dl>

              {o.observacao && (
                <p className="mt-4 rounded-ds-input bg-[var(--bg-2)] px-4 py-3 font-montserrat text-[13.5px] leading-relaxed text-[color:var(--fg-2)]">
                  {o.observacao}
                </p>
              )}
            </section>
          ))}
        </div>

        <Secao titulo="Quem trata dados por nossa conta">
          <p>
            Nenhum destes vende ou usa seus dados para si: eles executam uma parte do serviço por
            nossa conta, e só recebem o que aquela parte exige.
          </p>
        </Secao>

        <div className="mb-10 overflow-x-auto rounded-ds-card border border-hairline bg-[var(--bg-1)]">
          <table className="w-full min-w-[560px] border-collapse">
            <thead>
              <tr className="border-b border-[color:var(--border)]">
                {["Quem", "O que faz por nós", "O que recebe", "Onde fica"].map((h) => (
                  <th key={h} className="px-4 py-3 text-left font-montserrat text-[11.5px] font-semibold uppercase tracking-[0.08em] text-[color:var(--fg-4)]">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {operadores.map((o) => (
                <tr key={o.chave} className="border-b border-[color:var(--border)] last:border-0">
                  <td className="px-4 py-3 font-montserrat text-[13.5px] font-medium text-[color:var(--fg-1)]">
                    {o.site
                      ? <a href={o.site} target="_blank" rel="noreferrer" className="hover:underline">{o.nome}</a>
                      : o.nome}
                  </td>
                  <td className="px-4 py-3 font-montserrat text-[13px] leading-relaxed text-[color:var(--fg-2)]">{o.papel}</td>
                  <td className="px-4 py-3 font-montserrat text-[13px] leading-relaxed text-[color:var(--fg-2)]">{o.dados}</td>
                  <td className="px-4 py-3 font-montserrat text-[13px] text-[color:var(--fg-2)]">{o.pais}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {foraDoBrasil.length > 0 && (
          <Secao titulo="Dados que saem do Brasil">
            <p>
              Parte dos serviços acima fica fora do país — hoje em <b>{foraDoBrasil.join(", ")}</b>.
              Isso é uma transferência internacional de dados, e a lei manda dizer (arts. 33 a 36).
            </p>
            <p>
              O banco de dados principal, onde tudo é guardado, fica <b>no Brasil</b> (São Paulo).
              O que vai para fora é o necessário para cada serviço funcionar: a mensagem que precisa
              ser entregue, o texto que precisa ser processado.
            </p>
          </Secao>
        )}

        <Secao titulo="Cookies e rastreamento">
          <p>
            Os sites da Salestrack não usam cookie de publicidade, não têm pixel de rede social e
            não montam perfil de navegação. O que existe é o necessário para a sua sessão funcionar
            quando você entra no sistema.
          </p>
          <p>
            Nos e-mails de conteúdo, registramos entrega, abertura e clique — é o que permite parar
            de mandar para quem nunca abre, e você pode encerrar tudo com o link de descadastro.
          </p>
        </Secao>

        <Secao titulo="Inteligência artificial">
          <p>
            Usamos modelos de IA em partes do trabalho — separar o que precisa de resposta na caixa
            de entrada, preparar rascunhos, gerar material. Duas coisas que valem dizer com todas as
            letras:
          </p>
          <p>
            <b>Nenhuma decisão sobre você é automática.</b> O modelo sugere; quem decide, responde e
            envia é uma pessoa. E o conteúdo tratado não é usado para treinar modelo nenhum.
          </p>
        </Secao>

        <Secao titulo="Segurança">
          <p>
            O acesso ao sistema é por conta individual, e cada pessoa só enxerga os dados da própria
            empresa — isso é imposto pelo banco de dados, não pela tela. Toda ação relevante fica
            registrada numa trilha que não aceita edição nem apagamento.
          </p>
          <p>
            Se acontecer um incidente que possa trazer risco a você, temos um procedimento definido
            para avisar você e a ANPD.
          </p>
        </Secao>

        <Secao titulo="Seus direitos">
          <p>
            Você pode pedir para ver o que temos sobre você, corrigir o que está errado, levar seus
            dados embora em um arquivo, se opor a um uso específico, retirar uma autorização que deu
            e pedir a exclusão.
          </p>
          <p>
            O caminho direto é a{" "}
            <Link href={CAMINHO_DIREITOS} className="text-[color:var(--brand)] hover:underline">página de direitos</Link>{" "}
            — por ali o pedido entra com prazo contado automaticamente. Escrever para o encarregado
            também vale.
          </p>
          <p className="!text-[13.5px] !text-[color:var(--fg-3)]">
            Um pedido de exclusão não apaga o que a lei manda guardar — contrato assinado, documento
            fiscal e trilha de auditoria continuam existindo, com o que identifica pessoas reduzido
            ao necessário. A própria LGPD ressalva essa guarda (art. 16). Dizemos isso aqui para que
            não seja surpresa depois.
          </p>
        </Secao>

        <p className="mt-12 border-t border-[color:var(--border)] pt-6 font-montserrat text-[12.5px] leading-relaxed text-[color:var(--fg-3)]">
          Esta página é gerada a partir do registro interno de operações de tratamento e reflete o
          estado atual do sistema. Dúvida sobre qualquer ponto:{" "}
          <a href={`mailto:${EMAIL_ENCARREGADO}`} className="text-[color:var(--brand)] hover:underline">{EMAIL_ENCARREGADO}</a>.
        </p>
      </div>
    </main>
  );
}

function Secao({ titulo, children }: { titulo: string; children: React.ReactNode }) {
  return (
    <section className="mb-8">
      <h2 className="mb-2 font-montserrat text-[20px] font-bold leading-snug text-[color:var(--fg-1)]">{titulo}</h2>
      <div className="space-y-2 font-montserrat text-[14.5px] leading-relaxed text-[color:var(--fg-2)] [&_b]:font-semibold">
        {children}
      </div>
    </section>
  );
}

function Item({ rotulo, valor }: { rotulo: string; valor: string | null }) {
  if (!valor) return null;
  return (
    <div>
      <dt className="font-montserrat text-[11.5px] font-semibold uppercase tracking-[0.08em] text-[color:var(--fg-4)]">{rotulo}</dt>
      <dd className="mt-0.5 font-montserrat text-[13.5px] leading-relaxed text-[color:var(--fg-2)]">{valor}</dd>
    </div>
  );
}
