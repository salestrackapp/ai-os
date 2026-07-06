import { redirect } from "next/navigation";

// O cockpit de entrada agora é "Hoje" (absorve o antigo Dashboard, preservado em /admin/dashboard).
export default function AdminIndex() {
  redirect("/admin/hoje");
}
