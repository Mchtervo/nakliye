import Link from "next/link";
import { aiTercihleriOku } from "@/lib/ayarlar";
import { belgeAdi, kalanGun } from "@/lib/belge";
import { kartlarDurumu } from "@/lib/krediKarti";
import { tlYazKisa } from "@/lib/para";
import { prisma } from "@/lib/prisma";
import { kmOzeti } from "@/lib/seferKm";
import { veresiyeDurumu } from "@/lib/veresiye";

type Satir = { anahtar: string; href: string; baslik: string; alt: string; acil: boolean; renk: string };

const gunYazi = (g: number) => (g < 0 ? `${-g} gün geçti` : g === 0 ? "bugün" : `${g} gün kaldı`);

/**
 * Ana sayfa: yalnız dikkat isteyenler (kart son ödemesi, biten belge, bakım,
 * veresiye borcu). Hiçbiri yoksa kart hiç görünmez; detay kendi sayfasında.
 */
export default async function Yaklasanlar() {
  const simdi = new Date();
  const tercih = await aiTercihleriOku().catch(() => null);
  const [kartlar, belgeler, km, veresiye] = await Promise.all([
    kartlarDurumu(simdi).catch(() => []),
    prisma.belge.findMany({ orderBy: { bitis: "asc" } }).catch(() => []),
    kmOzeti(simdi, tercih?.anaUs || "Ankara").catch(() => null),
    veresiyeDurumu().catch(() => []),
  ]);

  const satirlar: Satir[] = [];
  for (const k of kartlar) {
    if (k.kalan <= 0 || k.kalanGun > 5) continue;
    satirlar.push({
      anahtar: `k${k.id}`,
      href: "/kartlar",
      baslik: `${k.ad} son ödeme`,
      alt: `${tlYazKisa(k.kalan)} · ${gunYazi(k.kalanGun)}`,
      acil: k.kalanGun <= 1,
      renk: "#0a84ff",
    });
  }
  for (const b of belgeler) {
    const g = kalanGun(b.bitis, simdi);
    if (g > 30) continue;
    satirlar.push({
      anahtar: `b${b.id}`,
      href: "/arac#belgeler",
      baslik: belgeAdi(b.tur, b.ad),
      alt: g < 0 ? `Süresi ${-g} gün önce bitti` : g === 0 ? "Bugün bitiyor" : `${g} gün sonra bitiyor`,
      acil: g <= 7,
      renk: "#ff9f0a",
    });
  }
  if (km?.bakimaKalan != null && km.bakimaKalan <= 2000) {
    satirlar.push({
      anahtar: "bakim",
      href: "/arac#km",
      baslik: km.bakimaKalan <= 0 ? "Bakım zamanı geçti" : "Bakım yaklaşıyor",
      alt: km.bakimaKalan <= 0 ? `${(-km.bakimaKalan).toLocaleString("tr-TR")} km geçti` : `${km.bakimaKalan.toLocaleString("tr-TR")} km kaldı`,
      acil: km.bakimaKalan <= 500,
      renk: "#30d158",
    });
  }
  const veresiyeBorc = veresiye.reduce((t, v) => t + v.kalan, 0);
  if (veresiyeBorc > 0) {
    const yer = veresiye.filter((v) => v.kalan > 0);
    satirlar.push({
      anahtar: "veresiye",
      href: "/veresiye",
      baslik: "Veresiye borcu",
      alt: `${tlYazKisa(veresiyeBorc)} · ${yer.length === 1 ? yer[0].yer : `${yer.length} yer`}`,
      acil: false,
      renk: "#bf5af2",
    });
  }

  if (satirlar.length === 0) return null;
  satirlar.sort((a, b) => Number(b.acil) - Number(a.acil));

  return (
    <section className="kart p-2 reveal" aria-label="Dikkat edilecekler">
      <p className="px-2.5 pb-1 pt-2 text-[11px] font-bold uppercase tracking-[0.14em] text-amber">Dikkat</p>
      <ul>
        {satirlar.map((s, i) => (
          <li key={s.anahtar} className="satir-akar" style={{ animationDelay: `${i * 60}ms` }}>
            <Link href={s.href} className="dokun flex items-center gap-3 rounded-xl px-2.5 py-2.5">
              <span className="h-2.5 w-2.5 shrink-0 rounded-full" style={{ background: s.acil ? "#ff453a" : s.renk }} />
              <span className="min-w-0 flex-1">
                <span className="block truncate text-[15px] font-semibold">{s.baslik}</span>
                <span className={`block truncate text-[13px] ${s.acil ? "font-semibold text-ember" : "text-fog"}`}>{s.alt}</span>
              </span>
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" className="h-4 w-4 shrink-0 text-white/30">
                <path d="m9 6 6 6-6 6" />
              </svg>
            </Link>
          </li>
        ))}
      </ul>
    </section>
  );
}
