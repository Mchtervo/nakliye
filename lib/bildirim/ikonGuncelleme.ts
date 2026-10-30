/**
 * Ana ekran simgesi yenilenmemiş iPhone'lar.
 * iOS simgeyi kurulumda dondurur; tek yol sil + tekrar ekle. Yeniden eklenen
 * uygulama yeni push aboneliği açar, eskisi ölür (410 → silinir). Bu yüzden:
 * logo değişiminden ÖNCE açılmış Apple aboneliği = simgesi eski cihaz.
 */
import { prisma } from "@/lib/prisma";
import { pushGonder } from "@/lib/bildirim/push";

/** Rota logosunun yayına girdiği an (83edc38). Logo değişirse güncelle. */
export const IKON_TARIHI = new Date("2026-10-30T22:30:00Z");
const GUN_ANAHTAR = "ikon_hatirlatma_gun";
const SAAT = 10;

function appleMi(endpoint: string): boolean {
  try {
    return new URL(endpoint).host.endsWith("push.apple.com");
  } catch {
    return false;
  }
}

export async function eskiIkonluAboneler(): Promise<number[]> {
  const a = await prisma.pushAbone.findMany({
    where: { createdAt: { lt: IKON_TARIHI } },
    select: { id: true, endpoint: true },
  });
  return a.filter((x) => appleMi(x.endpoint)).map((x) => x.id);
}

export async function aboneIkonuEskiMi(endpoint: string): Promise<boolean> {
  if (!appleMi(endpoint)) return false;
  const a = await prisma.pushAbone.findUnique({ where: { endpoint }, select: { createdAt: true } });
  return Boolean(a && a.createdAt < IKON_TARIHI);
}

/** Günde bir (10:00 sonrası), yalnız simgesi eski iPhone'lara. */
export async function ikonHatirlat(): Promise<number> {
  const tr = new Date(Date.now() + 3 * 60 * 60 * 1000);
  if (tr.getUTCHours() < SAAT) return 0;
  const gun = tr.toISOString().slice(0, 10);
  const son = await prisma.ayar.findUnique({ where: { anahtar: GUN_ANAHTAR } });
  if (son?.deger === gun) return 0;
  const idler = await eskiIkonluAboneler();
  await prisma.ayar.upsert({
    where: { anahtar: GUN_ANAHTAR },
    update: { deger: gun },
    create: { anahtar: GUN_ANAHTAR, deger: gun },
  });
  if (idler.length === 0) return 0;
  const r = await pushGonder({
    baslik: "Yeni logo: simgeyi yenile",
    metin: "Ana ekrandaki simge eski kaldı. Dokun, 1 dakikada yenileyelim.",
    url: "/ana-ekran",
    aboneIdler: idler,
  });
  return r.gonderilen;
}
