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
/** Ayar: "YYYY-MM:adet" — Firecrawl aylık sayfa sayacı */
export const FIRECRAWL_AYLIK_SAYFA = "firecrawl_aylik_sayfa";
/** Ücretsiz kota ~1000; 900'de dur (tampon) */
const FIRECRAWL_KOTA_LIMIT = 900;

export type YuklegelRapor = {
  sayfa: number;
  kart: number;
  kayit: number;
  yeniFirma: number;
  guncellenenFirma: number;
  aiFallback: boolean;
  aiAtlandi: boolean;
  kotaAtlandi: boolean;
  aylikSayfa: number;
  hatalar: string[];
};

function trAyAnahtari(tarih = new Date()): string {
  const tr = new Date(tarih.getTime() + 3 * 60 * 60 * 1000);
  return tr.toISOString().slice(0, 7); // YYYY-MM
}

async function firecrawlAylikOku(): Promise<{ ay: string; sayfa: number }> {
  const ay = trAyAnahtari();
  const k = await prisma.ayar.findUnique({
    where: { anahtar: FIRECRAWL_AYLIK_SAYFA },
  });
  if (!k?.deger) return { ay, sayfa: 0 };
  const [kayitAy, adetHam] = k.deger.split(":");
  if (kayitAy !== ay) return { ay, sayfa: 0 }; // ayın 1'i → sıfır
  const sayfa = Number(adetHam);
  return { ay, sayfa: Number.isFinite(sayfa) ? sayfa : 0 };
}

async function firecrawlAylikYaz(ay: string, sayfa: number): Promise<void> {
  await prisma.ayar.upsert({
    where: { anahtar: FIRECRAWL_AYLIK_SAYFA },
    create: {
      anahtar: FIRECRAWL_AYLIK_SAYFA,
      deger: `${ay}:${sayfa}`,
    },
    update: { deger: `${ay}:${sayfa}` },
  });
}

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
    // aktif'e dokunma — Ayarlar Duraklat/Başlat geçerli kalsın
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
 * Aylık Firecrawl kota 900 aşılırsa tur atlanır.
 */
export async function yuklegelTara(): Promise<YuklegelRapor> {
  const rapor: YuklegelRapor = {
    sayfa: 0,
    kart: 0,
    kayit: 0,
    yeniFirma: 0,
    guncellenenFirma: 0,
    aiFallback: false,
    aiAtlandi: false,
    kotaAtlandi: false,
    aylikSayfa: 0,
    hatalar: [],
  };

  const kota = await firecrawlAylikOku();
  rapor.aylikSayfa = kota.sayfa;
  if (kota.sayfa >= FIRECRAWL_KOTA_LIMIT) {
    rapor.kotaAtlandi = true;
    console.log(
      `kota koruması: ${kota.sayfa}/1000 sayfa, tur atlandı`
    );
    rapor.hatalar.push(
      `kota koruması: ${kota.sayfa}/1000 sayfa, tur atlandı`
    );
    return rapor;
  }

  if (!(process.env.FIRECRAWL_API_KEY || "").trim()) {
    rapor.hatalar.push("FIRECRAWL_API_KEY yok — yine de fetch denenecek");
  }

  const kuyruk: string[] = [...YUKLEGEL_SECICILER.listUrls];
  const gezilen = new Set<string>();
  const tumKartlar: YuklegelHamKart[] = [];

  while (kuyruk.length > 0 && gezilen.size < YUKLEGEL_SECICILER.maxSayfa) {
    // Tur ortasında da kota aşılmasın
    if (kota.sayfa + rapor.sayfa >= FIRECRAWL_KOTA_LIMIT) break;

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

  // Aylık sayaç güncelle
  if (rapor.sayfa > 0) {
    const yeniToplam = kota.sayfa + rapor.sayfa;
    await firecrawlAylikYaz(kota.ay, yeniToplam);
    rapor.aylikSayfa = yeniToplam;
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

  // Müşteri havuzu: telefon bazlı yeni / güncellenen firma
  const batchTelefonlar = new Set<string>();
  for (const i of ilanlar) {
    const n = telefonNormalize(i.telefon);
    if (n) batchTelefonlar.add(n);
  }
  const mevcutTelefonlar = new Set<string>();
  if (batchTelefonlar.size > 0) {
    const onceki = await prisma.yukIlani.findMany({
      where: {
        OR: [...batchTelefonlar].flatMap((t10) => [
          { telefon: t10 },
          { telefon: `0${t10}` },
        ]),
      },
      select: { telefon: true },
      distinct: ["telefon"],
    });
    for (const s of onceki) {
      const n = telefonNormalize(s.telefon);
      if (n) mevcutTelefonlar.add(n);
    }
  }

  const kaynakId = await kaynakIdAl();
  const kaydedilen = await ilanlariKaydet(
    kaynakId,
    ilanlar.map((ilan) => ({
      ilan,
      hamMetin: `[yuklegel] ${ilan.nereden || "?"}→${ilan.nereye || "?"} ${ilan.telefon || ""} ${ilan.firmaAdi || ""}`.slice(
        0,
        500
      ),
    }))
  );
  rapor.kayit = kaydedilen.length;

  for (const t of batchTelefonlar) {
    if (mevcutTelefonlar.has(t)) rapor.guncellenenFirma += 1;
    else rapor.yeniFirma += 1;
  }

  await prisma.ilanKaynagi.update({
    where: { id: kaynakId },
    data: {
      sonTarama: new Date(),
      bulunanAdet: { increment: kaydedilen.length },
    },
  });

  return rapor;
}
