import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { tlYazKisa, tarihYaz } from "@/lib/para";
import { kategoriAdi } from "@/lib/sabitler";
import AraButonu from "@/components/AraButonu";
import WhatsAppButonu from "@/components/WhatsAppButonu";
import TelefonTuslari from "@/components/TelefonTuslari";
import YolculukKarti from "@/components/YolculukKarti";
import FinansKartlari from "@/components/finans/FinansKartlari";
import Yaklasanlar from "@/components/Yaklasanlar";
import { pushAcikAnahtar } from "@/lib/bildirim/push";

export const dynamic = "force-dynamic";

function selamlama(simdi: Date): string {
  const saat = (simdi.getUTCHours() + 3) % 24;
  if (saat >= 5 && saat < 11) return "Günaydın";
  if (saat >= 11 && saat < 17) return "İyi günler";
  if (saat >= 17 && saat < 22) return "İyi akşamlar";
  return "İyi geceler";
}

const ikon = {
  kar: (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M3 17l6-6 4 4 8-8" />
      <path d="M14 7h7v7" />
    </svg>
  ),
  gelir: (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinejoin="round">
      <path d="M1 9h12v7H1z" />
      <path d="M13 12h4l3 3v1h-7z" />
      <circle cx="6" cy="18.5" r="1.5" />
      <circle cx="17" cy="18.5" r="1.5" />
    </svg>
  ),
  gider: (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M7 3h10v18l-2-1.4L13 21l-2-1.4L9 21l-2-1.4L5 21z" />
      <path d="M9 8h6M9 12h6" />
    </svg>
  ),
  alacak: (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round">
      <circle cx="12" cy="12" r="9" />
      <path d="M12 7v5l3 2" />
    </svg>
  ),
  ara: (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round">
      <circle cx="11" cy="11" r="6.5" />
      <path d="M16 16l4.5 4.5" />
    </svg>
  ),
  kamera: (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinejoin="round">
      <path d="M4 8h3l2-3h6l2 3h3v11H4z" />
      <circle cx="12" cy="13" r="3.5" />
    </svg>
  ),
  cuzdan: (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2">
      <rect x="3" y="6" width="18" height="13" rx="2" />
      <path d="M3 10h18" />
    </svg>
  ),
};

export default async function PanelSayfasi() {
  const simdi = new Date();
  const [yukler, giderler, bekleyenYukler, kasaToplam, yeniIlan] = await Promise.all([
    prisma.yuk.findMany({
      select: {
        id: true,
        tarih: true,
        nereden: true,
        nereye: true,
        toplamTutar: true,
        odemeDurumu: true,
        firma: { select: { ad: true } },
      },
      orderBy: { tarih: "desc" },
      take: 6,
    }),
    prisma.gider.findMany({
      select: { id: true, tarih: true, kategori: true, aciklama: true, toplamTutar: true },
      orderBy: { tarih: "desc" },
      take: 6,
    }),
    prisma.yuk.findMany({
      where: { odemeDurumu: { not: "ODENDI" } },
      select: {
        firmaId: true,
        toplamTutar: true,
        odemeler: { select: { tutar: true } },
        firma: { select: { ad: true, telefon: true } },
      },
    }),
    prisma.kasaHareket.groupBy({ by: ["tip"], _sum: { tutar: true } }),
    prisma.yukIlani.count({
      where: {
        durum: "YENI",
        sonGorulme: { gte: new Date(simdi.getTime() - 2 * 24 * 60 * 60 * 1000) },
      },
    }),
  ]);

  const kasaBakiye = kasaToplam.reduce(
    (t, h) => (h.tip === "GIRIS" ? t + (h._sum.tutar ?? 0) : t - (h._sum.tutar ?? 0)),
    0
  );

  const firmaAlacakMap = new Map<number, { id: number; ad: string; kalan: number; telefon: string | null }>();
  for (const y of bekleyenYukler) {
    const kalan = Math.max(0, y.toplamTutar - y.odemeler.reduce((o, p) => o + p.tutar, 0));
    if (kalan <= 0) continue;
    const onceki = firmaAlacakMap.get(y.firmaId);
    if (onceki) onceki.kalan += kalan;
    else firmaAlacakMap.set(y.firmaId, { id: y.firmaId, ad: y.firma.ad, kalan, telefon: y.firma.telefon });
  }
  const firmaAlacaklari = [...firmaAlacakMap.values()].sort((a, b) => b.kalan - a.kalan).slice(0, 4);

  const hareketler = [
    ...yukler.slice(0, 8).map((y) => ({
      anahtar: `y${y.id}`,
      href: `/yukler/${y.id}/duzenle`,
      baslik: `${y.nereden} → ${y.nereye}`,
      alt: y.firma.ad,
      tarih: y.tarih,
      tutar: y.toplamTutar,
      gelir: true,
      durum: y.odemeDurumu,
    })),
    ...giderler.slice(0, 8).map((g) => ({
      anahtar: `g${g.id}`,
      href: `/giderler/${g.id}/duzenle`,
      baslik: kategoriAdi(g.kategori),
      alt: g.aciklama || "Gider",
      tarih: g.tarih,
      tutar: g.toplamTutar,
      gelir: false,
      durum: null as string | null,
    })),
  ]
    .sort((a, b) => b.tarih.getTime() - a.tarih.getTime())
    .slice(0, 6);

  const ayAdi = new Intl.DateTimeFormat("tr-TR", { month: "long", year: "numeric" }).format(simdi);

  const kisayollar = [
    { href: "/ai/yukler", ad: "Yük bul", alt: yeniIlan > 0 ? `${yeniIlan} yeni ilan` : "İlanları tara", renk: "ikon-turuncu", ikon: ikon.ara },
    { href: "/yukler/yeni", ad: "Sefer yaz", alt: "Yükü kaydet", renk: "ikon-yesil", ikon: ikon.gelir },
    { href: "/giderler/yeni", ad: "Fiş çek", alt: "Yakıt, bakım", renk: "ikon-pembe", ikon: ikon.kamera },
    { href: "/para", ad: "Kasa", alt: tlYazKisa(kasaBakiye), renk: "ikon-mavi", ikon: ikon.cuzdan },
  ];

  return (
    <div className="space-y-4 sm:space-y-5">
      <header className="flex flex-wrap items-end justify-between gap-3 pt-1 reveal">
        <div>
          <h1 className="font-display text-[1.9rem] font-bold leading-tight sm:text-[2.4rem]">
            {selamlama(simdi)} <span className="inline-block origin-[70%_70%] animate-[el-salla_1.6s_ease-in-out_0.4s_2]">👋</span>
          </h1>
          <p className="mt-0.5 text-[15px] text-fog">{ayAdi}</p>
        </div>
      </header>

      <section className="grid grid-cols-2 gap-2.5 sm:gap-3 lg:grid-cols-4 reveal reveal-d1">
        {kisayollar.map((k) => (
          <Link key={k.href} href={k.href} className="kart flex items-center gap-3 p-3.5">
            <span className={`ikon-kare ${k.renk} !h-10 !w-10`}>{k.ikon}</span>
            <span className="min-w-0 flex-1">
              <span className="block text-[15px] font-semibold">{k.ad}</span>
              <span className="block truncate text-[12.5px] text-fog">{k.alt}</span>
            </span>
          </Link>
        ))}
      </section>

      <Yaklasanlar />

      <YolculukKarti />

      <FinansKartlari />

      <div className="grid gap-4 lg:grid-cols-[1fr_20rem]">
        <section className="kart p-4 reveal reveal-d5 sm:p-5">
          <div className="flex items-center justify-between">
            <p className="text-[17px] font-semibold">Son hareketler</p>
            <div className="flex gap-1.5">
              <Link href="/yukler" className="sekme-oge !py-1.5 text-[13px]">Seferler</Link>
              <Link href="/giderler" className="sekme-oge !py-1.5 text-[13px]">Giderler</Link>
            </div>
          </div>
          {hareketler.length === 0 ? (
            <p className="py-8 text-center text-fog">Henüz kayıt yok. İlk seferini ekle.</p>
          ) : (
            <ul className="mt-2">
              {hareketler.map((h) => (
                <li key={h.anahtar} className="border-b border-white/[0.06] last:border-0">
                  <Link href={h.href} className="dokun -mx-2 flex items-center gap-3 rounded-xl px-2 py-2.5">
                    <span className={`ikon-kare !h-10 !w-10 !rounded-full ${h.gelir ? "ikon-yesil" : "ikon-pembe"} !shadow-none`}>
                      {h.gelir ? ikon.gelir : ikon.gider}
                    </span>
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-[15px] font-medium">{h.baslik}</span>
                      <span className="block truncate text-[12.5px] text-fog">
                        {tarihYaz(h.tarih)} · {h.alt}
                      </span>
                    </span>
                    <span className="text-right">
                      <span className={`block font-display text-[15px] font-semibold tabular-nums ${h.gelir ? "text-ok" : ""}`}>
                        {h.gelir ? "+" : "−"}
                        {tlYazKisa(h.tutar)}
                      </span>
                      {h.durum && (
                        <span
                          className={`rozet mt-0.5 !px-2 !py-0 !text-[11px] ${
                            h.durum === "ODENDI" ? "rozet-odendi" : h.durum === "KISMI" ? "rozet-kismi" : "rozet-bekliyor"
                          }`}
                        >
                          {h.durum === "ODENDI" ? "Ödendi" : h.durum === "KISMI" ? "Kısmi" : "Bekliyor"}
                        </span>
                      )}
                    </span>
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </section>

        <div className="space-y-4">
          {firmaAlacaklari.length > 0 && (
            <section className="kart p-4 reveal reveal-d5 sm:p-5">
              <div className="flex items-center justify-between">
                <p className="text-[17px] font-semibold">Kimde para kaldı?</p>
                <Link href="/para?sekme=cari" className="text-[15px] text-amber">
                  Tümü
                </Link>
              </div>
              <ul className="mt-2">
                {firmaAlacaklari.map((f) => (
                  <li key={f.id} className="flex items-center justify-between gap-2 border-b border-white/[0.06] py-2.5 last:border-0">
                    <Link href={`/firmalar/${f.id}`} className="min-w-0 flex-1 truncate text-[15px] font-medium">
                      {f.ad}
                    </Link>
                    {f.telefon && (
                      <>
                        <WhatsAppButonu telefon={f.telefon} />
                        <AraButonu telefon={f.telefon} etiket="Ara" />
                      </>
                    )}
                    <span className="font-display text-[15px] font-semibold tabular-nums text-amber">
                      {tlYazKisa(f.kalan)}
                    </span>
                  </li>
                ))}
              </ul>
            </section>
          )}

        </div>
      </div>

      <TelefonTuslari acikAnahtar={pushAcikAnahtar()} />
    </div>
  );
}
