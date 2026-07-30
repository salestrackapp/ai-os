import type { Metadata } from "next";
import "./globals.css";
import "../styles/ds-tokens.css";
import "../styles/academy.css";

export const metadata: Metadata = {
  title: "AI Operation System — AI OS · Salestrack",
  description: "O sistema operacional da transformação com IA.",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="pt-BR">
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
        {/* Legado (telas atuais): Cormorant + DM Sans + DM Mono. DS v5: Montserrat + JetBrains Mono. */}
        <link
          href="https://fonts.googleapis.com/css2?family=Cormorant+Garamond:ital,wght@0,400;0,500;0,600;0,700;1,500&family=DM+Sans:wght@300;400;500;700&family=DM+Mono:wght@400;500&family=Montserrat:wght@400;500;600;800&family=JetBrains+Mono:wght@400;500&display=swap"
          rel="stylesheet"
        />
      </head>
      <body>{children}</body>
    </html>
  );
}
