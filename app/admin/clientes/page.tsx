import { redirect } from "next/navigation";
export const dynamic = "force-dynamic";
// Clientes foi absorvido por Jornadas (o painel de jornadas é a lista de clientes).
export default function Page() { redirect("/admin/jornadas"); }
