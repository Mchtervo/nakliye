/**
 * Son 3 saat HamMesaj / eleme / grup aktivitesi teşhisi.
 */
import { prisma } from "@/lib/prisma";
import { elemeSayaclariOku, bugunAnahtar } from "@/lib/kaynaklar/elemeSayac";
import { grupOkumaToplu } from "@/lib/kaynaklar/grupOkumaSayac";
import { TELEGRAM_UYE } from "@/lib/kaynaklar/telegramUye";

async function main() {
  const ucSaat = new Date(Date.now() - 3 * 60 * 60 * 1000);
  const yirmiDk = new Date(Date.now() - 20 * 60 * 1000);

  const [
    ham3s,
    ham20dk,
    hamUid3s,
    kuyruk,
    aktifGrup,
    sonHam,
    sonIlan,
    eleme,
  ] = await Promise.all([
    prisma.hamMesaj.count({ where: { createdAt: { gte: ucSaat } } }),
    prisma.hamMesaj.count({ where: { createdAt: { gte: yirmiDk } } }),
    prisma.hamMesaj.count({
      where: { createdAt: { gte: ucSaat }, gonderenUserId: { not: null } },
    }),
    prisma.hamMesaj.count({ where: { islendi: false } }),
    prisma.ilanKaynagi.count({
      where: { tur: TELEGRAM_UYE, aktif: true, durum: "AKTIF" },
    }),
    prisma.hamMesaj.findMany({
      orderBy: { createdAt: "desc" },
      take: 15,
      select: {
        id: true,
        kaynakId: true,
        mesajId: true,
        gonderenUserId: true,
        islendi: true,
        hata: true,
        createdAt: true,
        metin: true,
      },
    }),
    prisma.yukIlani.findMany({
      orderBy: { createdAt: "desc" },
      take: 8,
      select: {
        id: true,
        nereden: true,
        nereye: true,
        createdAt: true,
        gonderenUserId: true,
        hamMesajId: true,
      },
    }),
    elemeSayaclariOku(),
  ]);

  const grupSon = await prisma.ilanKaynagi.findMany({
    where: { tur: TELEGRAM_UYE, aktif: true, durum: "AKTIF" },
    select: {
      id: true,
      ad: true,
      sonTarama: true,
      sonMesajId: true,
      sonHata: true,
    },
    orderBy: { sonTarama: "desc" },
    take: 20,
  });

  const okumaMap = await grupOkumaToplu(grupSon.map((g) => g.id));
  let cekilenToplam = 0;
  let kuyrukToplam = 0;
  const elenenToplam: Record<string, number> = {};
  for (const o of okumaMap.values()) {
    cekilenToplam += o.cekilen;
    kuyrukToplam += o.kuyruk;
    for (const [k, v] of Object.entries(o.elenen || {})) {
      elenenToplam[k] = (elenenToplam[k] ?? 0) + v;
    }
  }

  console.log("=== HamMesaj ===");
  console.log(`Son 3 saat: ${ham3s} (uid dolu: ${hamUid3s})`);
  console.log(`Son 20 dk: ${ham20dk}`);
  console.log(`Kuyruk (islendi=false): ${kuyruk}`);
  console.log(`Aktif grup: ${aktifGrup}`);

  console.log("\n=== Bugün eleme (global) ===");
  console.log(`gün=${bugunAnahtar()}`, JSON.stringify(eleme, null, 2));

  console.log("\n=== Bugün grup okuma (çekilen / kuyruk / elenen) ===");
  console.log(`çekilen=${cekilenToplam} kuyruk=${kuyrukToplam}`);
  console.log("elenen:", JSON.stringify(elenenToplam, null, 2));
  for (const g of grupSon) {
    const o = okumaMap.get(g.id);
    if (!o || o.cekilen === 0) continue;
    console.log(
      `  #${g.id} cekilen=${o.cekilen} kuyruk=${o.kuyruk} elenen=${JSON.stringify(o.elenen)}`
    );
  }

  console.log("\n=== Son 15 HamMesaj ===");
  for (const h of sonHam) {
    console.log(
      `#${h.id} k=${h.kaynakId} tg=${h.mesajId} uid=${h.gonderenUserId || "-"} ` +
        `islendi=${h.islendi} ${h.createdAt.toISOString()} | ${h.metin.slice(0, 50).replace(/\n/g, " ")}`
    );
  }

  console.log("\n=== Son ilanlar ===");
  for (const i of sonIlan) {
    console.log(
      `#${i.id} ${i.nereden}→${i.nereye} uid=${i.gonderenUserId || "-"} ham=${i.hamMesajId ?? "-"} ${i.createdAt.toISOString()}`
    );
  }

  console.log("\n=== Aktif grup sonTarama ===");
  const simdi = Date.now();
  for (const g of grupSon) {
    const dk = g.sonTarama
      ? Math.round((simdi - g.sonTarama.getTime()) / 60000)
      : null;
    console.log(
      `#${g.id} ${(g.ad || "?").slice(0, 30)} sonMesaj=${g.sonMesajId} ` +
        `tarama=${dk === null ? "?" : dk + "dk önce"} hata=${(g.sonHata || "-").slice(0, 40)}`
    );
  }
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
