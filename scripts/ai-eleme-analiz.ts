/**
 * Test 10 mesajından ilan üretmeyenler için eleme sebebi.
 *   npm run ts -- scripts/ai-eleme-analiz.ts
 */
import { prisma } from "@/lib/prisma";
import { aiTercihleriOku } from "@/lib/ayarlar";
import { aracKoduBul, aracMetniUyuyorMu } from "@/lib/arac";
import {
  cekirdekIlKumesi,
  genisIlKumesi,
  ilinBolgesi,
} from "@/lib/bolgeler";
import { yaklasikKarayoluKm, VARIS_UZA_KM } from "@/lib/ilMesafe";
import { ilBul, illeriBul, sadelestir } from "@/lib/iller";
import { elemeSebebi, satirlaraBol } from "@/lib/kaynaklar/onFiltre";
import { guvenliKirp } from "@/lib/metin";

type Sebep =
  | "araç_uyumsuz"
  | "bölge_dışı"
  | "varış_uzak"
  | "yer_bulunamadı"
  | "kopya"
  | "ön_filtre"
  | "kayıtlı"; // elenmedi

function ilk80(metin: string): string {
  return metin.replace(/\s+/g, " ").trim().slice(0, 80);
}

/** Satırlardan kabaca çıkış→varış adayları. */
function rotaAdaylari(metin: string): { cikis: string | null; varis: string | null; satir: string }[] {
  const adaylar: { cikis: string | null; varis: string | null; satir: string }[] = [];
  for (const satir of satirlaraBol(metin)) {
    const iller = illeriBul(satir);
    if (iller.length === 0) continue;
    if (iller.length === 1) {
      adaylar.push({ cikis: iller[0], varis: null, satir: satir.slice(0, 60) });
    } else {
      adaylar.push({
        cikis: iller[0],
        varis: iller[iller.length - 1],
        satir: satir.slice(0, 60),
      });
    }
  }
  // Ortak çıkış (mesaj başındaki il) + satırdaki varış
  const tum = illeriBul(metin);
  const baslikCikis =
    tum.find((i) =>
      /canakkale|bursa|ankara|istanbul|balikesir|bilecik/i.test(sadelestir(i))
    ) || tum[0] || null;

  if (baslikCikis) {
    for (const satir of satirlaraBol(metin)) {
      const iller = illeriBul(satir);
      for (const v of iller) {
        if (v === baslikCikis) continue;
        if (!adaylar.some((a) => a.cikis === baslikCikis && a.varis === v)) {
          adaylar.push({
            cikis: baslikCikis,
            varis: v,
            satir: satir.slice(0, 60),
          });
        }
      }
    }
  }
  return adaylar;
}

function rotaSebebi(
  cikis: string | null,
  varis: string | null,
  tercihBolgeler: string[],
  genis: Set<string>,
  cekirdek: Set<string>,
  anaUs: string | null
): Sebep | null {
  if (!cikis || !varis) return "yer_bulunamadı";
  const cekirdekte =
    cekirdek.has(cikis) || cekirdek.has(varis);
  if (!cekirdekte && genis.size < 70) {
    // en az bir uç çekirdek yoksa bölge dışı
    if (!genis.has(cikis) && !genis.has(varis)) return "bölge_dışı";
    if (!cekirdek.has(cikis) && !cekirdek.has(varis)) return "bölge_dışı";
  }
  if (!genis.has(varis)) return "bölge_dışı";

  const vb = ilinBolgesi(varis);
  if (
    vb &&
    (vb === "DOGU_ANADOLU" || vb === "GUNEYDOGU") &&
    !tercihBolgeler.includes(vb)
  ) {
    return "varış_uzak";
  }
  if (anaUs) {
    const km = yaklasikKarayoluKm(anaUs, varis);
    if (km !== null && km > VARIS_UZA_KM) return "varış_uzak";
  }
  return null; // geçerdi
}

async function main() {
  const kayit = await prisma.ayar.findUnique({
    where: { anahtar: "ai_test_son_idler" },
  });
  const idler: number[] = kayit?.deger
    ? (JSON.parse(kayit.deger) as number[])
    : [];
  if (idler.length === 0) {
    console.log("ai_test_son_idler boş");
    return;
  }

  const tercih = await aiTercihleriOku();
  const genis = new Set(genisIlKumesi(tercih.bolgeler, tercih.ekIller));
  const cekirdek = new Set(cekirdekIlKumesi(tercih.bolgeler, tercih.ekIller));
  const anaUs = tercih.anaUs || ilBul(tercih.sehir);
  const hedefOnFiltre = genis;

  const mesajlar = await prisma.hamMesaj.findMany({
    where: { id: { in: idler } },
    select: { id: true, metin: true },
  });
  const byId = new Map(mesajlar.map((m) => [m.id, m]));

  console.log(
    `Tercih: bolge=${tercih.bolgeler.join(",")} arac=${tercih.aracTipleri.join(",")} us=${anaUs}`
  );
  console.log("---");

  const belirsizNot: string[] = [];
  const ankaraBursaNot: string[] = [];

  for (const id of idler) {
    const m = byId.get(id);
    if (!m) {
      console.log(`${id} | (mesaj yok) | yer_bulunamadı`);
      continue;
    }
    const ham = m.metin;
    const kirpik = guvenliKirp(ham, 4000);
    const ilanSay = await prisma.yukIlani.count({
      where: {
        OR: [{ hamMetin: kirpik }, { hamMetin: ham.slice(0, 4000) }],
      },
    });
    if (ilanSay > 0) {
      console.log(`${id} | ${ilk80(ham)} | kayıtlı (${ilanSay} ilan)`);
      continue;
    }

    // 1) Ön filtre
    const on = elemeSebebi(ham, hedefOnFiltre);
    if (on) {
      console.log(`${id} | ${ilk80(ham)} | ön_filtre`);
      continue;
    }

    // 2) Mesaj düzeyinde araç (normalize ham'ı tarıyor)
    const hamKod = aracKoduBul(ham);
    const aracOk = aracMetniUyuyorMu(null, hamKod, tercih.aracTipleri);
    if (!aracOk) {
      console.log(
        `${id} | ${ilk80(ham)} | araç_uyumsuz` +
          (hamKod ? ` (${hamKod})` : "")
      );
      continue;
    }
    if (!hamKod) {
      belirsizNot.push(`#${id} araç belirsiz — elenmemeli (mesaj tamamen elendi, sebep başka)`);
    }

  // 3) Rota adayları
    const adaylar = rotaAdaylari(ham);
    const ciftUclu = adaylar.filter((a) => a.cikis && a.varis);
    if (ciftUclu.length === 0) {
      console.log(`${id} | ${ilk80(ham)} | yer_bulunamadı`);
      continue;
    }

    const sebepler = new Map<Sebep, number>();
    let gecen = 0;
    for (const a of ciftUclu) {
      if (
        a.cikis &&
        ["Ankara", "İstanbul", "Bursa"].includes(a.cikis)
      ) {
        const s = rotaSebebi(
          a.cikis,
          a.varis,
          tercih.bolgeler,
          genis,
          cekirdek,
          anaUs
        );
        ankaraBursaNot.push(
          `#${id} ${a.cikis}→${a.varis} → ${s ?? "GEÇERDİ"} (${a.satir})`
        );
      }
      const s =
        rotaSebebi(
          a.cikis,
          a.varis,
          tercih.bolgeler,
          genis,
          cekirdek,
          anaUs
        ) ?? ("kayıtlı" as Sebep);
      if (s === "kayıtlı") gecen += 1;
      else sebepler.set(s, (sebepler.get(s) ?? 0) + 1);
    }

    if (gecen > 0) {
      // İyi rota vardı ama ilan yok → AI çıkarmadı veya yer doğrulama
      console.log(
        `${id} | ${ilk80(ham)} | yer_bulunamadı` +
          ` (heuristic: ${gecen} rota geçerdi, AI/yer elendi)`
      );
      continue;
    }

    // En sık sebep
    let enIyi: Sebep = "bölge_dışı";
    let enN = 0;
    for (const [s, n] of sebepler) {
      if (n > enN) {
        enIyi = s;
        enN = n;
      }
    }
    // Öncelik: varış_uzak > bölge_dışı
    if ((sebepler.get("varış_uzak") ?? 0) > 0) enIyi = "varış_uzak";
    console.log(`${id} | ${ilk80(ham)} | ${enIyi}`);
  }

  console.log("\n── Belirsiz araç / Ankara-Bursa notları ──");
  for (const s of belirsizNot) console.log(s);
  for (const s of ankaraBursaNot) console.log(s);
  if (belirsizNot.length === 0) {
    console.log("(Araç belirsiz kalıp tamamen elenen mesaj yok — hepsinde kod veya başka sebep)");
  }
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
