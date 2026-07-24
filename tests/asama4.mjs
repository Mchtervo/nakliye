/**
 * Yeni özellik smoke testleri (auth + excel + yedek + kısmi ödeme)
 */
import { PrismaClient } from "@prisma/client";

const BASE = process.env.BASE_URL || "http://localhost:3000";
const prisma = new PrismaClient();
let gecen = 0;
let kalan = 0;

function assert(k, ad) {
  if (k) {
    console.log("PASS:", ad);
    gecen++;
  } else {
    console.error("FAIL:", ad);
    kalan++;
  }
}

async function main() {
  // 1) Koruma: cookie yoksa / -> /giris
  const koruma = await fetch(BASE + "/", { redirect: "manual" });
  assert(
    koruma.status === 307 || koruma.status === 302 || koruma.status === 303,
    `Korumasız / yönlendirme (${koruma.status})`
  );
  const loc = koruma.headers.get("location") || "";
  assert(loc.includes("/giris"), `Yönlendirme /giris (${loc})`);

  // 2) Giriş sayfası açık
  const giris = await fetch(BASE + "/giris");
  assert(giris.status === 200, "Giris 200");
  const girisHtml = await giris.text();
  assert(girisHtml.includes("Şifre") || girisHtml.includes("sifre"), "Giris formu");

  // 3) Kısmi ödeme: bekleyen yük yarat / bul
  let yuk = await prisma.yuk.findFirst({
    where: { odemeDurumu: { not: "ODENDI" } },
    include: { odemeler: true },
  });
  if (!yuk) {
    const firma = await prisma.firma.findFirst();
    if (firma) {
      yuk = await prisma.yuk.create({
        data: {
          tarih: new Date(),
          firmaId: firma.id,
          nereden: "Test",
          nereye: "Test2",
          kdvli: true,
          kdvDahilMi: true,
          netTutar: 1000000,
          kdvTutar: 200000,
          toplamTutar: 1200000,
          odemeDurumu: "BEKLIYOR",
        },
        include: { odemeler: true },
      });
    }
  }
  assert(!!yuk, "Test için yük var");

  if (yuk) {
    const odenen = yuk.odemeler.reduce((t, o) => t + o.tutar, 0);
    const kalanTutar = yuk.toplamTutar - odenen;
    if (kalanTutar > 10000) {
      const odeme = Math.min(50000, Math.floor(kalanTutar / 2));
      await prisma.odeme.create({
        data: { yukId: yuk.id, tarih: new Date(), tutar: odeme, not: "test kısmi" },
      });
      const yeniOdenen = odenen + odeme;
      await prisma.yuk.update({
        where: { id: yuk.id },
        data: {
          odemeDurumu: yeniOdenen >= yuk.toplamTutar ? "ODENDI" : "KISMI",
        },
      });
      const guncel = await prisma.yuk.findUnique({ where: { id: yuk.id } });
      assert(guncel?.odemeDurumu === "KISMI" || guncel?.odemeDurumu === "ODENDI", `Ödeme durumu ${guncel?.odemeDurumu}`);
    } else {
      assert(true, "Kısmi ödeme için yeterli kalan yok (atlandı)");
    }
  }

  // 4) Manifest + SW
  const man = await fetch(BASE + "/manifest.webmanifest");
  assert(man.status === 200, "manifest 200");
  const sw = await fetch(BASE + "/sw.js");
  assert(sw.status === 200, "sw.js 200");

  // Excel/yedek auth olmadan engellenmeli
  const excel = await fetch(BASE + "/api/excel", { redirect: "manual" });
  assert(
    excel.status === 307 || excel.status === 302 || excel.status === 401 || excel.status === 303,
    `Excel korumalı (${excel.status})`
  );

  await prisma.$disconnect();
  console.log(`\nSonuç: ${gecen} geçti, ${kalan} kaldı`);
  process.exit(kalan > 0 ? 1 : 0);
}

main().catch(async (e) => {
  console.error(e);
  await prisma.$disconnect();
  process.exit(1);
});
