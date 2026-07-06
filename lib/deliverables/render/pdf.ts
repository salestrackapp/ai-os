import "server-only";

/**
 * HTML → PDF via Chromium headless (Playwright).
 * Dois modos: serverless (Vercel) usa @sparticuz/chromium + playwright-core; local usa o Chromium
 * do playwright completo se instalado. Se o Chromium não puder subir, retorna null → o chamador
 * degrada para servir o HTML print-ready (Ctrl-P do usuário) sem quebrar.
 */
export async function htmlToPdf(html: string): Promise<Buffer | null> {
  const isServerless = !!process.env.AWS_LAMBDA_FUNCTION_NAME || !!process.env.VERCEL;
  try {
    const { chromium } = await import("playwright-core");
    let browser;
    if (isServerless) {
      const chromiumPack = (await import("@sparticuz/chromium")).default;
      browser = await chromium.launch({
        args: chromiumPack.args,
        executablePath: await chromiumPack.executablePath(),
        headless: true,
      });
    } else {
      // Local/self-host: usa Chrome do sistema (macOS/Linux/Windows) ou o env PLAYWRIGHT_CHROMIUM_PATH.
      const fs = await import("node:fs");
      const candidates = [
        process.env.PLAYWRIGHT_CHROMIUM_PATH,
        "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome",
        "/Applications/Chromium.app/Contents/MacOS/Chromium",
        "/usr/bin/google-chrome", "/usr/bin/chromium", "/usr/bin/chromium-browser",
      ].filter(Boolean) as string[];
      const executablePath = candidates.find((p) => { try { return fs.existsSync(p); } catch { return false; } });
      browser = await chromium.launch(executablePath ? { executablePath, headless: true } : { headless: true });
    }
    const page = await browser.newPage();
    await page.setContent(html, { waitUntil: "networkidle" });
    await page.emulateMedia({ media: "print" });
    const pdf = await page.pdf({ format: "A4", printBackground: true, preferCSSPageSize: true, margin: { top: "0", bottom: "0", left: "0", right: "0" } });
    await browser.close();
    return Buffer.from(pdf);
  } catch (e) {
    console.warn("[deliverables] PDF render indisponível, degradando para HTML:", (e as Error)?.message);
    return null;
  }
}
