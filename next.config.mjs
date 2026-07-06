/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  // Pacotes nativos/pesados do pipeline de renderização: manter externos ao bundle serverless.
  serverExternalPackages: ["@sparticuz/chromium", "playwright-core", "pptxgenjs", "docx"],
};
export default nextConfig;
