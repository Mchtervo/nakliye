/**
 * yuklegel.com — ücretsiz/açık ilanlardan firma + numara toplama.
 * Amaç yük kapmak değil; müşteri havuzuna sinyal.
 */
import { prisma } from "@/lib/prisma";
import { aiKullanilabilir } from "@/lib/ai/istemci";
import { butceMusaitMi } from "@/lib/ai/butce";
import { ilanlariCozumle, type CozulmusIlan } from "@/lib/ai/ilanCozumle";
import { illeriBul } from "@/lib/iller";
import { htmlMetneCevir } from "@/lib/kaynaklar/web";
import { ilanlariKaydet } from "@/lib/kaynaklar/kaydet";
import { telefonNormalize } from "@/lib/musteriHavuz";
import {
  YUKLEGEL_SECICILER,
  type YuklegelHamKart,
} from "@/lib/kaynaklar/yuklegelSeciciler";

const KAYNAK_AD = "yuklegel.com";
const KAYNAK_HEDEF = "https://yuklegel.com/";

export type YuklegelRapor = {
  sayfa: number;
  kart: number;
  kayit: number;
  aiFallback: boolean;
  aiAtlandi: boolean;
  hatalar: string[];
};

function bekle(ms: number): Promise<void> {
  return new Promise((r) => setTimeout(r, ms));
}

function paywallMu(metin: string): boolean {
  return YUKLEGEL_SECICILER.paywallKalip.some((k) => k.test(metin));
}

function engelliUrlMi(url: string): boolean {
  const u = url.toLowerCase();
  return YUKLEGEL_SECICILER.engelliYol.some((y) => u.includes(y));
}

function telefonCikar(metin: string): string | null {
  const m = metin.match(YUKLEGEL_SECICILER.telefonRegex);
  if (!m?.[0]) return null;
  const n = telefonNormalize(m[0]);
  return n ? `0${n}` : null;
}

/** Firecrawl v1 scrape — yoksa düz fetch. */
async function sayfaCek(url: string): Promise<{ html: string; markdown: string }> {
  const key = (process.env.FIRECRAWL_API_KEY || "").trim();
  if (key) {
    const cevap = await fetch("https://api.firecrawl.dev/v1/scrape", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${key}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        url,
        formats: ["markdown", "html"],
        onlyMainContent: true,
      }),
      signal: AbortSignal.timeout(60_000),
    });
    if (!cevap.ok) {
      const t = await cevap.text().catch(() => "");
      throw new Error(`Firecrawl ${cevap.status}: ${t.slice(0, 200)}`);
    }
    const j = (await cevap.json()) as {
      success?: boolean;
      data?: { markdown?: string; html?: string };
      markdown?: string;
      html?: string;
    };
    const data = j.data || j;
    return {
      html: data.html || "",
      markdown: data.markdown || "",
    };
  }

  // Anahtar yok — düz HTML (sınırlı; SPA'da boş gelebilir)
  const cevap = await fetch(url, {
    headers: {
      "User-Agent":
        "Mozilla/5.0 (compatible; NakliyeDefteri/1.0; +https://github.com/Mchtervo/nakliye)",
      Accept: "text/html",
      "Accept-Language": "tr-TR,tr;q=0.9",
    },
    signal: AbortSignal.timeout(20_000),
    cache: "no-store",
  });
  if (!cevap.ok) throw new Error(`HTTP ${cevap.status}`);
  const html = await cevap.text();
  return { html, markdown: htmlMetneCevir(html) };
}

/** CSS/metin ile kartlara böl (AI yok). */
export function cssIleKartlariAyikla(
  markdown: string,
  html: string,
  kaynakUrl: string
): YuklegelHamKart[] {
  const metin = (markdown || htmlMetneCevir(html || "")).trim();
  if (metin.length < 80) return [];

  // Zaman ayırıcıya göre blokla
  const parcalar = metin
    .split(/(?=\d+\s*(?:dakika|saat|gün)\s*önce)/i)
    .map((p) => p.trim())
    .filter((p) => p.length > 30);

  const kartlar: YuklegelHamKart[] = [];
  const gorulenTel = new Set<string>();

  for (const p of parcalar.length > 1 ? parcalar : [metin]) {
    if (paywallMu(p)) continue;
    const telefon = telefonCikar(p);
    if (!telefon) continue;
    const norm = telefonNormalize(telefon);
    if (!norm || gorulenTel.has(norm)) continue;
    gorulenTel.add(norm);
    kartlar.push({
      metin: p.slice(0, 2000),
      telefon,
      kaynakUrl,
    });
  }

  // Zaman ayırıcı yoksa tüm metinden telefonları tara
  if (kartlar.length === 0) {
    const satirlar = metin.split(/\n+/);
    for (let i = 0; i < satirlar.length; i++) {
      const pencere = satirlar.slice(Math.max(0, i - 2), i + 3).join("\n");
      if (paywallMu(pencere)) continue;
      const telefon = telefonCikar(satirlar[i] || "");
      if (!telefon) continue;
      const norm = telefonNormalize(telefon);
      if (!norm || gorulenTel.has(norm)) continue;
      gorulenTel.add(norm);
      kartlar.push({
        metin: pencere.slice(0, 2000),
        telefon,
        kaynakUrl,
      });
    }
  }

  return kartlar;
}

function htmlSayfaLinkleri(html: string, markdown: string): string[] {
  const ham = `${html}\n${markdown}`;
  const set = new Set<string>();
  for (const u of YUKLEGEL_SECICILER.listUrls) set.add(u);
  const re = YUKLEGEL_SECICILER.sayfaLinkRegex;
  re.lastIndex = 0;
  let m: RegExpExecArray | null;
  while ((m = re.exec(ham)) !== null) {
    const raw = m[0].replace(/[),.;]+$/, "");
    if (engelliUrlMi(raw)) continue;
    try {
      const url = new URL(raw);
      if (!url.hostname.includes("yuklegel")) continue;
      // Query temizle kısmen
      set.add(`${url.origin}${url.pathname}${url.search}`.replace(/\/$/, "/") || url.href);
    } catch {
      /* ignore */
    }
    if (set.size >= YUKLEGEL_SECICILER.maxSayfa) break;
  }
  return [...set].slice(0, YUKLEGEL_SECICILER.maxSayfa);
}

function karttanIlan(k: YuklegelHamKart): CozulmusIlan | null {
  if (!k.telefon) return null;
  const iller = illeriBul(k.metin);
  const cikisIl = iller[0] || null;
  const varisIl = iller[1] || iller[0] || null;
  // En az telefon şart; rota yoksa yine kaydet (havuz için) — sahte rota verme
  if (!cikisIl || !varisIl || cikisIl === varisIl) {
    // Rota belirsiz: kayıt için aynı il kabul etmeyiz → atla
    // Yine de firma sinyali için cikis/varis farklı zorunlu; ikinci il yoksa atla
    if (iller.length < 2) return null;
  }
  const a = iller[0]!;
  const b = iller[1] || iller[0]!;
  if (a === b) return null;

  // Firma adı: ilk satır veya "X LOJİSTİK" benzeri
  const satir = k.metin.split(/\n/).map((s) => s.trim()).filter(Boolean)[0] || null;
  const firma =
    satir && satir.length < 80 && !/^\d/.test(satir)
      ? satir.slice(0, 80)
      : null;

  return {
    firmaAdi: firma,
    ilgiliKisi: null,
    telefon: k.telefon,
    nereden: a,
    nereye: b,
    cikisIl: a,
    varisIl: b,
    yuklemeTarihi: null,
    ucret: null,
    fiyatTon: null,
    fiyatBelirsiz: true,
    tonaj: null,
    aracTipi: null,
    aracTipiKod: null,
    yukTipi: null,
    guvenSkoru: YUKLEGEL_SECICILER.guvenSkoru,
  };
}

async function kaynakIdAl(): Promise<number> {
  const mevcut = await prisma.ilanKaynagi.findFirst({
    where: { tur: "WEB", hedef: KAYNAK_HEDEF },
    select: { id: true },
  });
  if (mevcut) {
    await prisma.ilanKaynagi.update({
      where: { id: mevcut.id },
      data: {
        aktif: true,
        durum: "AKTIF",
        oncelik: 1,
        sonTarama: new Date(),
      },
    });
    return mevcut.id;
  }
  const yeni = await prisma.ilanKaynagi.create({
    data: {
      tur: "WEB",
      ad: KAYNAK_AD,
      hedef: KAYNAK_HEDEF,
      aktif: true,
      durum: "AKTIF",
      oncelik: 1,
    },
  });
  return yeni.id;
}

/**
 * Tek tur: max 20 sayfa, 3 sn ara, CSS parse → gerekirse AI (bütçe doluysa atla).
 */
export async function yuklegelTara(): Promise<YuklegelRapor> {
  const rapor: YuklegelRapor = {
    sayfa: 0,
    kart: 0,
    kayit: 0,
    aiFallback: false,
    aiAtlandi: false,
    hatalar: [],
  };

  if (!(process.env.FIRECRAWL_API_KEY || "").trim()) {
    rapor.hatalar.push("FIRECRAWL_API_KEY yok — yine de fetch denenecek");
  }

  const kuyruk: string[] = [...YUKLEGEL_SECICILER.listUrls];
  const gezilen = new Set<string>();
  const tumKartlar: YuklegelHamKart[] = [];

  while (kuyruk.length > 0 && gezilen.size < YUKLEGEL_SECICILER.maxSayfa) {
    const url = kuyruk.shift()!;
    if (gezilen.has(url) || engelliUrlMi(url)) continue;
    gezilen.add(url);

    try {
      if (rapor.sayfa > 0) await bekle(YUKLEGEL_SECICILER.istekArasiMs);
      const { html, markdown } = await sayfaCek(url);
      rapor.sayfa += 1;

      const kartlar = cssIleKartlariAyikla(markdown, html, url);
      tumKartlar.push(...kartlar);

      for (const l of htmlSayfaLinkleri(html, markdown)) {
        if (
          !gezilen.has(l) &&
          !engelliUrlMi(l) &&
          kuyruk.length + gezilen.size < YUKLEGEL_SECICILER.maxSayfa
        ) {
          kuyruk.push(l);
        }
      }
    } catch (e) {
      rapor.hatalar.push(
        `${url}: ${e instanceof Error ? e.message : "hata"}`
      );
    }
  }

  // Tekilleştir telefon
  const tekil = new Map<string, YuklegelHamKart>();
  for (const k of tumKartlar) {
    const n = telefonNormalize(k.telefon);
    if (!n) continue;
    if (!tekil.has(n)) tekil.set(n, k);
  }
  rapor.kart = tekil.size;

  let ilanlar: CozulmusIlan[] = [];
  for (const k of tekil.values()) {
    const i = karttanIlan(k);
    if (i) ilanlar.push(i);
  }

  // CSS yetersiz → AI fallback (bütçe doluysa atla)
  if (ilanlar.length < 3 && tekil.size > 0) {
    const butceOk = await butceMusaitMi();
    if (!butceOk || !aiKullanilabilir()) {
      rapor.aiAtlandi = true;
      console.log(
        "[yuklegel] AI fallback atlandı (bütçe dolu veya AI kapalı)"
      );
    } else {
      rapor.aiFallback = true;
      const birlesik = [...tekil.values()]
        .slice(0, 25)
        .map((k) => k.metin)
        .join("\n---\n")
        .slice(0, 12000);
      try {
        const cozulen = await ilanlariCozumle(birlesik);
        for (const c of cozulen) {
          c.guvenSkoru = Math.min(
            c.guvenSkoru || YUKLEGEL_SECICILER.guvenSkoru,
            YUKLEGEL_SECICILER.guvenSkoru + 5
          );
        }
        ilanlar = cozulen.filter((c) => c.telefon && c.cikisIl && c.varisIl);
      } catch (e) {
        rapor.hatalar.push(
          `AI fallback: ${e instanceof Error ? e.message : "hata"}`
        );
      }
    }
  }

  if (ilanlar.length === 0) {
    await prisma.ilanKaynagi.updateMany({
      where: { tur: "WEB", hedef: KAYNAK_HEDEF },
      data: { sonTarama: new Date() },
    });
    return rapor;
  }

  const kaynakId = await kaynakIdAl();
  const kaydedilen = await ilanlariKaydet(
    kaynakId,
    ilanlar.map((ilan) => ({
      ilan,
      hamMetin: `[yuklegel] ${ilan.nereden || "?"}→${ilan.nereye || "?"} ${ilan.telefon || ""}`.slice(
        0,
        500
      ),
    }))
  );
  rapor.kayit = kaydedilen.length;

  await prisma.ilanKaynagi.update({
    where: { id: kaynakId },
    data: {
      sonTarama: new Date(),
      bulunanAdet: { increment: kaydedilen.length },
    },
  });

  return rapor;
}
