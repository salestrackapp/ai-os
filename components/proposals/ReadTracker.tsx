"use client";
import { useEffect } from "react";

/** Observa as seções [data-section] e envia 5s de leitura por seção visível a cada 5s (sendBeacon). */
export function ReadTracker({ token }: { token: string }) {
  useEffect(() => {
    const visible = new Set<string>();
    const io = new IntersectionObserver((entries) => {
      entries.forEach((e) => {
        const id = (e.target as HTMLElement).dataset.section;
        if (!id) return;
        if (e.isIntersecting) visible.add(id); else visible.delete(id);
      });
    }, { threshold: 0.4 });
    document.querySelectorAll("[data-section]").forEach((el) => io.observe(el));

    const beacon = (section: string, seconds: number) => {
      try {
        const blob = new Blob([JSON.stringify({ section, seconds })], { type: "application/json" });
        navigator.sendBeacon(`/api/p/${token}/track`, blob);
      } catch { /* ignore */ }
    };
    const iv = setInterval(() => { if (document.hidden) return; visible.forEach((s) => beacon(s, 5)); }, 5000);
    return () => { clearInterval(iv); io.disconnect(); };
  }, [token]);
  return null;
}
