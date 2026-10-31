import Link from "next/link";
import type { ReactNode } from "react";
import { prisma } from "@/lib/prisma";
import { tlYaz, tlYazKisa, tarihYaz } from "@/lib/para";
import { isletmeGideriMi, kategoriAdi } from "@/lib/sabitler";
import { telefonGoster } from "@/lib/telefon";
import AraButonu from "@/components/AraButonu";
import WhatsAppButonu from "@/components/WhatsAppButonu";
import TelefonTuslari from "@/components/TelefonTuslari";
import YolculukKarti from "@/components/YolculukKarti";
import AracKmKarti from "@/components/AracKmKarti";
import BelgeKarti from "@/components/BelgeKarti";
import { pushAcikAnahtar } from "@/lib/bildirim/push";
import { ayParametresi } from "@/lib/kdv";
import AylikGrafik, { type AyVerisi } from "@/components/panel/AylikGrafik";

export const dynamic = "force-dynamic";

const AY_SAYISI = 12;

function selamlama(simdi: Date): string {
  const saat = (simdi.getUTCHours() + 3) % 24;
  if (saat >= 5 && saat < 11) return "Günaydın";
  if (saat >= 11 && saat < 17) return "İyi günler";
  if (saat >= 17 && saat < 22) return "İyi akşamlar";
  return "İyi geceler";
}

/** Geçen aya göre yüzde değişim; geçen ay 0 ise null. */
function degisim(bu: number, onceki: number): number | null {
  if (!onceki) return null;
  return Math.round(((bu - onceki) / Math.abs(onceki)) * 100);
}

function Trend({ yuzde, tersIyi = false }: { yuzde: number | null; tersIyi?: boolean }) {
  if (yuzde === null) return <span className="trend trend-notr">yeni</span>;
  const iyi = tersIyi ? yuzde <= 0 : yuzde >= 0;
  return (
    <span className={`trend ${yuzde === 0 ? "trend-notr" : iyi ? "trend-iyi" : "trend-kotu"}`}>
      {yuzde > 0 ? "↑" : yuzde < 0 ? "↓" : "•"} {Math.abs(yuzde)}%
    </span>
  );
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

function OkIkon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.6" strokeLinecap="round" strokeLinejoin="round" className="h-4 w-4">
      <path d="M7 17 17 7M8 7h9v9" />
    </svg>
  );
}

export default async function PanelSayfasi() {
  const simdi = new Date();
  const ayBasi = new Date(simdi.getFullYear(), simdi.getMonth(), 1);
  const gecenAyBasi = new Date(simdi.getFullYear(), simdi.getMonth() - 1, 1);
  const sonrakiAyBasi = new Date(simdi.getFullYear(), simdi.getMonth() + 1, 1);
  const grafikBasi = new Date(simdi.getFullYear(), simdi.getMonth() - (AY_SAYISI - 1), 1);

  const [yukler, giderler, bekleyenYukler, ayarlar, kasaToplam, yeniIlan, tumYuk, tumGider] = await Promise.all([
    prisma.yuk.findMany({
      where: { tarih: { gte: grafikBasi, lt: sonrakiAyBasi } },
      select: {
        id: true,
        tarih: true,
        nereden: true,
        nereye: true,
        netTutar: true,
        toplamTutar: true,
        odemeDurumu: true,
        firma: { select: { ad: true } },
      },
      orderBy: { tarih: "desc" },
    }),
    prisma.gider.findMany({
      where: { tarih: { gte: grafikBasi, lt: sonrakiAyBasi } },
      select: { id: true, tarih: true, kategori: true, aciklama: true, netTutar: true, toplamTutar: true },
      orderBy: { tarih: "desc" },
    }),
    prisma.yuk.findMany({
      where: { odemeDurumu: { not: "ODENDI" } },
      select: {
        id: true,
        firmaId: true,
        toplamTutar: true,
        odemeler: { select: { tutar: true } },
        firma: { select: { ad: true, telefon: true } },
      },
    }),
    prisma.ayar.findMany({
      where: { anahtar: { in: ["hizli_ara_telefon", "muhasebeci_telefon"] } },
    }),
    prisma.kasaHareket.groupBy({ by: ["tip"], _sum: { tutar: true } }),
    prisma.yukIlani.count({
      where: {
        durum: "YENI",
        sonGorulme: { gte: new Date(simdi.getTime() - 2 * 24 * 60 * 60 * 1000) },
      },
    }),
    prisma.yuk.aggregate({ _sum: { toplamTutar: true, kdvTutar: true } }),
    prisma.gider.aggregate({ _sum: { toplamTutar: true, kdvTutar: true } }),
  ]);

  const ayarDeger = (a: string) => ayarlar.find((x) => x.anahtar === a)?.deger || "";
  const hizliAraTel = ayarDeger("hizli_ara_telefon");
  const muhasebeciTel = ayarDeger("muhasebeci_telefon");

  const kasaBakiye = kasaToplam.reduce(
    (t, h) => (h.tip === "GIRIS" ? t + (h._sum.tutar ?? 0) : t - (h._sum.tutar ?? 0)),
    0
  );

  const isletmeGiderleri = giderler.filter((g) => isletmeGideriMi(g.kategori));
  const aralikta = <T extends { tarih: Date }>(liste: T[], bas: Date, son: Date) =>
    liste.filter((x) => x.tarih >= bas && x.tarih < son);

  const buAyYuk = aralikta(yukler, ayBasi, sonrakiAyBasi);
  const gecenAyYuk = aralikta(yukler, gecenAyBasi, ayBasi);
  const buAyGider = aralikta(isletmeGiderleri, ayBasi, sonrakiAyBasi);
  const gecenAyGider = aralikta(isletmeGiderleri, gecenAyBasi, ayBasi);

  const topla = (l: { toplamTutar: number }[]) => l.reduce((t, x) => t + x.toplamTutar, 0);
  const net = (l: { netTutar: number }[]) => l.reduce((t, x) => t + x.netTutar, 0);

  const gelirToplam = topla(buAyYuk);
  const giderToplam = topla(buAyGider);
  const netKar = net(buAyYuk) - net(buAyGider);
  const gecenNetKar = net(gecenAyYuk) - net(gecenAyGider);

  let bekleyenAlacak = 0;
  const yukKalan = new Map<number, number>();
  const firmaAlacakMap = new Map<number, { id: number; ad: string; kalan: number; telefon: string | null }>();
  for (const y of bekleyenYukler) {
    const kalan = Math.max(0, y.toplamTutar - y.odemeler.reduce((o, p) => o + p.tutar, 0));
    if (kalan <= 0) continue;
    yukKalan.set(y.id, kalan);
    bekleyenAlacak += kalan;
    const onceki = firmaAlacakMap.get(y.firmaId);
    if (onceki) onceki.kalan += kalan;
    else firmaAlacakMap.set(y.firmaId, { id: y.firmaId, ad: y.firma.ad, kalan, telefon: y.firma.telefon });
  }
  const firmaAlacaklari = [...firmaAlacakMap.values()].sort((a, b) => b.kalan - a.kalan).slice(0, 4);

  const ayEtiket = new Intl.DateTimeFormat("tr-TR", { month: "short" });
  const aylar: AyVerisi[] = Array.from({ length: AY_SAYISI }, (_, i) => {
    const bas = new Date(grafikBasi.getFullYear(), grafikBasi.getMonth() + i, 1);
    const son = new Date(bas.getFullYear(), bas.getMonth() + 1, 1);
    return {
      etiket: ayEtiket.format(bas).replace(".", ""),
      gelir: topla(aralikta(yukler, bas, son)) / 100,
      gider: topla(aralikta(isletmeGiderleri, bas, son)) / 100,
    };
  });

  const buAyTahsil = buAyYuk.reduce((t, y) => t + y.toplamTutar - (yukKalan.get(y.id) ?? 0), 0);
  const tahsilOrani = gelirToplam > 0 ? Math.round((buAyTahsil / gelirToplam) * 100) : 0;

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

  const kpiler: {
    etiket: string;
    deger: number;
    renk: string;
    ikon: ReactNode;
    href: string;
    trend: ReactNode;
    ton?: string;
  }[] = [
    {
      etiket: "Net kâr (KDV hariç)",
      deger: netKar,
      renk: "ikon-mor",
      ikon: ikon.kar,
      href: "/raporlar",
      trend: <Trend yuzde={degisim(netKar, gecenNetKar)} />,
      ton: netKar >= 0 ? "" : "text-ember",
    },
    {
      etiket: "Bu ay gelir",
      deger: gelirToplam,
      renk: "ikon-turuncu",
      ikon: ikon.gelir,
      href: "/yukler",
      trend: <Trend yuzde={degisim(gelirToplam, topla(gecenAyYuk))} />,
    },
    {
      etiket: "Bu ay gider",
      deger: giderToplam,
      renk: "ikon-pembe",
      ikon: ikon.gider,
      href: "/giderler",
      trend: <Trend yuzde={degisim(giderToplam, topla(gecenAyGider))} tersIyi />,
    },
    {
      etiket: "Açık alacak",
      deger: bekleyenAlacak,
      renk: "ikon-mavi",
      ikon: ikon.alacak,
      href: "/para?sekme=cari",
      trend: (
        <span className={`trend ${bekleyenAlacak > 0 ? "trend-kotu" : "trend-iyi"}`}>
          {firmaAlacakMap.size} firma
        </span>
      ),
    },
  ];

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
          <p className="mt-0.5 text-[15px] text-fog">İşte {ayAdi} özetin ve son hareketlerin.</p>
        </div>
        <div className="flex gap-2">
          <a
            href={`/api/excel?ay=${ayParametresi(simdi.getFullYear(), simdi.getMonth() + 1)}`}
            className="btn btn-teal !min-h-9 !px-3.5 text-sm"
          >
            Excel
          </a>
          <Link href="/raporlar" className="btn btn-ghost !min-h-9 !px-3.5 text-sm">
            Raporlar
          </Link>
          <Link href="/kdv" className="btn btn-ghost !min-h-9 !px-3.5 text-sm">
            KDV
          </Link>
        </div>
      </header>

      <YolculukKarti />

      <AracKmKarti />

      <BelgeKarti />

      <TelefonTuslari
        acikAnahtar={pushAcikAnahtar()}
        excelHref={`/api/excel?ay=${ayParametresi(simdi.getFullYear(), simdi.getMonth() + 1)}`}
      />

      <section className="kart grid grid-cols-3 gap-3 p-3.5 sm:p-4">
        <Link href="/yukler" className="min-w-0">
          <p className="text-[11px] font-bold uppercase tracking-wider text-fog">Bugüne kadar gelir</p>
          <p className="mt-1 font-display text-lg font-bold tabular-nums sm:text-xl">
            {tlYazKisa(tumYuk._sum.toplamTutar ?? 0)}
          </p>
        </Link>
        <Link href="/giderler" className="min-w-0">
          <p className="text-[11px] font-bold uppercase tracking-wider text-fog">Bugüne kadar gider</p>
          <p className="mt-1 font-display text-lg font-bold tabular-nums text-ember sm:text-xl">
            {tlYazKisa(tumGider._sum.toplamTutar ?? 0)}
          </p>
        </Link>
        <Link href="/kdv" className="min-w-0">
          <p className="text-[11px] font-bold uppercase tracking-wider text-fog">Bugüne kadar KDV</p>
          <p className="mt-1 font-display text-lg font-bold tabular-nums text-amber sm:text-xl">
            {tlYazKisa((tumYuk._sum.kdvTutar ?? 0) - (tumGider._sum.kdvTutar ?? 0))}
          </p>
        </Link>
      </section>

      <section className="grid grid-cols-2 gap-2.5 sm:gap-3 lg:grid-cols-4">
        {kpiler.map((k, i) => (
          <Link key={k.etiket} href={k.href} className={`kart p-3.5 sm:p-4 reveal reveal-d${i + 1}`}>
            <div className="flex items-start justify-between gap-2">
              <span className={`ikon-kare ${k.renk}`}>{k.ikon}</span>
              {k.trend}
            </div>
            <p className={`mt-3 font-display text-[1.2rem] font-bold leading-tight tabular-nums sm:text-[1.45rem] ${k.ton || ""}`}>
              <span className="sayi-gir" style={{ animationDelay: `${0.1 + i * 0.06}s` }}>
                {tlYazKisa(k.deger)}
              </span>
            </p>
            <p className="mt-0.5 text-[13px] text-fog">{k.etiket}</p>
          </Link>
        ))}
      </section>

      <div className="grid gap-4 lg:grid-cols-[1fr_20rem]">
        <section className="kart p-4 reveal reveal-d3 sm:p-5">
          <AylikGrafik aylar={aylar} />
        </section>

        <section className="kart flex flex-col gap-4 p-4 reveal reveal-d4 sm:p-5">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-[15px] font-semibold">Kasam</p>
              <p className="text-[13px] text-fog">Nakit ve tahsilat</p>
            </div>
            <Link href="/para" className="ok-dugme" aria-label="Kasa ve cari">
              <OkIkon />
            </Link>
          </div>
          <Link href="/para" className="kasa-karti block">
            <div className="relative z-10 flex items-center justify-between">
              <span className="rounded-full bg-white/20 px-2.5 py-0.5 text-[12px] font-semibold backdrop-blur">
                ● Aktif
              </span>
              <span className="flex">
                <span className="h-6 w-6 rounded-full bg-[#ff5f57]/90" />
                <span className="-ml-2.5 h-6 w-6 rounded-full bg-[#ffbd2e]/90" />
              </span>
            </div>
            <p className="relative z-10 mt-6 text-[12px] uppercase tracking-wider text-white/70">Kasa bakiyesi</p>
            <p className="relative z-10 font-display text-[1.75rem] font-bold tabular-nums">{tlYaz(kasaBakiye)}</p>
            <div className="relative z-10 mt-3 flex justify-between text-[12px] text-white/75">
              <span>Nakliye Defteri</span>
              <span>{ayAdi}</span>
            </div>
          </Link>
          <div>
            <p className="text-[13px] text-fog">Bu ay tahsilat</p>
            <p className="mt-0.5 font-display text-xl font-bold tabular-nums">
              {tlYazKisa(buAyTahsil)}
              <span className="ml-1.5 text-[13px] font-normal text-fog">/ {tlYazKisa(gelirToplam)}</span>
            </p>
            <div className="ilerleme mt-2">
              <span style={{ width: `${Math.min(100, tahsilOrani)}%` }} />
            </div>
          </div>
        </section>
      </div>

      <section className="grid grid-cols-2 gap-2.5 sm:gap-3 lg:grid-cols-4 reveal reveal-d4">
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

          <section className="kart space-y-3 p-4 reveal reveal-d6 sm:p-5">
            <div className="flex items-center justify-between">
              <p className="text-[17px] font-semibold">Hızlı ara</p>
              <Link href="/ayarlar" className="text-[15px] text-amber">
                Ayarla
              </Link>
            </div>
            <div className="flex flex-wrap gap-2">
              {hizliAraTel ? (
                <AraButonu telefon={hizliAraTel} etiket={telefonGoster(hizliAraTel)} buyuk />
              ) : (
                <Link href="/ayarlar" className="btn btn-ghost text-sm">
                  Numara kaydet
                </Link>
              )}
              {muhasebeciTel && (
                <AraButonu telefon={muhasebeciTel} etiket={`Muhasebeci · ${telefonGoster(muhasebeciTel)}`} buyuk />
              )}
            </div>
          </section>
        </div>
      </div>

    </div>
  );
}
