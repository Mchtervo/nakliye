import Image from "next/image";
import Link from "next/link";
import { aiTercihleriOku } from "@/lib/ayarlar";
import { belgeAdi, kalanGun } from "@/lib/belge";
import { kartlarDurumu } from "@/lib/krediKarti";
import { yaklasanTaksitler } from "@/lib/kredi";
import { tlYazKisa } from "@/lib/para";
import { prisma } from "@/lib/prisma";
import { kmOzeti } from "@/lib/seferKm";
import { veresiyeDurumu } from "@/lib/veresiye";

type Tur = "kart" | "belge" | "bakim" | "veresiye" | "kredi";
export type YaklasanSatir = { anahtar: string; href: string; baslik: string; deger: string; ek?: string; acil: boolean; tur: Tur };

const IKON: Record<Tur, string> = {
  kart: "/ana/y-kart-2.png",
  belge: "/ana/y-belge-2.png",
  bakim: "/ana/y-bakim-2.png",
  veresiye: "/ana/y-veresiye-2.png",
  kredi: "/ana/y-kart-2.png",
};

const gunYazi = (g: number) => (g < 0 ? `${-g} gün geçti` : g === 0 ? "bugün" : `${g} gün`);

function Oge({ s }: { s: YaklasanSatir }) {
  return (
    <Link href={s.href} className="ana-yaklasan">
      <Image src={IKON[s.tur]} alt="" width={40} height={40} className="h-10 w-10 shrink-0" />
      <span className="min-w-0 flex-1">
        <span className="flex items-center gap-1.5">
          <span className="truncate text-[13.5px] font-bold">{s.baslik}</span>
          {s.acil && <span className="h-2 w-2 shrink-0 rounded-full bg-[#f59e0b]" aria-label="acil" />}
        </span>
        <span className="block truncate text-[12.5px] text-[var(--a-ikincil)]">
          <span className="font-semibold text-[var(--a-murekkep)]">{s.deger}</span>
          {s.ek && <span className={s.acil ? "font-semibold text-[#ea580c]" : ""}> • {s.ek}</span>}
        </span>
      </span>
    </Link>
  );
}

/**
 * Ana sayfa: yalnız dikkat isteyenler (kart son ödemesi, biten belge, bakım,
 * veresiye borcu). Hiçbiri yoksa bölüm hiç görünmez; detay kendi sayfasında.
 */
export default async function Yaklasanlar() {
  const simdi = new Date();
  const tercih = await aiTercihleriOku().catch(() => null);
  const [kartlar, belgeler, km, veresiye, taksitler] = await Promise.all([
    kartlarDurumu(simdi).catch(() => []),
    prisma.belge.findMany({ orderBy: { bitis: "asc" } }).catch(() => []),
    kmOzeti(simdi, tercih?.anaUs || "Ankara").catch(() => null),
    veresiyeDurumu().catch(() => []),
    yaklasanTaksitler(7, simdi).catch(() => []),
  ]);

  const satirlar: YaklasanSatir[] = [];
  for (const t of taksitler) {
    satirlar.push({
      anahtar: `t${t.id}`,
      href: "/krediler",
      baslik: `${t.krediAd} · ${t.sira}. taksit`,
      deger: tlYazKisa(t.tutar),
      ek: gunYazi(t.kalanGun),
      acil: t.kalanGun <= 1,
      tur: "kredi",
    });
  }
  for (const k of kartlar) {
    if (k.kalan <= 0 || k.kalanGun > 5) continue;
    satirlar.push({
      anahtar: `k${k.id}`,
      href: "/kartlar",
      baslik: `${k.ad} son ödeme`,
      deger: tlYazKisa(k.kalan),
      ek: gunYazi(k.kalanGun),
      acil: k.kalanGun <= 1,
      tur: "kart",
    });
  }
  for (const b of belgeler) {
    const g = kalanGun(b.bitis, simdi);
    if (g > 30) continue;
    satirlar.push({
      anahtar: `b${b.id}`,
      href: "/arac#belgeler",
      baslik: belgeAdi(b.tur, b.ad),
      deger: g < 0 ? `${-g} gün önce bitti` : g === 0 ? "Bugün bitiyor" : `${g} gün`,
      acil: g <= 7,
      tur: "belge",
    });
  }
  if (km?.bakimaKalan != null && km.bakimaKalan <= 2000) {
    satirlar.push({
      anahtar: "bakim",
      href: "/arac#km",
      baslik: km.bakimaKalan <= 0 ? "Bakım geçti" : "Bakım",
      deger: `${Math.abs(km.bakimaKalan).toLocaleString("tr-TR")} km`,
      ek: km.bakimaKalan <= 0 ? "geçti" : undefined,
      acil: km.bakimaKalan <= 500,
      tur: "bakim",
    });
  }
  const yerler = veresiye.filter((v) => v.kalan > 0);
  if (yerler.length > 0) {
    satirlar.push({
      anahtar: "veresiye",
      href: "/veresiye",
      baslik: "Veresiye",
      deger: tlYazKisa(yerler.reduce((t, v) => t + v.kalan, 0)),
      ek: yerler.length === 1 ? yerler[0].yer : `${yerler.length} yer`,
      acil: false,
      tur: "veresiye",
    });
  }

  return <YaklasanlarGorunum satirlar={satirlar} />;
}

/** Görünüm (veri dışarıdan): yerel önizleme sayfası da örnek veriyle kullanır. */
export function YaklasanlarGorunum({ satirlar: gelen }: { satirlar: YaklasanSatir[] }) {
  if (gelen.length === 0) return null;
  const satirlar = [...gelen].sort((a, b) => Number(b.acil) - Number(a.acil));
  const ilk = satirlar.slice(0, 4);
  const kalan = satirlar.slice(4);

  return (
    <section className="ana-bolum ana-gir" style={{ animationDelay: "180ms" }} aria-labelledby="yaklasanlar">
      <h2 id="yaklasanlar" className="ana-baslik">Yaklaşanlar</h2>
      <div className="ana-yaklasan-izgara mt-2">
        {ilk.map((s) => (
          <Oge key={s.anahtar} s={s} />
        ))}
      </div>
      {kalan.length > 0 && (
        <details className="mt-1">
          <summary className="ana-link cursor-pointer list-none">Tümü ({satirlar.length}) →</summary>
          <div className="ana-yaklasan-izgara mt-1">
            {kalan.map((s) => (
              <Oge key={s.anahtar} s={s} />
            ))}
          </div>
        </details>
      )}
    </section>
  );
}
