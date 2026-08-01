import { type NextRequest } from "next/server";
import { comRegistro } from "@/lib/ops/cron";
import { rodarRegua, sincronizarComAsaas } from "@/lib/financeiro/cobranca";

/**
 * Régua de cobrança. Diário, pelo Vercel Cron.
 *
 * `?so_sincronizar=1` espelha o ASAAS sem mandar aviso nenhum — é o que se usa para conferir o
 * estado real antes de deixar a régua escrever para cliente. A primeira execução de uma régua de
 * cobrança é a que mais pode constranger: se o painel local estiver desatualizado, ela cobra quem
 * já pagou.
 */
export async function GET(req: NextRequest) {
  return comRegistro("cobranca", req, async () => {
    // `?so_sincronizar=1` puxa da ASAAS sem cobrar ninguém — usado para conferir antes de agir.
    if (new URL(req.url).searchParams.get("so_sincronizar") === "1") {
      return { sincronia: await sincronizarComAsaas() };
    }
    return { regua: await rodarRegua() };
  });
}
