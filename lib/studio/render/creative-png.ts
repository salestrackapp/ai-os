import "server-only";
import { buildCreativeSlideHtml, creativeSlides, CREATIVE_SIZES, type CreativeRenderOpts } from "./creative";
import type { CreativePayload } from "@/lib/deliverables/types";

/** HTML de um slide → PNG via Chromium (mesmo padrão do PDF). Retorna null se o Chromium não subir. */
async function htmlToPng(html: string, w: number, h: number): Promise<Buffer | null> {
  const isServerless = !!process.env.AWS_LAMBDA_FUNCTION_NAME || !!process.env.VERCEL;
  try {
    const { chromium } = await import("playwright-core");
    let browser;
    if (isServerless) {
      const pack = (await import("@sparticuz/chromium")).default;
      browser = await chromium.launch({ args: pack.args, executablePath: await pack.executablePath(), headless: true });
    } else {
      const fs = await import("node:fs");
      const candidates = [process.env.PLAYWRIGHT_CHROMIUM_PATH, "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome", "/usr/bin/google-chrome", "/usr/bin/chromium"].filter(Boolean) as string[];
      const exe = candidates.find((p) => { try { return fs.existsSync(p); } catch { return false; } });
      browser = await chromium.launch(exe ? { executablePath: exe, headless: true } : { headless: true });
    }
    const page = await browser.newPage({ viewport: { width: w, height: h }, deviceScaleFactor: 2 });
    await page.setContent(html, { waitUntil: "networkidle" });
    const png = await page.screenshot({ type: "png", clip: { x: 0, y: 0, width: w, height: h } });
    await browser.close();
    return Buffer.from(png);
  } catch (e) {
    console.warn("[creative] PNG indisponível:", (e as Error)?.message);
    return null;
  }
}

/** Renderiza todos os slides do criativo em PNG (carrossel → N). Degrada para HTML se não houver Chromium. */
export async function renderCreativePngs(cr: CreativePayload, opts: CreativeRenderOpts = {}): Promise<{ pngs: (Buffer | null)[]; w: number; h: number; slides: number }> {
  const { w, h } = CREATIVE_SIZES[cr.tamanho];
  const slides = creativeSlides(cr);
  const pngs = await Promise.all(slides.map((s, i) =>
    htmlToPng(buildCreativeSlideHtml(cr.template, s, cr.tamanho, opts, slides.length > 1 ? { i, n: slides.length } : undefined), w, h)));
  return { pngs, w, h, slides: slides.length };
}
