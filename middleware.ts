import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";

export async function middleware(request: NextRequest) {
  let response = NextResponse.next({ request });

  // Multi-domínio (white-label): resolve o tenant pelo host — base para N3
  const host = request.headers.get("host") ?? "";
  response.headers.set("x-tenant-host", host);

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL ?? "",
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? "",
    {
      cookies: {
        getAll() { return request.cookies.getAll(); },
        setAll(cookiesToSet: { name: string; value: string; options?: import("@supabase/ssr").CookieOptions }[]) {
          cookiesToSet.forEach(({ name, value }) => request.cookies.set(name, value));
          response = NextResponse.next({ request });
          cookiesToSet.forEach(({ name, value, options }) => response.cookies.set(name, value, options));
        },
      },
    }
  );

  const { data: { user } } = await supabase.auth.getUser();
  const path = request.nextUrl.pathname;
  const redir = (to: string, params?: Record<string, string>) => {
    const url = request.nextUrl.clone(); url.pathname = to; url.search = "";
    if (params) Object.entries(params).forEach(([k, v]) => url.searchParams.set(k, v));
    return NextResponse.redirect(url);
  };

  if ((path.startsWith("/admin") || path.startsWith("/portal")) && !user) return redir("/login", { next: path });
  if (path === "/login" && user) return redir("/entrar");

  // Enforcement de MFA para administradores Salestrack (atrás de flag; ligar com MFA_ENFORCE=true)
  if (process.env.MFA_ENFORCE === "true" && path.startsWith("/admin") && user) {
    const { data: mem } = await supabase
      .from("memberships")
      .select("role, organizations!inner(is_salestrack)")
      .eq("user_id", user.id).eq("role", "salestrack_admin")
      .eq("organizations.is_salestrack", true).limit(1);
    const isAdmin = !!mem?.length;
    if (isAdmin) {
      const { data: aal } = await supabase.auth.mfa.getAuthenticatorAssuranceLevel();
      const current = aal?.currentLevel, next = aal?.nextLevel;
      if (current !== "aal2") {
        if (next === "aal2") {
          // tem fator cadastrado, mas sessão só AAL1 → desafio TOTP
          return redir("/login/mfa");
        }
        // sem fator: obriga a cadastrar em Configurações (permite só essa rota)
        if (path !== "/admin/configuracoes") return redir("/admin/configuracoes", { mfa: "required" });
      }
    }
  }

  return response;
}

export const config = {
  // Só as rotas que realmente precisam do gate de auth. Páginas públicas
  // (/, /diagnostico, /entregavel, /p, /sem-acesso) e assets não pagam a
  // chamada de rede ao Supabase Auth — o que deixava toda navegação lenta.
  matcher: ["/admin/:path*", "/portal/:path*", "/login"],
};
