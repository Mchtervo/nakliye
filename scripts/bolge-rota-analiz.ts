/**
 * Bugünkü BOLGE_ROTA / IL_YOK teşhisi — OpenAI yok.
 * HamMesaj üzerinden satır bazlı rota çıkarır (AI çıktısı saklanmadığı için
 * yaklaşık; komisyoncu listelerinde gerçek dağılıma yakın).
 *
 *   npm run ts -- scripts/bolge-rota-analiz.ts
 */
import { aiTercihleriOku } from "@/lib/ayarlar";
import { koridorIlKumesi } from "@/lib/koridor";
import { ilBul, illeriBul, sadelestir } from "@/lib/iller";
import { satirlaraBol, rotaSatiriMi, elemeSebebi } from "@/lib/kaynaklar/onFiltre";
import { prisma } from "@/lib/prisma";

type Tur = "UYUYOR" | "CIKIS_DISI" | "VARIS_DISI" | "IKISI_DISI" | "TEK_IL";

type RotaOrnek = {
  tur: Tur;
  cikis: string;
  varis: string;
  satir: string;
  hamId: number;
  ham: string;
};

const ILCE_ORNEK = [
  "Ostim",
  "İvedik",
  "Hadımköy",
  "Dilovası",
  "Gebze",
  "Çayırova",
  "Dudullu",
  "İkitelli",
  "Gerede",
  "Yahşihan",
  "Adapazarı",
];

function karistir<T>(arr: T[]): T[] {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

function turBul(cikis: string, varis: string, koridor: Set<string>): Tur {
  const cOk = koridor.has(cikis);
  const vOk = koridor.has(varis);
  if (cOk && vOk) return "UYUYOR";
  if (!cOk && !vOk) return "IKISI_DISI";
  if (!cOk) return "CIKIS_DISI";
  return "VARIS_DISI";
}

function rotalariCikar(
  hamId: number,
  metin: string,
  koridor: Set<string>
): RotaOrnek[] {
  const sonuc: RotaOrnek[] = [];
  const gorulen = new Set<string>();

  for (const satir of satirlaraBol(metin)) {
    if (!rotaSatiriMi(satir) && illeriBul(satir).length < 2) continue;
    const iller = illeriBul(satir);
    if (iller.length === 0) continue;
    if (iller.length === 1) {
      const k = `TEK|${iller[0]}|${satir.slice(0, 40)}`;
      if (gorulen.has(k)) continue;
      gorulen.add(k);
      sonuc.push({
        tur: "TEK_IL",
        cikis: iller[0],
        varis: "?",
        satir: satir.slice(0, 120),
        hamId,
        ham: metin,
      });
      continue;
    }
    const cikis = iller[0];
    const varis = iller[iller.length - 1];
    if (cikis === varis) continue;
    const k = `${cikis}|${varis}|${sadelestir(satir).slice(0, 40)}`;
    if (gorulen.has(k)) continue;
    gorulen.add(k);
    sonuc.push({
      tur: turBul(cikis, varis, koridor),
      cikis,
      varis,
      satir: satir.slice(0, 160),
      hamId,
      ham: metin,
    });
  }
  return sonuc;
}

function ilceGeciyorMu(metin: string, ad: string): boolean {
  const s = sadelestir(metin);
  const a = sadelestir(ad);
  if (!a) return false;
  return new RegExp(`(^|[^a-zçğıöşü])${a.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}`).test(
    s
  );
}

async function main() {
  const tercih = await aiTercihleriOku();
  const kapsam = koridorIlKumesi(tercih.koridorIller);
  const koridor = new Set(kapsam);

  console.log("=== Koridor ===");
  console.log(kapsam.join(", ") || "(boş = tüm TR)");

  console.log("\n=== İlçe → il tablosu kontrolü ===");
  for (const ad of ILCE_ORNEK) {
    const il = ilBul(ad);
    console.log(`  ${ad} → ${il ?? "YOK!"}  koridorda=${il ? koridor.has(il) : false}`);
  }

  const bugunBas = new Date();
  bugunBas.setHours(0, 0, 0, 0);

  const hamlar = await prisma.hamMesaj.findMany({
    where: { createdAt: { gte: bugunBas } },
    select: { id: true, metin: true, createdAt: true },
    orderBy: { id: "asc" },
  });

  console.log(`\n=== Bugün HamMesaj: ${hamlar.length} ===`);

  const tum: RotaOrnek[] = [];
  for (const h of hamlar) {
    tum.push(...rotalariCikar(h.id, h.metin, koridor));
  }

  const sayac: Record<string, number> = {
    UYUYOR: 0,
    CIKIS_DISI: 0,
    VARIS_DISI: 0,
    IKISI_DISI: 0,
    TEK_IL: 0,
  };
  for (const r of tum) sayac[r.tur] = (sayac[r.tur] ?? 0) + 1;

  const elenen = tum.filter(
    (r) =>
      r.tur === "CIKIS_DISI" || r.tur === "VARIS_DISI" || r.tur === "IKISI_DISI"
  );

  console.log("\n=== Satır-rota dökümü (HamMesaj heuristic, AI değil) ===");
  console.log(JSON.stringify(sayac, null, 2));
  console.log(
    `Elenen toplam: ${elenen.length} (CIKIS=${sayac.CIKIS_DISI} VARIS=${sayac.VARIS_DISI} IKISI=${sayac.IKISI_DISI})`
  );
  console.log(
    "Not: Sayaç 524 AI-BOLGE_ROTA ile birebir değil; AI çoklu rota listelerinden" +
      " satır başına ilan üretir. Dağılım oranı benzer olmalı."
  );

  const ornek30 = karistir(elenen).slice(0, 30);
  console.log("\n=== RASTGELE 30 elenen rota (ham satır) ===");
  let i = 0;
  for (const r of ornek30) {
    i += 1;
    const koridorGecen = illeriBul(r.ham).filter((il) => koridor.has(il));
    console.log(
      `\n--- ${i}. [${r.tur}] ${r.cikis}→${r.varis}  ham=#${r.hamId} ---`
    );
    console.log(`satır: ${r.satir}`);
    console.log(
      `mesajda koridor illeri: ${koridorGecen.join(", ") || "-"} | ` +
        `özet: ${r.ham.replace(/\s+/g, " ").trim().slice(0, 140)}`
    );
  }

  // İlçe adı geçiyor ama çözülemiyor / bölge dışı sanılıyor mu?
  console.log("\n=== İlçe adı geçen şüpheli durumlar ===");
  const ilceSupheli: {
    ad: string;
    cozulenIl: string | null;
    sebep: string;
    satir: string;
    hamId: number;
  }[] = [];

  for (const h of hamlar) {
    for (const ad of ILCE_ORNEK) {
      if (!ilceGeciyorMu(h.metin, ad)) continue;
      const coz = ilBul(ad);
      // Mesajdaki satırlarda bu ilçe geçenleri tara
      for (const satir of satirlaraBol(h.metin)) {
        if (!ilceGeciyorMu(satir, ad)) continue;
        const iller = illeriBul(satir);
        if (!coz) {
          ilceSupheli.push({
            ad,
            cozulenIl: null,
            sebep: "TABLODA_YOK",
            satir: satir.slice(0, 120),
            hamId: h.id,
          });
        } else if (iller.length === 0) {
          ilceSupheli.push({
            ad,
            cozulenIl: coz,
            sebep: "ILLERI_BUL_GORMEDI",
            satir: satir.slice(0, 120),
            hamId: h.id,
          });
        } else if (iller.length >= 2) {
          const cikis = iller[0];
          const varis = iller[iller.length - 1];
          const tur = turBul(cikis, varis, koridor);
          if (tur !== "UYUYOR" && (cikis === coz || varis === coz)) {
            // İlçe koridor ileye çözülmüş ama diğer uç dışı — beklenen eleme
            // "yanlış eleme" değil; sadece raporla
          }
        }
      }
    }
  }

  // Tüm bugünkü ham üzerinde: ilçe geçiyor + elemeSebebi BOLGE_DISI / IL_YOK
  // (HamMesaj'a girenler IL_YOK olamaz — ön filtre geçmiş. Ama BOLGE sonrası
  //  satır analizi için ilçe→il çözümünü doğrula.)
  const ilceGecenMesaj: { ad: string; il: string; hamId: number; kesit: string }[] =
    [];
  for (const h of hamlar) {
    for (const ad of ILCE_ORNEK) {
      if (!ilceGeciyorMu(h.metin, ad)) continue;
      const il = ilBul(ad);
      if (!il) {
        ilceSupheli.push({
          ad,
          cozulenIl: null,
          sebep: "TABLODA_YOK",
          satir: h.metin.replace(/\s+/g, " ").slice(0, 120),
          hamId: h.id,
        });
        continue;
      }
      ilceGecenMesaj.push({
        ad,
        il,
        hamId: h.id,
        kesit: h.metin.replace(/\s+/g, " ").trim().slice(0, 100),
      });
    }
  }

  console.log(`İlçe adı geçen HamMesaj eşleşmesi: ${ilceGecenMesaj.length}`);
  for (const x of karistir(ilceGecenMesaj).slice(0, 15)) {
    console.log(`  ${x.ad}→${x.il} ham=#${x.hamId} | ${x.kesit}`);
  }
  console.log(
    `Tablo/çözüm şüphesi: ${ilceSupheli.length}` +
      (ilceSupheli.length
        ? "\n" +
          ilceSupheli
            .slice(0, 20)
            .map(
              (s) =>
                `  [${s.sebep}] ${s.ad}→${s.cozulenIl ?? "?"} #${s.hamId}: ${s.satir}`
            )
            .join("\n")
        : " (yok — listedeki ilçeler tabloda ve çözülüyor)")
  );

  // IL_YOK: DB'de yok (ön filtrede elenir). Canlı gruptan örnekle.
  console.log("\n=== IL_YOK canlı örnek (Telegram son mesajlar) ===");
  try {
    const { TelegramClient, utils } = await import("telegram");
    const { StringSession } = await import("telegram/sessions/index.js");
    const { TELEGRAM_UYE } = await import("@/lib/kaynaklar/telegramUye");

    const client = new TelegramClient(
      new StringSession(process.env.TELEGRAM_SESSION || ""),
      Number(process.env.TELEGRAM_API_ID),
      process.env.TELEGRAM_API_HASH || "",
      { connectionRetries: 1, autoReconnect: false }
    );
    await client.connect();

    const aktif = await prisma.ilanKaynagi.findMany({
      where: { tur: TELEGRAM_UYE, aktif: true, durum: "AKTIF" },
      take: 12,
      select: { ad: true, hedef: true, kullaniciAdi: true },
    });

    const ilYokOrnek: { grup: string; sebep: string; metin: string }[] = [];
    let tarandi = 0;
    let ilYok = 0;

    for (const g of aktif) {
      if (ilYokOrnek.length >= 10) break;
      let entity: unknown = null;
      try {
        entity = g.kullaniciAdi
          ? await client.getEntity(g.kullaniciAdi)
          : await client.getEntity(g.hedef);
      } catch {
        try {
          entity = await client.getEntity(g.hedef);
        } catch {
          continue;
        }
      }
      if (!entity) continue;

      try {
        const msgs = await client.getMessages(entity as never, { limit: 40 });
        for (const m of msgs) {
          if (typeof m.message !== "string" || m.message.trim().length < 15) {
            continue;
          }
          tarandi += 1;
          const sebep = elemeSebebi(m.message, koridor);
          if (sebep !== "IL_YOK") continue;
          ilYok += 1;
          if (ilYokOrnek.length < 10) {
            // İlçe adayı mı?
            const ilceAd = ILCE_ORNEK.find((a) => ilceGeciyorMu(m.message, a));
            ilYokOrnek.push({
              grup: (g.ad || "?").slice(0, 40),
              sebep: ilceAd
                ? `IL_YOK ama «${ilceAd}» geçiyor (ilBul=${ilBul(ilceAd)})`
                : "IL_YOK",
              metin: m.message.replace(/\s+/g, " ").trim().slice(0, 220),
            });
          }
        }
      } catch {
        /* */
      }
    }

    await client.disconnect().catch(() => null);
    console.log(`taranan=${tarandi} IL_YOK=${ilYok}`);
    for (let n = 0; n < ilYokOrnek.length; n++) {
      const o = ilYokOrnek[n];
      console.log(`\n--- IL_YOK ${n + 1} [${o.grup}] ${o.sebep} ---`);
      console.log(o.metin);
    }
  } catch (e) {
    console.log(
      "Telegram örnek alınamadı:",
      e instanceof Error ? e.message : e
    );
  }
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
