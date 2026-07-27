/**
 * Nano vs Luna A/B — aynı ham metin, skor tablosu (DB'ye ilan yazmaz).
 */
import { prisma } from "@/lib/prisma";
import type { CozulmusIlan } from "@/lib/ai/ilanCozumle";
import { ilanlariCozumle } from "@/lib/ai/ilanCozumle";
import { mikrodolarYaz } from "@/lib/ai/maliyet";
import { aracKoduBul } from "@/lib/arac";
import { aiTercihleriOku } from "@/lib/ayarlar";
import { koridorIlKumesi } from "@/lib/koridor";
import { illeriBul, sadelestir } from "@/lib/iller";
import { hamRotalariCikar, telefonlariCikar } from "@/lib/kaynaklar/onDedup";
import {
  rotaSatirSayisi,
} from "@/lib/kaynaklar/onFiltre";

const FIYAT_ISARETI =
  /(\d{3,})\s*(\+|tl|₺|kdv)|(\/\s*ton)|(\b(komple|navlun)\b)/i;
const TONAJ_ISARETI = /(\d{1,2})\s*(ton|tn)\b/i;
const ARAC_ISARETI =
  /\b(tenteli|frigo|damper|lowbed|kamyon|kamyonet|tır|tir|dorse|sal\b|kirkayak|kırkayak)\b/i;

export type AbMesaj = { id: number; metin: string };

export type ModelSkor = {
  model: string;
  etiket: string;
  rotaSayisi: number;
  beklenenRota: number;
  /** (beklenen - yakalanan) / beklenen; negatif = fazla çıkardı */
  rotaKacirmaOrani: number | null;
  telDogru: number;
  telEksik: number;
  telYanlis: number;
  firmaKisiDogru: number;
  firmaKisiYanlis: number;
  yerOk: number;
  yerUydurma: number;
  fiyatYakalanan: number;
  fiyatKacirilan: number;
  tonajYakalanan: number;
  tonajKacirilan: number;
  aracYakalanan: number;
  aracKacirilan: number;
  maliyetMikro: number;
  cagri: number;
  kesilme: number;
  /** Mesaj başına rota özeti */
  mesajOzet: { id: number; beklenen: number; bulunan: number }[];
};

function hamdaVarMi(ham: string, deger: string | null): boolean | null {
  if (!deger) return null;
  const sadeHam = sadelestir(ham);
  const sade = sadelestir(deger);
  if (!sade) return null;
  if (sadeHam.includes(sade)) return true;
  const rakamHam = ham.replace(/\D/g, "");
  const rakam = deger.replace(/\D/g, "");
  if (rakam.length >= 10 && rakamHam.includes(rakam.slice(-10))) return true;
  return false;
}

function kisiGibiMi(ad: string | null): boolean {
  if (!ad) return false;
  const s = ad.trim();
  if (!s) return false;
  const sade = sadelestir(s);
  if (
    /\b(lojistik|nakliyat|nakliye|ltd|lts|a\.?s\.?|tic|san|trans|transport|kargo)\b/.test(
      sade
    )
  ) {
    return false;
  }
  return s.split(/\s+/).length <= 2 && s.length <= 28;
}

function yerUydurmaMi(ham: string, yer: string | null): boolean {
  if (!yer) return false;
  if (hamdaVarMi(ham, yer)) return false;
  const il = [...illeriBul(ham)];
  const s = sadelestir(yer);
  if (il.some((i) => sadelestir(i) === s || s.includes(sadelestir(i)))) {
    return false;
  }
  return true;
}

/** Çeşitli 10 mesaj: çok rotalı öncelikli, tekrar yok. */
export async function abMesajSec(adet = 10): Promise<AbMesaj[]> {
  const kayitli = await prisma.ayar.findUnique({
    where: { anahtar: "ai_ab_mesaj_idler" },
  });
  if (kayitli?.deger) {
    try {
      const idler = (JSON.parse(kayitli.deger) as number[]).filter(
        (n) => Number.isFinite(n) && n > 0
      );
      if (idler.length >= adet) {
        const mesajlar = await prisma.hamMesaj.findMany({
          where: { id: { in: idler.slice(0, adet) } },
          select: { id: true, metin: true },
        });
        if (mesajlar.length >= Math.min(5, adet)) {
          const map = new Map(mesajlar.map((m) => [m.id, m]));
          return idler
            .map((id) => map.get(id))
            .filter((m): m is AbMesaj => Boolean(m))
            .slice(0, adet);
        }
      }
    } catch {
      /* yeni seç */
    }
  }

  const havuz = await prisma.hamMesaj.findMany({
    where: { metin: { not: "" } },
    orderBy: { id: "desc" },
    take: 200,
    select: { id: true, metin: true },
  });

  const puanli = havuz
    .map((m) => ({
      ...m,
      rota: rotaSatirSayisi(m.metin),
      len: m.metin.length,
    }))
    .filter((m) => m.len >= 40 && m.len <= 4000)
    .sort((a, b) => b.rota - a.rota || b.len - a.len);

  const secilen: AbMesaj[] = [];
  // Önce çok rotalı (en az 2), sonra tekil
  for (const m of puanli) {
    if (secilen.length >= adet) break;
    if (m.rota >= 2) secilen.push({ id: m.id, metin: m.metin });
  }
  for (const m of puanli) {
    if (secilen.length >= adet) break;
    if (secilen.some((s) => s.id === m.id)) continue;
    secilen.push({ id: m.id, metin: m.metin });
  }

  await prisma.ayar.upsert({
    where: { anahtar: "ai_ab_mesaj_idler" },
    create: {
      anahtar: "ai_ab_mesaj_idler",
      deger: JSON.stringify(secilen.map((s) => s.id)),
    },
    update: { deger: JSON.stringify(secilen.map((s) => s.id)) },
  });

  return secilen;
}

export async function modelIleCozumle(
  mesajlar: AbMesaj[],
  model: string,
  etiket: string
): Promise<{ ilanlar: Map<number, CozulmusIlan[]>; bas: Date }> {
  const tercih = await aiTercihleriOku();
  const kapsam = koridorIlKumesi(tercih.koridorIller);
  const anaUs = tercih.anaUs || null;
  const bas = new Date();
  const ilanlar = new Map<number, CozulmusIlan[]>();

  for (const m of mesajlar) {
    process.stdout.write(`[ab] ${etiket} mesaj #${m.id}… `);
    try {
      const bulunan = await ilanlariCozumle(m.metin, kapsam, {
        filtreIlleri: kapsam,
        anaUs,
        model,
        kaynakOnek: `ab.${etiket}`,
      });
      // DB'ye yazılmaz — sadece bellek.
      ilanlar.set(m.id, bulunan);
      console.log(`${bulunan.length} rota`);
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      console.log(`HATA: ${msg.slice(0, 120)}`);
      ilanlar.set(m.id, []);
    }
  }

  return { ilanlar, bas };
}

export async function skorHesapla(
  mesajlar: AbMesaj[],
  ilanMap: Map<number, CozulmusIlan[]>,
  model: string,
  etiket: string,
  bas: Date
): Promise<ModelSkor> {
  const skor: ModelSkor = {
    model,
    etiket,
    rotaSayisi: 0,
    beklenenRota: 0,
    rotaKacirmaOrani: null,
    telDogru: 0,
    telEksik: 0,
    telYanlis: 0,
    firmaKisiDogru: 0,
    firmaKisiYanlis: 0,
    yerOk: 0,
    yerUydurma: 0,
    fiyatYakalanan: 0,
    fiyatKacirilan: 0,
    tonajYakalanan: 0,
    tonajKacirilan: 0,
    aracYakalanan: 0,
    aracKacirilan: 0,
    maliyetMikro: 0,
    cagri: 0,
    kesilme: 0,
    mesajOzet: [],
  };

  for (const m of mesajlar) {
    const beklenen = Math.max(
      hamRotalariCikar(m.metin).length,
      rotaSatirSayisi(m.metin)
    );
    const ilanlar = ilanMap.get(m.id) || [];
    skor.beklenenRota += beklenen;
    skor.rotaSayisi += ilanlar.length;
    skor.mesajOzet.push({
      id: m.id,
      beklenen,
      bulunan: ilanlar.length,
    });

    const hamTelller = telefonlariCikar(m.metin);
    const hamTelVar = hamTelller.length > 0;
    const hamFiyat = FIYAT_ISARETI.test(m.metin);
    const hamTonaj = TONAJ_ISARETI.test(m.metin);
    const hamArac = ARAC_ISARETI.test(m.metin);

    if (ilanlar.length === 0) {
      if (hamTelVar) skor.telEksik += 1;
      if (hamFiyat) skor.fiyatKacirilan += 1;
      if (hamTonaj) skor.tonajKacirilan += 1;
      if (hamArac) skor.aracKacirilan += 1;
      continue;
    }

    let telBulundu = false;
    let fiyatBulundu = false;
    let tonajBulundu = false;
    let aracBulundu = false;

    for (const i of ilanlar) {
      // Telefon
      if (i.telefon) {
        const ok = hamdaVarMi(m.metin, i.telefon);
        if (ok) {
          skor.telDogru += 1;
          telBulundu = true;
        } else skor.telYanlis += 1;
      }

      // Firma vs kişi
      if (i.firmaAdi && kisiGibiMi(i.firmaAdi) && !i.ilgiliKisi) {
        skor.firmaKisiYanlis += 1;
      } else if (i.firmaAdi || i.ilgiliKisi) {
        // Firma hamda geçiyorsa veya kişi adı ilgiliKisi'de
        const firmaOk =
          !i.firmaAdi ||
          hamdaVarMi(m.metin, i.firmaAdi) !== false ||
          !kisiGibiMi(i.firmaAdi);
        const kisiOk =
          !i.ilgiliKisi || hamdaVarMi(m.metin, i.ilgiliKisi) !== false;
        if (firmaOk && kisiOk) skor.firmaKisiDogru += 1;
        else skor.firmaKisiYanlis += 1;
      }

      // Yer
      for (const y of [i.nereden, i.nereye, i.cikisIl, i.varisIl]) {
        if (!y) continue;
        if (yerUydurmaMi(m.metin, y)) skor.yerUydurma += 1;
        else skor.yerOk += 1;
      }

      if (i.ucret != null || i.fiyatTon != null) {
        fiyatBulundu = true;
        skor.fiyatYakalanan += 1;
      }
      if (i.tonaj != null) {
        tonajBulundu = true;
        skor.tonajYakalanan += 1;
      }
      if (i.aracTipiKod || (i.aracTipi && aracKoduBul(i.aracTipi))) {
        aracBulundu = true;
        skor.aracYakalanan += 1;
      }
    }

    if (hamTelVar && !telBulundu) skor.telEksik += 1;
    if (hamFiyat && !fiyatBulundu) skor.fiyatKacirilan += 1;
    if (hamTonaj && !tonajBulundu) skor.tonajKacirilan += 1;
    if (hamArac && !aracBulundu) skor.aracKacirilan += 1;
  }

  if (skor.beklenenRota > 0) {
    skor.rotaKacirmaOrani =
      (skor.beklenenRota - skor.rotaSayisi) / skor.beklenenRota;
  }

  const cagrilar = await prisma.aiCagri.findMany({
    where: {
      zaman: { gte: bas },
      model,
      kaynak: { startsWith: `ab.${etiket}` },
    },
    select: {
      maliyetMikro: true,
      hata: true,
      kaynak: true,
    },
  });
  for (const c of cagrilar) {
    skor.cagri += 1;
    skor.maliyetMikro += c.maliyetMikro;
    if ((c.hata || "").startsWith("KESILDI")) skor.kesilme += 1;
  }

  return skor;
}

export function tabloYaz(nano: ModelSkor, luna: ModelSkor): string {
  const satir = (
    etiket: string,
    a: string | number,
    b: string | number,
    not = ""
  ) =>
    `${etiket.padEnd(28)} | ${String(a).padStart(10)} | ${String(b).padStart(10)}${not ? `  ${not}` : ""}`;

  const pct = (n: number | null) =>
    n === null ? "—" : `${(n * 100).toFixed(1)}%`;

  const lines = [
    "",
    "═══ NANO vs LUNA A/B ═══",
    `Modeller: ${nano.model}  vs  ${luna.model}`,
    "",
    satir("Metrik", "NANO", "LUNA"),
    satir("-".repeat(28), "-".repeat(10), "-".repeat(10)),
    satir("Çıkarılan rota", nano.rotaSayisi, luna.rotaSayisi),
    satir("Beklenen rota (ham)", nano.beklenenRota, luna.beklenenRota),
    satir(
      "Rota kaçırma oranı",
      pct(nano.rotaKacirmaOrani),
      pct(luna.rotaKacirmaOrani),
      "(+ = kaçırdı)"
    ),
    satir(
      "Telefon doğru/eksik/yanlış",
      `${nano.telDogru}/${nano.telEksik}/${nano.telYanlis}`,
      `${luna.telDogru}/${luna.telEksik}/${luna.telYanlis}`
    ),
    satir(
      "Firma/kişi doğru/yanlış",
      `${nano.firmaKisiDogru}/${nano.firmaKisiYanlis}`,
      `${luna.firmaKisiDogru}/${luna.firmaKisiYanlis}`
    ),
    satir(
      "Yer ok / uydurma",
      `${nano.yerOk}/${nano.yerUydurma}`,
      `${luna.yerOk}/${luna.yerUydurma}`
    ),
    satir(
      "Fiyat yakala / kaçır",
      `${nano.fiyatYakalanan}/${nano.fiyatKacirilan}`,
      `${luna.fiyatYakalanan}/${luna.fiyatKacirilan}`
    ),
    satir(
      "Tonaj yakala / kaçır",
      `${nano.tonajYakalanan}/${nano.tonajKacirilan}`,
      `${luna.tonajYakalanan}/${luna.tonajKacirilan}`
    ),
    satir(
      "Araç yakala / kaçır",
      `${nano.aracYakalanan}/${nano.aracKacirilan}`,
      `${luna.aracYakalanan}/${luna.aracKacirilan}`
    ),
    satir("AI çağrı / kesilme", `${nano.cagri}/${nano.kesilme}`, `${luna.cagri}/${luna.kesilme}`),
    satir(
      "Toplam maliyet",
      mikrodolarYaz(nano.maliyetMikro),
      mikrodolarYaz(luna.maliyetMikro)
    ),
    "",
    "── Mesaj başına rota ──",
  ];

  for (let i = 0; i < nano.mesajOzet.length; i++) {
    const n = nano.mesajOzet[i];
    const l = luna.mesajOzet[i];
    lines.push(
      `#${n.id} beklenen~${n.beklenen} → nano ${n.bulunan} · luna ${l?.bulunan ?? "?"}`
    );
  }

  // Karar kuralı
  const lunaRota = Math.max(luna.rotaSayisi, 1);
  const nanoEksik = (luna.rotaSayisi - nano.rotaSayisi) / lunaRota;
  const nanoUydurmaOran =
    nano.yerOk + nano.yerUydurma > 0
      ? nano.yerUydurma / (nano.yerOk + nano.yerUydurma)
      : 0;
  const lunaUydurmaOran =
    luna.yerOk + luna.yerUydurma > 0
      ? luna.yerUydurma / (luna.yerOk + luna.yerUydurma)
      : 0;

  lines.push("");
  lines.push("── Karar kuralı ──");
  lines.push(
    `Nano'nun Luna'ya göre rota eksiği: ${(nanoEksik * 100).toFixed(1)}%` +
      ` (eşik %10)`
  );
  lines.push(
    `Yer uydurma oranı: nano ${(nanoUydurmaOran * 100).toFixed(1)}% · luna ${(lunaUydurmaOran * 100).toFixed(1)}%`
  );

  let karar = "NANO KALSIN";
  const sebepler: string[] = [];
  if (nanoEksik > 0.1) {
    karar = "LUNA'YA DÖN";
    sebepler.push(`rota kaçırma >%10 (${(nanoEksik * 100).toFixed(1)}%)`);
  }
  if (nanoUydurmaOran > lunaUydurmaOran + 0.05 && nano.yerUydurma >= 2) {
    karar = "LUNA'YA DÖN";
    sebepler.push(
      `uydurma belirgin yüksek (nano ${nano.yerUydurma} vs luna ${luna.yerUydurma})`
    );
  }
  if (sebepler.length === 0) {
    sebepler.push("rota kaçırma ≤%10 ve uydurma kabul edilebilir");
  }
  lines.push(`ÖNERİ: ${karar}`);
  lines.push(`Gerekçe: ${sebepler.join("; ")}`);
  lines.push("");
  lines.push(
    "Not: Öneri otomatik; nihai karar senin. Luna için: OPENAI_MODEL_HIZLI=gpt-5.6-luna"
  );

  return lines.join("\n");
}
