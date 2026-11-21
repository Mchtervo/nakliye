/**
 * Facebook grupları (görünmez tarayıcı + yedek hesabın oturumu).
 *
 * Kurulum (sunucu, uygulama klasörü DIŞINDA — Next derlemesine girmesin):
 *   mkdir /home/yukavci/fbtest && cd /home/yukavci/fbtest && npm i playwright@1.49.1
 *   PLAYWRIGHT_BROWSERS_PATH=/home/yukavci/fbtest/tarayici npx playwright install --with-deps chromium
 * Oturum: kullanıcı kendi tarayıcısında giriş yapar, Cookie-Editor ile JSON dışa aktarır;
 *   scripts/facebook-oturum.ts ile FB_OTURUM dosyasına yazılır (robot doğrulamasını insan geçer).
 *
 * Okunan gönderiler WhatsApp ile aynı kuyruğa (mesajlariKuyrugaAl) girer: yem/spam süzgeci,
 * bölge, araç, tekrar ve AI aynen uygulanır.
 */
import fs from "node:fs";
import { createHash } from "node:crypto";

export const FACEBOOK_GRUP = "FACEBOOK_GRUP";
export const FB_DIZIN = process.env.FB_TARAYICI_DIR || "/home/yukavci/fbtest";
export const FB_OTURUM = process.env.FB_OTURUM || `${FB_DIZIN}/oturum.json`;
const GORULEN_DOSYA = `${FB_DIZIN}/gorulen.json`;

export type FbGrup = { id: string; ad: string };
export type FbGonderi = { metin: string; anahtar: string };

const UA = "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36";

export class FbOturumHatasi extends Error {}

/* eslint-disable @typescript-eslint/no-explicit-any */
/** Playwright uygulama bağımlılığı değil (tipleri de yok): ayrı klasörden yüklenir. */
type Sayfa = any;
async function playwright(): Promise<any> {
  if (!process.env.PLAYWRIGHT_BROWSERS_PATH && fs.existsSync(`${FB_DIZIN}/tarayici`)) process.env.PLAYWRIGHT_BROWSERS_PATH = `${FB_DIZIN}/tarayici`;
  const yol = `${FB_DIZIN}/node_modules/playwright/index.mjs`;
  return import(/* webpackIgnore: true */ yol);
}

export function fbHazirMi(): boolean {
  return process.env.FB_KAPALI !== "1" && fs.existsSync(FB_OTURUM) && fs.existsSync(`${FB_DIZIN}/node_modules/playwright`);
}

const bekle = (ms: number) => new Promise((c) => setTimeout(c, ms));
const rastgele = (a: number, b: number) => a + Math.floor(Math.random() * (b - a));

/** Gönderi anahtarı: metnin sade hali (aynı gönderi tekrar okununca kuyruğa girmesin). */
export function gonderiAnahtari(metin: string): string {
  return createHash("sha1").update(metin.toLocaleLowerCase("tr").replace(/\s+/g, " ").slice(0, 300)).digest("hex").slice(0, 20);
}

/** Grup → görülen gönderi anahtarları (son 400). */
export function gorulenOku(): Record<string, string[]> {
  try {
    return JSON.parse(fs.readFileSync(GORULEN_DOSYA, "utf8")) as Record<string, string[]>;
  } catch {
    return {};
  }
}
export function gorulenYaz(g: Record<string, string[]>): void {
  for (const k of Object.keys(g)) g[k] = g[k].slice(-400);
  fs.writeFileSync(GORULEN_DOSYA, JSON.stringify(g));
}

export async function fbOturumAc(): Promise<{ sayfa: Sayfa; kapat: () => Promise<void> }> {
  const { chromium } = await playwright();
  const tarayici = await chromium.launch({ headless: true, args: ["--disable-blink-features=AutomationControlled"] });
  const bag = await tarayici.newContext({
    storageState: FB_OTURUM,
    locale: "tr-TR",
    timezoneId: "Europe/Istanbul",
    userAgent: UA,
    viewport: { width: 1366, height: 900 },
  });
  const sayfa = await bag.newPage();
  const kapat = async () => {
    await bag.storageState({ path: FB_OTURUM }).catch(() => null);
    await tarayici.close().catch(() => null);
  };
  return { sayfa, kapat };
}

function oturumKontrol(sayfa: Sayfa): void {
  const url = sayfa.url();
  if (/\/login|checkpoint|two_step_verification|\/recover/.test(url)) {
    throw new FbOturumHatasi(`Facebook giriş / doğrulama istiyor (${url.split("?")[0]})`);
  }
}

/** Hesabın katıldığı gruplar. */
export async function katilinanGruplar(sayfa: Sayfa): Promise<FbGrup[]> {
  await sayfa.goto("https://www.facebook.com/groups/joins/?nav_source=tab", { waitUntil: "domcontentloaded", timeout: 60000 });
  await bekle(6000);
  oturumKontrol(sayfa);
  const gruplar = new Map<string, string>();
  for (let i = 0; i < 12; i++) {
    const parca: { href: string; ad: string }[] = await sayfa.$$eval("a[href*='/groups/']", (as: any[]) =>
      as.map((a: any) => ({ href: String(a.href).split("?")[0], ad: String(a.textContent || "").trim() }))
    );
    for (const p of parca) {
      const m = p.href.match(/facebook\.com\/groups\/([^/]+)\/?$/);
      if (!m || ["feed", "discover", "joins", "create"].includes(m[1])) continue;
      if (!p.ad || p.ad === "Grubu gör") continue;
      // "…En son X önce aktifti" ekini at
      const ad = p.ad.replace(/En son .*?aktifti$/, "").trim();
      if (ad && !gruplar.has(m[1])) gruplar.set(m[1], ad);
    }
    await sayfa.mouse.wheel(0, 3000);
    await bekle(rastgele(1500, 2500));
  }
  return [...gruplar].map(([id, ad]) => ({ id, ad }));
}

/** Grubun en yeni gönderileri (kronolojik sırayla). */
export async function grupGonderileri(sayfa: Sayfa, grupId: string, kaydirma = 5): Promise<FbGonderi[]> {
  await sayfa.goto(`https://www.facebook.com/groups/${grupId}/?sorting_setting=CHRONOLOGICAL`, { waitUntil: "domcontentloaded", timeout: 60000 });
  await bekle(rastgele(5000, 7000));
  oturumKontrol(sayfa);
  const toplanan = new Map<string, FbGonderi>();
  for (let i = 0; i < kaydirma; i++) {
    for (const b of await sayfa.locator("div[role=button]").filter({ hasText: /^(Daha fazlasını gör|Devamını Gör|Devamını gör|See more)$/i }).all()) {
      await b.click({ timeout: 1000 }).catch(() => null);
    }
    await bekle(700);
    const metinler: string[] = await sayfa.$$eval("div[role=feed] > div", (d: any[]) =>
      d.map((x) => {
        const m = x.querySelector("div[data-ad-preview=message], div[data-ad-comet-preview=message]") || x.querySelector("div[dir=auto]");
        return String(m?.innerText || "").trim();
      })
    );
    for (const ham of metinler) {
      const metin = ham.replace(/\s*(Daha fazlasını gör|Daha azını gör|Devamını Gör|Devamını gör)\s*$/i, "").trim();
      if (metin.length < 15) continue;
      const anahtar = gonderiAnahtari(metin);
      if (!toplanan.has(anahtar)) toplanan.set(anahtar, { metin, anahtar });
    }
    await sayfa.mouse.wheel(0, rastgele(2000, 2800));
    await bekle(rastgele(2000, 3200));
  }
  return [...toplanan.values()];
}
