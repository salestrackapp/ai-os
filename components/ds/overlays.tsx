/**
 * DS v5 · Overlays (Salestrack AI v2)
 * Dialog (modal centrado) · Drawer (painel lateral) · Toast (feedback "Publicado"/"Salvo").
 * Acessível: role/aria-modal, Escape fecha, foco entra no painel, backdrop clicável.
 */
"use client";
import { createContext, useCallback, useContext, useEffect, useRef, useState } from "react";
import { cn } from "@/lib/ds/cn";

function useEscape(open: boolean, onClose: () => void) {
  useEffect(() => {
    if (!open) return;
    const h = (e: KeyboardEvent) => { if (e.key === "Escape") onClose(); };
    document.addEventListener("keydown", h);
    return () => document.removeEventListener("keydown", h);
  }, [open, onClose]);
}

export function Dialog({ open, onClose, title, children, footer }: {
  open: boolean; onClose: () => void; title?: string; children?: React.ReactNode; footer?: React.ReactNode;
}) {
  const ref = useRef<HTMLDivElement>(null);
  useEscape(open, onClose);
  useEffect(() => { if (open) ref.current?.focus(); }, [open]);
  if (!open) return null;
  return (
    <div className="ds fixed inset-0 z-[100] flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-ink/40 backdrop-blur-sm ds-animate-in" onClick={onClose} aria-hidden />
      <div ref={ref} role="dialog" aria-modal="true" aria-label={title} tabIndex={-1}
        className="ds-focus relative w-full max-w-lg rounded-ds-panel border border-hairline bg-[var(--bg-1)] p-6 shadow-ds-xl ds-animate-in">
        {title && <h2 className="ds-h3 mb-3">{title}</h2>}
        <div className="ds-body text-[color:var(--fg-2)]">{children}</div>
        {footer && <div className="mt-6 flex justify-end gap-2">{footer}</div>}
      </div>
    </div>
  );
}

export function Drawer({ open, onClose, title, children, footer, side = "right" }: {
  open: boolean; onClose: () => void; title?: string; children?: React.ReactNode; footer?: React.ReactNode; side?: "right" | "left";
}) {
  const ref = useRef<HTMLDivElement>(null);
  useEscape(open, onClose);
  useEffect(() => { if (open) ref.current?.focus(); }, [open]);
  if (!open) return null;
  return (
    <div className="ds fixed inset-0 z-[100]">
      <div className="absolute inset-0 bg-ink/40 backdrop-blur-sm ds-animate-in" onClick={onClose} aria-hidden />
      <div ref={ref} role="dialog" aria-modal="true" aria-label={title} tabIndex={-1}
        className={cn("ds-focus absolute inset-y-0 flex w-full max-w-md flex-col border-hairline bg-[var(--bg-1)] shadow-ds-xl",
          side === "right" ? "right-0 border-l" : "left-0 border-r")}
        style={{ animation: "ds-in 220ms var(--ds-ease) both" }}>
        {title && <div className="border-b border-hairline px-6 py-4"><h2 className="ds-h3">{title}</h2></div>}
        <div className="flex-1 overflow-y-auto p-6 ds-body text-[color:var(--fg-2)]">{children}</div>
        {footer && <div className="border-t border-hairline px-6 py-4 flex justify-end gap-2">{footer}</div>}
      </div>
    </div>
  );
}

/* ── Toast ── */
type Toast = { id: number; message: string; tone?: "neutral" | "success" | "danger" };
const ToastCtx = createContext<(message: string, tone?: Toast["tone"]) => void>(() => {});
export const useToast = () => useContext(ToastCtx);

export function ToastProvider({ children }: { children: React.ReactNode }) {
  const [toasts, setToasts] = useState<Toast[]>([]);
  const push = useCallback((message: string, tone: Toast["tone"] = "neutral") => {
    const id = Date.now() + Math.floor(performance.now());
    setToasts((t) => [...t, { id, message, tone }]);
    setTimeout(() => setToasts((t) => t.filter((x) => x.id !== id)), 4000);   // auto-dismiss 4s
  }, []);
  return (
    <ToastCtx.Provider value={push}>
      {children}
      <div className="ds fixed bottom-4 right-4 z-[120] flex flex-col gap-2" role="status" aria-live="polite">
        {toasts.map((t) => (
          <div key={t.id} className="ds-animate-in flex items-center gap-2.5 rounded-ds-input border border-hairline bg-[var(--bg-1)] px-4 py-3 shadow-ds-lg">
            <span className="h-2 w-2 rounded-full" style={{ background: t.tone === "success" ? "var(--success)" : t.tone === "danger" ? "var(--danger)" : "var(--brand)" }} />
            <span className="font-montserrat text-sm text-[color:var(--fg-1)]">{t.message}</span>
          </div>
        ))}
      </div>
    </ToastCtx.Provider>
  );
}
