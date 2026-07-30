import Link from "next/link";
import { CATEGORIES, SETTINGS, SECRET_PROVIDERS } from "@/lib/settings/registry";
import { getSettingSource } from "@/lib/settings/resolve";
import { getSecretStatuses, getProviderFieldStatus, PROVIDER_FIELDS } from "@/lib/settings/secrets";
import { saveSetting, saveSecretAction, saveProviderConfigAction, testSecretAction, sendTestEmailAction } from "./actions";
import { ContentArea } from "@/components/ds";

export const dynamic = "force-dynamic";

const SRC_BADGE: Record<string, string> = { app: "badge-teal", env: "badge-gold", default: "badge-muted" };
const ST_BADGE: Record<string, string> = { configurado: "badge-teal", ausente: "badge-muted", invalido: "badge inline-flex text-[11px] uppercase tracking-[.14em] px-2.5 py-1 rounded-full border text-red-400 border-red-500/40 bg-red-500/10" };

export default async function Console({ searchParams }: { searchParams: Promise<{ cat?: string }> }) {
  const sp = await searchParams;
  const cat = sp.cat && CATEGORIES.some((c) => c.key === sp.cat) ? sp.cat : CATEGORIES[0].key;
  const settings = SETTINGS.filter((s) => s.category === cat);
  // valor efetivo + fonte de cada setting da categoria
  const resolved = await Promise.all(settings.map(async (s) => ({ def: s, ...(await getSettingSource(s.key)) })));
  const secretStatuses = cat === "integracoes" ? await getSecretStatuses() : {};
  // status por campo dos provedores multi-campo (google, zapi)
  const fieldStatuses: Record<string, Record<string, boolean>> = {};
  if (cat === "integracoes") for (const prov of Object.keys(PROVIDER_FIELDS)) fieldStatuses[prov] = await getProviderFieldStatus(prov);

  return (
    <ContentArea>
      <div>
        <div className="mb-6"><p className="text-[13px] uppercase tracking-[.24em] text-muted2 mb-1">Configurações</p><h1 className="font-serif text-4xl font-semibold">Console de Configurações</h1>
          <p className="text-sm text-muted mt-1">Tudo configurável no app. Precedência: <b>app</b> → <b>env</b> → <b>default</b>.</p></div>

        <div className="grid lg:grid-cols-[220px_1fr] gap-6">
          {/* categorias */}
          <nav className="space-y-1">
            {CATEGORIES.map((c) => (
              <Link key={c.key} href={`/admin/configuracoes/parametros?cat=${c.key}`} className={`block rounded-lg px-4 py-2.5 text-sm ${c.key === cat ? "bg-navy3 text-cream" : "text-muted hover:text-cream hover:bg-navy3"}`} style={c.key === cat ? { boxShadow: "inset 3px 0 0 #007A94" } : undefined}>{c.label}</Link>
            ))}
          </nav>

          {/* conteúdo */}
          <div className="space-y-4">
            {cat === "integracoes" ? (
              SECRET_PROVIDERS.map((p) => {
                const st = secretStatuses[p.provider] ?? { status: "ausente", last_tested_at: null, hasEnv: false };
                return (
                  <div key={p.provider} className="card p-5">
                    <div className="flex items-center justify-between gap-3 mb-2 flex-wrap">
                      <div className="flex items-center gap-2"><span className="font-serif text-lg font-semibold">{p.label}</span><span className={ST_BADGE[st.status] ?? "badge-muted"}>{st.status}</span>{st.hasEnv && <span className="badge-gold">env</span>}</div>
                      <form action={testSecretAction.bind(null, p.provider)}><button className="btn-ghost text-xs">Testar conexão</button></form>
                    </div>
                    <p className="text-[13px] text-muted2 mb-2">Sem esta chave: {p.degrada}</p>
                    {PROVIDER_FIELDS[p.provider] ? (
                      // Multi-campo (Google, Z-API): um campo por valor; só grava o que for preenchido.
                      <form action={saveProviderConfigAction.bind(null, p.provider)} className="space-y-2">
                        {PROVIDER_FIELDS[p.provider].map((f) => {
                          const has = fieldStatuses[p.provider]?.[f.key];
                          return (
                            <div key={f.key}>
                              <label className="label !mb-0.5 flex items-center gap-2">{f.label} <span className={has ? "text-teal text-[11px]" : "text-muted2 text-[11px]"}>{has ? "● salvo" : "○ falta"}</span></label>
                              <input name={f.key} type={f.secret ? "password" : "text"} autoComplete="new-password"
                                placeholder={f.secret ? "•••••••• (write-only — deixe vazio p/ manter)" : (has ? "(preenchido — deixe vazio p/ manter)" : "")}
                                className="input w-full text-sm" />
                            </div>
                          );
                        })}
                        <button className="btn-gold text-xs">Salvar {p.label}</button>
                      </form>
                    ) : null}
                    {p.provider === "google" && (
                      <form action={sendTestEmailAction} className="mt-3 flex gap-2 border-t border-line pt-3">
                        <input name="to" type="email" placeholder="enviar e-mail de teste para…" defaultValue="andre.kachan@salestrack.com.br" className="input flex-1 text-sm" />
                        <button className="btn-ghost text-xs whitespace-nowrap">Enviar teste</button>
                      </form>
                    )}
                    {!PROVIDER_FIELDS[p.provider] && (
                      <form action={saveSecretAction.bind(null, p.provider)} className="flex gap-2">
                        <input name="secret" type="password" autoComplete="new-password" placeholder="•••••••• (write-only — nunca exibido)" className="input flex-1 text-sm" />
                        <button className="btn-gold text-xs">Salvar</button>
                      </form>
                    )}
                    {st.last_tested_at && <p className="text-[11px] text-muted2 mt-1">Testado em {new Date(st.last_tested_at).toLocaleString("pt-BR")}</p>}
                  </div>
                );
              })
            ) : (
              resolved.map(({ def, value, source }) => (
                <form key={def.key} action={saveSetting.bind(null, def.key)} className="card p-5">
                  <div className="flex items-center justify-between gap-2 mb-2">
                    <div><label className="label !mb-0">{def.label}</label>{def.help && <p className="text-[13px] text-muted2">{def.help}</p>}</div>
                    <span className={SRC_BADGE[source]} title="fonte do valor efetivo">{source}</span>
                  </div>
                  {def.type === "bool" ? (
                    <label className="flex items-center gap-2 text-sm text-muted"><input type="checkbox" name="value" defaultChecked={!!value} /> ativo</label>
                  ) : def.type === "json" ? (
                    <textarea name="value" rows={4} defaultValue={value != null ? JSON.stringify(value, null, 2) : ""} className="input w-full text-xs font-mono" />
                  ) : (
                    <input name="value" type={def.type === "number" ? "number" : "text"} step="any" defaultValue={value != null ? String(value) : ""} className="input w-full text-sm" placeholder={def.default != null ? `default: ${String(def.default)}` : "vazio"} />
                  )}
                  <button className="btn-ghost text-xs mt-2">Salvar</button>
                </form>
              ))
            )}
            {cat !== "integracoes" && resolved.length === 0 && <div className="card p-6"><p className="text-sm text-muted2">Sem configurações nesta categoria.</p></div>}
          </div>
        </div>
      </div>
    </ContentArea>
  );
}
