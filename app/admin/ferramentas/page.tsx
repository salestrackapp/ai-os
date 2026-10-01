import {exigirAdmin} from "@/lib/auth";
import {ToolDirectory} from "@/components/salestrack-os/ToolDirectory";
export default async function Page(){await exigirAdmin();return <main className="mx-auto max-w-6xl p-6"><h1 className="text-3xl font-bold">Todas as ferramentas</h1><p className="mt-3">Encontre o próximo passo sem percorrer todos os menus.</p><ToolDirectory/></main>}
