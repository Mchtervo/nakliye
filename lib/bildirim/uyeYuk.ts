/**
 * Üyelere uygun yük bildirimi. Önceden yalnız yönetici yük bildirimi alıyordu.
 * Her üye için (kendi bağlamında, `uyeAdinaCalistir` içinde çağrılır):
 * - Yükler kapalıysa, telefona bildirim kapalıysa ya da kayıtlı cihaz yoksa hiçbir şey yapmaz.
 * - Ortak ilan listesinden (ana şema) son bakılandan sonra gelen ilanlar alınır;
 *   üyenin koridoru, aracı ve araç konumuna göre süzülür (yöneticiyle aynı kural: ilgiliMi).
 * - Bir turda tek bildirim: 1 ilan → ayrıntılı, çok ilan → özet (telefon çalıp durmasın).
 * - Gece 23–07 arası gönderilmez.
 */
import { prisma } from "@/lib/prisma";
import { anaPrisma } from "@/lib/prismaAna";
import { aiTercihleriOku } from "@/lib/ayarlar";
import { bildirimSessizMi, kaydaDon } from "@/lib/bildirim/gonder";
import { pushGonder, pushKullanilabilir } from "@/lib/bildirim/push";
import { aracKonumu, aracYonleri, konumKosulu } from "@/lib/konum";
import { ilgiliMi, LISTE_GUVEN } from "@/lib/kaynaklar/filtre";
import { YENI_ILAN_MS } from "@/lib/ilanTazelik";
import { uyeIlanDurumlari, yuklerAcikMi } from "@/lib/uyeIlan";
import { tlYaz } from "@/lib/para";

const SON_ANAHTAR = "uye_yuk_bildirim_son";

async function sonIdYaz(id: number) {
  await prisma.ayar.upsert({
    where: { anahtar: SON_ANAHTAR },
    update: { deger: String(id) },
    create: { anahtar: SON_ANAHTAR, deger: String(id) },
  });
}

/** Dönüş: gönderilen bildirimdeki ilan sayısı (0 = gönderilmedi). */
export async function uyeYukBildir(): Promise<number> {
  if (!pushKullanilabilir() || bildirimSessizMi()) return 0;
  if (!(await yuklerAcikMi())) return 0;
  const tercih = await aiTercihleriOku();
  if (!tercih.pushAcik) return 0;
  if ((await prisma.pushAbone.count()) === 0) return 0;

  const sonKayit = await prisma.ayar.findUnique({ where: { anahtar: SON_ANAHTAR } });
  const enSon = await anaPrisma.yukIlani.findFirst({ orderBy: { id: "desc" }, select: { id: true } });
  if (!enSon) return 0;
  // İlk çalışma: eski ilanları bir anda yağdırma, buradan sonrasını bildir
  if (!sonKayit) {
    await sonIdYaz(enSon.id);
    return 0;
  }
  const sonId = Number(sonKayit.deger) || 0;
  if (enSon.id <= sonId) return 0;

  const [konum, yonler, durumlar] = await Promise.all([aracKonumu(), aracYonleri(), uyeIlanDurumlari()]);
  const adaylar = await anaPrisma.yukIlani.findMany({
    where: {
      id: { gt: sonId },
      sonGorulme: { gte: new Date(Date.now() - YENI_ILAN_MS) },
      guvenSkoru: { gte: LISTE_GUVEN },
      durum: { notIn: ["ARSIV", "ELENDI"] },
      ...konumKosulu(konum, yonler),
    },
    orderBy: { id: "asc" },
    take: 200,
    include: { kaynak: { select: { ad: true, tur: true } } },
  });
  await sonIdYaz(enSon.id);

  const uygun = adaylar
    .filter((i) => i.kaynak?.tur !== "WEB" && !durumlar.has(i.id))
    // Dönüş talebi yöneticinindir (üyeye geçmez); yalnız-varış koridoru bildirilmez
    .map((i) => ({ ...kaydaDon(i), donusTalebiId: null, koridorTipi: i.koridorTipi }))
    .filter((k) => ilgiliMi(k, tercih));
  if (uygun.length === 0) return 0;

  const rota = (k: (typeof uygun)[number]) => `${k.nereden || k.cikisIl || "?"} → ${k.nereye || k.varisIl || "?"}`;
  if (uygun.length === 1) {
    const k = uygun[0];
    const fiyat = k.ucret && k.ucret > 0 ? tlYaz(k.ucret) : null;
    const detay = [k.tonaj ? `${k.tonaj}t` : null, k.aracTipi, fiyat].filter(Boolean).join(" · ");
    const url = `/ai/yukler?sekme=HEPSI&id=${k.id}`;
    await pushGonder({
      baslik: `Yeni yük: ${rota(k)}`,
      metin: [detay, k.firmaAdi].filter(Boolean).join(" · ") || "Ayrıntı için dokun",
      url,
      butonlar: [{ etiket: "İlanı aç", url }, ...(k.telefon ? [{ etiket: "Ara", url: `tel:${k.telefon}` }] : [])],
    });
  } else {
    const ilk = uygun.slice(0, 4).map(rota);
    await pushGonder({
      baslik: `${uygun.length} yeni yük`,
      metin: ilk.join(", ") + (uygun.length > 4 ? "…" : ""),
      url: "/ai/yukler",
      detay: uygun.slice(0, 15).map((k) => `• ${rota(k)}${k.ucret ? ` · ${tlYaz(k.ucret)}` : ""}`).join("\n"),
    });
  }
  return uygun.length;
}
