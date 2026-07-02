import { NextResponse, type NextRequest } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { BRAND_LABELS, KIND_LABELS, type CatalogItem } from "@/lib/types";

function csvCell(v: unknown): string {
  const s = v == null ? "" : String(v);
  return /[",\n;]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}

export async function GET(req: NextRequest) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  const kind = req.nextUrl.searchParams.get("kind");
  const brand = req.nextUrl.searchParams.get("brand");
  let q = supabase.from("catalog_items").select("*").order("brand").order("kind").order("name");
  if (kind) q = q.eq("kind", kind);
  if (brand) q = q.eq("brand", brand);
  const { data } = await q;
  const items = (data as CatalogItem[]) ?? [];

  const header = ["Nome", "Tipo", "Marca", "Unidade", "Preço", "Custo", "Margem", "Margem %", "Frentes", "Ativo", "Revisar", "Descrição"];
  const lines = items.map((it) => {
    const m = it.price != null && it.cost != null ? it.price - it.cost : null;
    const mp = m != null && it.price ? ((m / it.price) * 100).toFixed(1) : "";
    return [
      it.name, KIND_LABELS[it.kind] ?? it.kind, BRAND_LABELS[it.brand] ?? it.brand, it.unit,
      it.price ?? "", it.cost ?? "", m ?? "", mp, (it.frentes ?? []).join("; "),
      it.active ? "sim" : "não", it.needs_review ? "sim" : "não", it.description ?? "",
    ].map(csvCell).join(",");
  });
  const csv = "﻿" + [header.join(","), ...lines].join("\n");

  return new NextResponse(csv, {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="catalogo-aios-${new Date().toISOString().slice(0, 10)}.csv"`,
    },
  });
}
