import "@testing-library/jest-dom/vitest";
import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { Button } from "../Button";
import { Field, Input } from "../fields";
import { EmptyState, Kpi } from "../primitives";
import { CopilotCard } from "../CopilotCard";
import { CycleSteps, AI_METHOD } from "../CycleSteps";

describe("Button", () => {
  it("renderiza variantes e dispara onClick", () => {
    const onClick = vi.fn();
    render(<Button variant="primary" onClick={onClick}>Salvar</Button>);
    const btn = screen.getByRole("button", { name: "Salvar" });
    fireEvent.click(btn);
    expect(onClick).toHaveBeenCalledOnce();
    expect(btn.className).toContain("bg-brand");
  });
  it("loading e disabled desabilitam o botão", () => {
    const { rerender } = render(<Button loading>Salvando</Button>);
    expect(screen.getByRole("button")).toBeDisabled();
    rerender(<Button disabled>X</Button>);
    expect(screen.getByRole("button")).toBeDisabled();
  });
});

describe("Field + Input", () => {
  it("liga label ao input e marca aria-invalid no erro", () => {
    render(<Field label="Nome" error="Obrigatório">{(p) => <Input {...p} />}</Field>);
    const input = screen.getByLabelText("Nome");
    expect(input).toHaveAttribute("aria-invalid", "true");
    expect(screen.getByText("Obrigatório")).toBeInTheDocument();
  });
});

describe("EmptyState", () => {
  it("mostra título, descrição e uma ação", () => {
    render(<EmptyState title="Vazio" description="Nada aqui" action={<Button>Criar</Button>} />);
    expect(screen.getByText("Vazio")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Criar" })).toBeInTheDocument();
  });
});

describe("Kpi", () => {
  it("exibe figura grande + legenda", () => {
    render(<Kpi value="+340%" label="Leads qualificados" tone="up" delta="mês" />);
    expect(screen.getByText("+340%")).toBeInTheDocument();
    expect(screen.getByText("Leads qualificados")).toBeInTheDocument();
  });
});

describe("CopilotCard (proativo, nunca 'como posso ajudar')", () => {
  it("mostra achado + ação e chama onAction", () => {
    const onAction = vi.fn();
    render(<CopilotCard finding="Identifiquei 3 oportunidades." actionLabel="Ver" onAction={onAction} />);
    expect(screen.getByText("Identifiquei 3 oportunidades.")).toBeInTheDocument();
    expect(screen.queryByText(/como posso ajudar/i)).toBeNull();
    fireEvent.click(screen.getByRole("button", { name: "Ver" }));
    expect(onAction).toHaveBeenCalledOnce();
  });
});

describe("CycleSteps", () => {
  it("renderiza as 5 etapas do método com a atual em destaque", () => {
    render(<CycleSteps currentStep={2} />);
    for (const s of AI_METHOD) expect(screen.getByText(s.title)).toBeInTheDocument();
    expect(screen.getByText(/etapa 3\/5 · em curso/)).toBeInTheDocument();
  });
});
