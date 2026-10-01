import { describe, it, expect, vi, beforeEach } from "vitest";
import {
  brasiliaDay,
  buildRoutine,
  BACKLOG,
  progressKey,
  validDay,
} from "../lib/salestrack-os/model";
describe("Rotina Salestrack OS", () => {
  it("usa dia de Brasília na virada UTC", () =>
    expect(brasiliaDay(new Date("2026-10-02T01:00:00Z"))).toBe("2026-10-01"));
  it("rejeita data inexistente", () => {
    expect(validDay("2026-02-30")).toBe(false);
    expect(() => buildRoutine("ontem", [], [])).toThrow();
  });
  it("inclui vencidas e exclui futuras, ordenando sem negócios encerrados", () => {
    const items = buildRoutine(
      "2026-10-01",
      [
        {
          id: "1",
          title: "Encerrado",
          stage: "perdido",
          score: 99,
          last_activity_at: null,
        },
      ],
      [
        { id: "1", title: "Vencida", due_date: "2026-09-30" },
        { id: "2", title: "Futura", due_date: "2026-10-02" },
      ],
    );
    expect(items.some((x) => x.id === "tarefa-1")).toBe(true);
    expect(items.some((x) => x.id === "tarefa-2")).toBe(false);
    expect(items.some((x) => x.id === "negocio-1")).toBe(false);
    expect(items.filter((x) => x.area === "evolucao")).toHaveLength(2);
  });
  it("mantém melhoria concluída fora dos próximos dias e traz a próxima", () => {
    const progress = {
      "backlog:banco": {
        status: "concluido" as const,
        evidence: "Teste aprovado",
        actor: "admin",
        updatedAt: "2026-10-01",
      },
    };
    const items = buildRoutine("2026-10-02", [], [], progress);
    expect(items.some((x) => x.id === "banco")).toBe(false);
    expect(items.some((x) => x.id === "ia")).toBe(true);
    expect(progressKey("2026-10-02", BACKLOG[0])).toBe("backlog:banco");
  });
});
const mocks = vi.hoisted(() => ({ save: vi.fn(), insert: vi.fn() }));
vi.mock("@/lib/salestrack-os/data", () => ({ saveDailyPlan: mocks.save }));
vi.mock("@/lib/supabase/service", () => ({
  createServiceClient: () => ({ from: () => ({ insert: mocks.insert }) }),
}));
import { GET } from "../app/api/cron/salestrack/route";
import { NextRequest } from "next/server";
describe("Cron Salestrack sem envio", () => {
  beforeEach(() => {
    vi.unstubAllEnvs();
    vi.clearAllMocks();
    vi.stubEnv("CRON_SECRET", "test-only");
    vi.stubEnv("SALESTRACK_DAILY_ENABLED", "true");
  });
  const request = (auth?: string) =>
    new NextRequest("https://example.test/api/cron/salestrack", {
      headers: auth ? { authorization: auth } : {},
    });
  it("nega ausência de autenticação sem tocar dados", async () => {
    expect((await GET(request())).status).toBe(401);
    expect(mocks.save).not.toHaveBeenCalled();
  });
  it("permanece pausado sem flag explícita", async () => {
    vi.stubEnv("SALESTRACK_DAILY_ENABLED", "false");
    expect(await (await GET(request("Bearer test-only"))).json()).toMatchObject(
      { paused: true, sends: 0 },
    );
    expect(mocks.save).not.toHaveBeenCalled();
  });
  it("não confirma sucesso se o registro falhar", async () => {
    mocks.save.mockResolvedValue({ day: "2026-10-01", items: 4, sends: 0 });
    mocks.insert.mockResolvedValue({ error: { message: "offline" } });
    expect((await GET(request("Bearer test-only"))).status).toBe(503);
  });
});

import {rotaSchema,rotaNextSteps,rotaHandoff} from "../lib/salestrack-os/rota";
describe("ROTA",()=>{
 it("recusa campos arbitrários e IDs inválidos",()=>{
  expect(rotaSchema.safeParse({dealId:"x",revision:null,answers:{}}).success).toBe(false);
  expect(rotaSchema.safeParse({dealId:"11111111-1111-4111-8111-111111111111",revision:null,answers:{secret:"x"}}).success).toBe(false);
 });
 it("limita a fila e não confunde espaço em branco com resposta",()=>{
  const rows=Array.from({length:8},(_,i)=>({id:String(i),title:"Negócio"}));
  const result=rotaNextSteps(rows,{"0":{prioridade:"   "}});
  expect(result).toHaveLength(3);expect(result[0].missing).toHaveLength(12);
 });
 it("não inventa dados no resumo",()=>{
  const text=rotaHandoff("Empresa",{prioridade:"Reduzir retrabalho"});
  expect(text).toContain("Reduzir retrabalho");expect(text).toContain("PENDENTE — confirmar com o cliente");
 });
});
