import Link from "next/link";
import { HareketKok } from "@/components/ana/Hareket";
import { anaYazi } from "@/components/ana/yazi";
import { DonemGecis, YatayCubuk } from "@/components/finans/RaporGrafik";
import RaporUst from "@/components/finans/RaporUst";
import { ayEtiketi, ayParametresi, ayParametresiOku } from "@/lib/kdv";
import { tlYazKisa } from "@/lib/para";
import { prisma } from "@/lib/prisma";
import { isletmeGideriMi } from "@/lib/sabitler";
import { ayAraligi } from "@/lib/tarih";

export const dynamic = "force-dynamic";

/** Yüzde değişim; önceki 0 ise anlamsız. */
const degisim = (bu: number, onceki: number) => (onceki > 0 ? Math.round(((bu - onceki) / onceki) * 100) : null);

/** İşletme analizi: kendi kayıtlarından ay sonucu, dikkat noktaları ve en çok kazandıran rotalar. */
export default async function AnalizSayfasi({ searchParams }: { searchParams: Promise<{ ay?: string }> }) {
  const { yil, ay } = ayParametresiOku((await searchParams).ay);
  const { bas, son } = ayAraligi(yil, ay);
  const onceki = new Date(yil, ay - 2, 1);
  const sonraki = new Date(yil, ay, 1);
  const o = ayAraligi(onceki.getFullYear(), onceki.getMonth() + 1);
  const anahtar = ayParametresi(yil, ay);

  const [yukler, giderler, oncekiYakit, acikYukler] = await Promise.all([
    prisma.yuk.findMany({ where: { tarih: { gte: bas, lt: son } }, select: { nereden: true, nereye: true, netTutar: true, toplamTutar: true } }),
    prisma.gider.findMany({ where: { tarih: { gte: bas, lt: son } }, select: { kategori: true, netTutar: true, toplamTutar: true } }),
    prisma.gider.aggregate({ where: { tarih: { gte: o.bas, lt: o.son }, kategori: "YAKIT" }, _sum: { toplamTutar: true } }),
    prisma.yuk.findMany({ where: { odemeDurumu: { not: "ODENDI" } }, select: { toplamTutar: true, odemeler: { select: { tutar: true } } } }),
  ]);

  const gelirNet = yukler.reduce((t, y) => t + y.netTutar, 0);
  const giderNet = giderler.filter((g) => isletmeGideriMi(g.kategori)).reduce((t, g) => t + g.netTutar, 0);
  const sonuc = gelirNet - giderNet;
  const alacak = acikYukler.reduce((t, y) => t + Math.max(0, y.toplamTutar - y.odemeler.reduce((a, p) => a + p.tutar, 0)), 0);
  const alacakAdet = acikYukler.filter((y) => y.toplamTutar - y.odemeler.reduce((a, p) => a + p.tutar, 0) > 0).length;
  const yakit = giderler.filter((g) => g.kategori === "YAKIT").reduce((t, g) => t + g.toplamTutar, 0);
  const yakitDegisim = degisim(yakit, oncekiYakit._sum.toplamTutar ?? 0);

  const rotaMap = new Map<string, { ad: string; tutar: number; adet: number }>();
  for (const y of yukler) {
    const ad = `${y.nereden} → ${y.nereye}`;
    const r = rotaMap.get(ad) ?? { ad, tutar: 0, adet: 0 };
    r.tutar += y.toplamTutar;
    r.adet += 1;
    rotaMap.set(ad, r);
  }
  const rotalar = [...rotaMap.values()].sort((a, b) => b.tutar - a.tutar).slice(0, 5);
  const enBuyukRota = Math.max(1, ...rotalar.map((r) => r.tutar));

  const notlar: { baslik: string; metin: string; href: string; ton: string }[] = [];
  if (yakitDegisim !== null && yakitDegisim >= 10) {
    notlar.push({ baslik: "Yakıt giderlerini incele", metin: `Bu ayki yakıt giderlerin geçen aya göre %${yakitDegisim} daha yüksek.`, href: "/giderler", ton: "ana-ton-kirmizi" });
  }
  if (alacak > 0) {
    notlar.push({ baslik: "Tahsilatları takip et", metin: `${alacakAdet} seferde toplam ${tlYazKisa(alacak)} bekleyen alacak var.`, href: "/para?sekme=cari", ton: "ana-ton-indigo" });
  }
  if (yukler.length === 0) notlar.push({ baslik: "Bu ay sefer yok", metin: "Sefer ekledikçe ay sonucu ve rotalar burada oluşur.", href: "/yukler/yeni", ton: "ana-ton-gri" });

  return (
    <div className={`ana ${anaYazi.variable}`}>
      <HareketKok>
        <RaporUst
          geriHref="/ozet"
          donem={{ etiket: ayEtiketi(yil, ay), oncekiHref: `/analiz?ay=${ayParametresi(onceki.getFullYear(), onceki.getMonth() + 1)}`, sonrakiHref: `/analiz?ay=${ayParametresi(sonraki.getFullYear(), sonraki.getMonth() + 1)}` }}
          gorsel={{ src: "/ana/analiz.webp", genislik: 150 }}
        >
          <div className="max-w-[62%]">
            <h1 className="text-[1.6rem] font-extrabold leading-tight tracking-[-0.03em] text-white">İşletme analizim</h1>
            <p className="text-[13px] text-[#c7cffd]">Kendi kayıtlarına göre</p>
            <p className="mt-3 text-[14px] font-semibold text-[#dfe4ff]">Net sonuç</p>
          </div>
          <p key={anahtar} className={`ana-tutar text-[2.4rem] font-extrabold leading-none tracking-[-0.035em] ${sonuc < 0 ? "text-[#fca5a5]" : "text-white"}`}>
            {tlYazKisa(sonuc)}
          </p>
          <p className="mt-1.5 text-[12px] text-[#9aa6e8]">KDV hariç · demirbaş hariç</p>
        </RaporUst>

        <DonemGecis key={anahtar} className="ana-ic relative z-10 -mt-10 space-y-6 pb-8">
          <ul className="rp-kart px-3 py-1">
            {[
              { ad: "Net gelir", t: gelirNet, s: "" },
              { ad: "Net gider", t: giderNet, s: "text-[#dc2626]" },
              { ad: "Bekleyen alacak", t: alacak, s: "" },
            ].map((r) => (
              <li key={r.ad} className="flex items-center justify-between border-b border-[var(--a-cizgi)] py-3 last:border-0">
                <span className="text-[15px] font-semibold">{r.ad}</span>
                <span className={`text-[16px] font-extrabold tabular-nums ${r.s}`}>{tlYazKisa(r.t)}</span>
              </li>
            ))}
          </ul>

          {notlar.length > 0 && (
            <section aria-labelledby="degerlendirme">
              <h2 id="degerlendirme" className="ana-baslik px-1">
                Dikkat noktaları
              </h2>
              <ul className="mt-2 space-y-2.5">
                {notlar.map((n) => (
                  <li key={n.baslik}>
                    <Link href={n.href} className="rp-kart flex items-center gap-3 px-4 py-3.5">
                      <span className={`ana-mini-ikon rp-ikon ${n.ton}`} aria-hidden>
                        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
                          <path d="M12 8v5M12 16h.01M4 12a8 8 0 1 0 16 0 8 8 0 0 0-16 0" />
                        </svg>
                      </span>
                      <span className="min-w-0 flex-1">
                        <span className="block text-[14.5px] font-extrabold">{n.baslik}</span>
                        <span className="block text-[12.5px] text-[var(--a-ikincil)]">{n.metin}</span>
                      </span>
                      <span className="text-[20px] text-[var(--a-ikincil)]" aria-hidden>
                        ›
                      </span>
                    </Link>
                  </li>
                ))}
              </ul>
              <p className="rp-not mt-2">Bu notlar kayıtlarından kurallarla çıkarılır; AI kullanılmaz.</p>
            </section>
          )}

          <section aria-labelledby="rotalar">
            <h2 id="rotalar" className="ana-baslik px-1">
              En çok ciro yapan rotalar <span className="text-[13px] font-semibold text-[var(--a-ikincil)]">· KDV dahil</span>
            </h2>
            {rotalar.length === 0 ? (
              <p className="rp-bos mt-2">Bu ay sefer yok.</p>
            ) : (
              <ol className="mt-2">
                {rotalar.map((r, i) => (
                  <li key={r.ad} className="flex items-center gap-3 border-b border-[var(--a-cizgi)] py-2.5 last:border-0">
                    <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-[#eef0ff] text-[13px] font-extrabold text-[#3730a3]">{i + 1}</span>
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-[14.5px] font-bold">{r.ad}</span>
                      <span className="flex items-center gap-2">
                        <YatayCubuk oran={r.tutar / enBuyukRota} renk="bg-gradient-to-r from-[#8ea2ff] to-[#4f46e5]" gecikme={i * 0.05} />
                        <span className="shrink-0 text-[11.5px] text-[var(--a-ikincil)]">{r.adet} sefer</span>
                      </span>
                    </span>
                    <span className="shrink-0 text-[15px] font-extrabold tabular-nums">{tlYazKisa(r.tutar)}</span>
                  </li>
                ))}
              </ol>
            )}
          </section>

          <Link href={`/raporlar?ay=${anahtar}`} className="ana-ana-dugme w-full !min-h-[3.2rem]">
            Raporlara git
          </Link>
        </DonemGecis>
      </HareketKok>
    </div>
  );
}
