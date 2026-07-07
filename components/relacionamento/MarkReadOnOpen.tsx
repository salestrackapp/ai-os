"use client";
/** Marca a conversa como lida ao abrir a thread (E1). Silencioso; não bloqueia. */
import { useEffect, useRef } from "react";
import { markReadAction } from "@/app/admin/relacionamento/actions";

export function MarkReadOnOpen({ id, unread }: { id: string; unread: boolean }) {
  const done = useRef(false);
  useEffect(() => {
    if (!unread || done.current) return;
    done.current = true;
    void markReadAction(id, false);
  }, [id, unread]);
  return null;
}
