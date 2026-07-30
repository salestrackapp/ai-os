"use client";
import { useRef, useState } from "react";

/**
 * Renderiza o HTML (já sanitizado no servidor) de um e-mail com fidelidade e isolamento:
 * iframe sandbox SEM allow-scripts (nenhum JS do e-mail roda) + CSS isolado. Auto-ajusta a altura.
 */
export function EmailBody({ html }: { html: string }) {
  const ref = useRef<HTMLIFrameElement>(null);
  const [h, setH] = useState(120);

  const doc = `<!doctype html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1">
    <base target="_blank">
    <style>
      html,body{margin:0;padding:0;background:transparent;}
      body{font-family:Montserrat,-apple-system,Segoe UI,Roboto,Arial,sans-serif;font-size:13px;line-height:1.55;color:#1A1A2E;word-break:break-word;overflow-wrap:anywhere;padding:2px;}
      img{max-width:100%;height:auto;}
      table{max-width:100%;}
      a{color:#007A94;}
      blockquote{margin:.4em 0;padding-left:12px;border-left:3px solid #E5E5EC;color:#55556A;}
    </style></head><body>${html}</body></html>`;

  const resize = () => {
    try {
      const b = ref.current?.contentWindow?.document?.body;
      if (b) setH(Math.min(Math.max(b.scrollHeight + 8, 60), 5000));
    } catch { /* cross-origin defensivo */ }
  };

  return (
    <iframe
      ref={ref}
      title="Conteúdo do e-mail"
      sandbox="allow-same-origin allow-popups allow-popups-to-escape-sandbox"
      srcDoc={doc}
      onLoad={() => { resize(); setTimeout(resize, 300); setTimeout(resize, 1200); }}
      style={{ width: "100%", height: h, border: 0, display: "block" }}
    />
  );
}
