import { prisma } from "@/lib/prisma";
import { AiHatasi, aiTestBypassIle } from "@/lib/ai/istemci";
import { mikrodolarYaz } from "@/lib/ai/maliyet";
import { AI_MAX_DENEME } from "@/lib/ai/modeller";
import { testTurButceMusaitMi, testTurTavanUsd } from "@/lib/ai/testIzin";
import { kuyrugunuCoz, type KuyrukRaporu } from "@/lib/kaynaklar/telegramUye";

export type AiTestSonuc = { hata: string } | { bilgi: string };

const TEST_IDLER_ANAHTAR = "ai_test_son_idler";
const TEST_OZET_ANAHTAR = "ai_test_son_ozet";
export const TEST_DURUM_ANAHTAR = "ai_test_durum";
export const TEST_SONUC_ANAHTAR = "ai_test_sonuc_metin";

type TestOzetKayit = {
  cagri: number;
  girdi: number;
  cikti: number;
  reasoning: number;
  maliyetMikro: number;
  kesilen: number;
  yuksekCikti: number;
  modelOrnek: string | null;
};

async function testAyarOku(anahtar: string): Promise<string | null> {
  const k = await prisma.ayar.findUnique({ where: { anahtar } });
  return k?.deger ?? null;
}

async function testAyarYaz(anahtar: string, deger: string): Promise<void> {
  await prisma.ayar.upsert({
    where: { anahtar },
    create: { anahtar, deger },
    update: { deger },
  });
}

export type TestDurum =
  | { durum: "bos" }
  | { durum: "calisiyor"; baslangicMs: number }
  | { durum: "bitti"; sonuc: AiTestSonuc; bitisMs: number }
  | { durum: "hata"; sonuc: AiTestSonuc; bitisMs: number };

export async function testDurumOku(): Promise<TestDurum> {
  const ham = await testAyarOku(TEST_DURUM_ANAHTAR);
  if (!ham) return { durum: "bos" };
  try {
    return JSON.parse(ham) as TestDurum;
  } catch {
    return { durum: "bos" };
  }
}

/** 10 dk stuck — eski "calisiyor" sayılmaz (çok parçalı test 5+ dk sürebilir). */
export async function testCalisiyorMu(): Promise<boolean> {
  const d = await testDurumOku();
  if (d.durum !== "calisiyor") return false;
  return Date.now() - d.baslangicMs < 10 * 60 * 1000;
}

/**
 * 10 mesajlık maliyet/kalite testi (kill switch bypass).
 * Uzun sürer — API arka planda çağırmalı, server action değil.
 */
export async function aiTestOnMesajCalistir(): Promise<AiTestSonuc> {
  if (!process.env.OPENAI_API_KEY) {
    return { hata: "OPENAI_API_KEY yok — VPS .env'ye key ekle." };
  }

  const oncekiOzetHam = await testAyarOku(TEST_OZET_ANAHTAR);
  let oncekiOzet: TestOzetKayit | null = null;
  if (oncekiOzetHam) {
    try {
      oncekiOzet = JSON.parse(oncekiOzetHam) as TestOzetKayit;
    } catch {
      oncekiOzet = null;
    }
  }
  if (!oncekiOzet) {
    const son = await prisma.aiCagri.findMany({
      where: { kaynak: { contains: "ilanCozumle" } },
      orderBy: { zaman: "desc" },
      take: 20,
      select: {
        zaman: true,
        girdiToken: true,
        ciktiToken: true,
        reasoningToken: true,
        maliyetMikro: true,
        hata: true,
        model: true,
      },
    });
    if (son.length > 0) {
      const t0 = son[0].zaman.getTime();
      const kume = son.filter((c) => t0 - c.zaman.getTime() < 180_000);
      oncekiOzet = {
        cagri: kume.length,
        girdi: kume.reduce((t, c) => t + c.girdiToken, 0),
        cikti: kume.reduce((t, c) => t + c.ciktiToken, 0),
        reasoning: kume.reduce((t, c) => t + c.reasoningToken, 0),
        maliyetMikro: kume.reduce((t, c) => t + c.maliyetMikro, 0),
        kesilen: kume.filter((c) => (c.hata || "").startsWith("KESILDI"))
          .length,
        yuksekCikti: kume.filter((c) => c.ciktiToken >= 500).length,
        modelOrnek: kume[0]?.model ?? null,
      };
    }
  }

  let hedefIdler: number[] = [];
  const kayitli = await testAyarOku(TEST_IDLER_ANAHTAR);
  if (kayitli) {
    try {
      hedefIdler = (JSON.parse(kayitli) as number[])
        .filter((n) => Number.isFinite(n) && n > 0)
        .slice(0, 10);
    } catch {
      hedefIdler = [];
    }
  }
  if (hedefIdler.length < 10) {
    const eksik = 10 - hedefIdler.length;
    const bekleyen = await prisma.hamMesaj.findMany({
      where: {
        islendi: false,
        denemeSayisi: { lt: AI_MAX_DENEME },
        ...(hedefIdler.length ? { id: { notIn: hedefIdler } } : {}),
      },
      orderBy: { createdAt: "asc" },
      take: eksik,
      select: { id: true },
    });
    hedefIdler.push(...bekleyen.map((m) => m.id));
  }
  if (hedefIdler.length < 10) {
    const eksik = 10 - hedefIdler.length;
    const eski = await prisma.hamMesaj.findMany({
      where: {
        id: { notIn: hedefIdler.length ? hedefIdler : [-1] },
      },
      orderBy: { createdAt: "asc" },
      take: eksik,
      select: { id: true },
    });
    hedefIdler.push(...eski.map((m) => m.id));
  }
  hedefIdler = [...new Set(hedefIdler)].slice(0, 10);

  if (hedefIdler.length > 0) {
    await prisma.hamMesaj.updateMany({
      where: { id: { in: hedefIdler } },
      data: { islendi: false, denemeSayisi: 0, hata: null },
    });
  }

  const baslangic = new Date();
  const hedefToplam = Math.max(hedefIdler.length, 10);
  let tavanDurdu = false;
  let tavanUsd = 0.05;
  let islenen = 0;
  let yeniIlan = 0;
  let raporHata: string | null = null;
  const islenenIdler: number[] = [];

  try {
    await aiTestBypassIle(async () => {
      tavanUsd = await testTurTavanUsd();
      // Mesaj mesaj: tavan aşılınca kalanları hiç başlatma.
      for (const id of hedefIdler) {
        if (!(await testTurButceMusaitMi(0))) {
          tavanDurdu = true;
          break;
        }
        try {
          const r: KuyrukRaporu = await kuyrugunuCoz(1, {
            testModu: true,
            mesajIdler: [id],
          });
          islenen += r.islenen;
          yeniIlan += r.yeniIlan;
          islenenIdler.push(...(r.mesajIdler ?? [id]));
          if (r.hata) raporHata = r.hata;
        } catch (hata) {
          if (hata instanceof AiHatasi && hata.kod === "TEST_TAVAN") {
            tavanDurdu = true;
            break;
          }
          throw hata;
        }
      }
    });
  } catch (hata) {
    if (hata instanceof AiHatasi && hata.kod === "TEST_TAVAN") {
      tavanDurdu = true;
    } else {
      return {
        hata: hata instanceof Error ? hata.message : "Test modu başarısız.",
      };
    }
  }

  try {
    const cagrilar = await prisma.aiCagri.findMany({
      where: { zaman: { gte: baslangic } },
      orderBy: { zaman: "asc" },
      select: {
        kaynak: true,
        model: true,
        maliyetMikro: true,
        girdiToken: true,
        ciktiToken: true,
        reasoningToken: true,
        basarili: true,
        hata: true,
      },
    });
    const maliyet = cagrilar.reduce((t, c) => t + c.maliyetMikro, 0);
    const girdi = cagrilar.reduce((t, c) => t + c.girdiToken, 0);
    const cikti = cagrilar.reduce((t, c) => t + c.ciktiToken, 0);
    const reasoning = cagrilar.reduce((t, c) => t + c.reasoningToken, 0);
    const yuksekCikti = cagrilar.filter((c) => c.ciktiToken >= 500).length;
    const kesilen = cagrilar.filter((c) =>
      (c.hata || "").startsWith("KESILDI")
    ).length;
    const ortCikti =
      cagrilar.length > 0 ? Math.round(cikti / cagrilar.length) : 0;
    const ortMaliyet =
      cagrilar.length > 0 ? Math.round(maliyet / cagrilar.length) : 0;

    const yeniOzet: TestOzetKayit = {
      cagri: cagrilar.length,
      girdi,
      cikti,
      reasoning,
      maliyetMikro: maliyet,
      kesilen,
      yuksekCikti,
      modelOrnek: cagrilar[0]?.model ?? null,
    };

    const idler: number[] =
      hedefIdler.length > 0
        ? hedefIdler
        : islenenIdler.length > 0
          ? islenenIdler
          : [];
    if (idler.length > 0) {
      await testAyarYaz(TEST_IDLER_ANAHTAR, JSON.stringify(idler.slice(0, 10)));
    }
    await testAyarYaz(TEST_OZET_ANAHTAR, JSON.stringify(yeniOzet));

    const satirlar = cagrilar
      .map(
        (c, i) =>
          `${i + 1}) ${c.kaynak} · ${c.model} · in ${c.girdiToken} / out ${c.ciktiToken}` +
          (c.reasoningToken > 0 ? ` / reason ${c.reasoningToken}` : "") +
          ` · ${mikrodolarYaz(c.maliyetMikro)}` +
          (c.basarili ? "" : c.hata ? ` · ${c.hata}` : " · HATA")
      )
      .join("\n");

    let karsilastirma = "";
    if (oncekiOzet && oncekiOzet.maliyetMikro > 0) {
      const dMaliyet = yeniOzet.maliyetMikro - oncekiOzet.maliyetMikro;
      const dCikti = yeniOzet.cikti - oncekiOzet.cikti;
      const dReason = yeniOzet.reasoning - oncekiOzet.reasoning;
      karsilastirma =
        `\n── ÖNCE / SONRA ──\n` +
        `Önce: ${oncekiOzet.cagri} çağrı · in ${oncekiOzet.girdi} / out ${oncekiOzet.cikti} / r ${oncekiOzet.reasoning} · ${mikrodolarYaz(oncekiOzet.maliyetMikro)} · kesilme ${oncekiOzet.kesilen}\n` +
        `Sonra: ${yeniOzet.cagri} çağrı · in ${yeniOzet.girdi} / out ${yeniOzet.cikti} / r ${yeniOzet.reasoning} · ${mikrodolarYaz(yeniOzet.maliyetMikro)} · kesilme ${yeniOzet.kesilen}\n` +
        `Fark: maliyet ${mikrodolarYaz(dMaliyet)} · out ${dCikti >= 0 ? "+" : ""}${dCikti} · reason ${dReason >= 0 ? "+" : ""}${dReason}\n`;
    }

    const { testKaliteRaporu } = await import("@/lib/ai/testKalite");
    const kalite = await testKaliteRaporu(idler);

    const tavanSatir = tavanDurdu
      ? `⛔ Tavan nedeniyle durduruldu ($${tavanUsd.toFixed(2)}), ${islenen}/${hedefToplam} mesaj işlendi.\n`
      : "";

    const ozet =
      tavanSatir +
      `Hedef mesaj: ${hedefIdler.length}, işlenen: ${islenen}, yeni ilan: ${yeniIlan}, çağrı: ${cagrilar.length}\n` +
      `Tavan: $${tavanUsd.toFixed(2)} · Toplam in ${girdi} / out ${cikti} / reason ${reasoning} · ${mikrodolarYaz(maliyet)}\n` +
      `Çağrı ort. out ${ortCikti} · ort. ${mikrodolarYaz(ortMaliyet)} · kesilme ${kesilen}\n` +
      (yuksekCikti > 0
        ? `⚠ ${yuksekCikti} çağrıda çıktı ≥500 token (hedef: altı).\n`
        : `✓ Tüm çağrılarda çıktı <500 token.\n`) +
      (ortMaliyet > 2000
        ? `⚠ Çağrı ort. ≥ $0.002 (hedef: altı).\n`
        : `✓ Çağrı ort. < $0.002.\n`) +
      (tavanDurdu
        ? ""
        : islenen < 10
          ? `⚠ Tam 10 işlenmedi (${islenen}/10) — log/deneme kontrol et.\n`
          : `✓ Tam 10 mesaj işlendi.\n`) +
      (satirlar ? `Çağrılar:\n${satirlar}\n` : "Çağrı yok.\n") +
      karsilastirma +
      `\n${kalite}\n` +
      "Cron hâlâ AI_KAPALI ile kapalı.";

    if (raporHata && !tavanDurdu) {
      return { hata: `${raporHata}\n${ozet}` };
    }

    if (tavanDurdu) {
      return {
        bilgi: `Test tavan nedeniyle durdu (${islenen}/${hedefToplam} mesaj).\n${ozet}`,
      };
    }

    return { bilgi: `Test bitti (10'luk tur).\n${ozet}` };
  } catch (hata) {
    return {
      hata: hata instanceof Error ? hata.message : "Test özeti yazılamadı.",
    };
  }
}

/**
 * Ayrı Node süreci başlatır (detached).
 * Next'te response sonrası void promise çoğu zaman ölür → 314s takılı kalır.
 */
export async function aiTestArkaPlandaBaslat(): Promise<
  { ok: true } | { ok: false; hata: string }
> {
  if (await testCalisiyorMu()) {
    return { ok: false, hata: "Test zaten çalışıyor — bitmesini bekle." };
  }

  const { testIzniDurum } = await import("@/lib/ai/testIzin");
  const izin = await testIzniDurum();
  if (!izin.varMi) {
    return {
      ok: false,
      hata: "Tek seferlik test izni yok. Önce «1 test izni ver», sonra testi başlat.",
    };
  }

  const baslangicMs = Date.now();
  await testAyarYaz(
    TEST_DURUM_ANAHTAR,
    JSON.stringify({ durum: "calisiyor", baslangicMs } satisfies TestDurum)
  );

  const { spawn } = await import("node:child_process");
  const { join } = await import("node:path");
  const script = join(process.cwd(), "scripts", "ai-test-on.ts");
  const child = spawn(
    process.execPath,
    [
      "--env-file=.env",
      "--import",
      "./scripts/ts-kayit.mjs",
      "--disable-warning=ExperimentalWarning",
      "--disable-warning=MODULE_TYPELESS_PACKAGE_JSON",
      script,
    ],
    {
      cwd: process.cwd(),
      detached: true,
      stdio: "ignore",
      env: process.env,
    }
  );
  child.unref();

  return { ok: true };
}
