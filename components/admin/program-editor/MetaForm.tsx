"use client";
import { useRouter } from "next/navigation";
import { ResourceForm } from "@/components/crud/ResourceForm";

/** Metadados do programa via ResourceForm; atualiza a página ao salvar. */
export function MetaForm({ id, initial }: { id: string; initial: Record<string, unknown> }) {
  const router = useRouter();
  return <ResourceForm resourceName="programa" mode="edit" id={id} initial={initial} onResult={(_m, ok) => { if (ok) router.refresh(); }} />;
}
