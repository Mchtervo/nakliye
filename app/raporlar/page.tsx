import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { tlYaz } from "@/lib/para";
import { kategoriAdi, GIDER_KATEGORILERI, isletmeGideriMi } from "@/lib/sabitler";
import { ayAraligi } from "@/lib/tarih";

export const dynamic = "force-dynamic";

function ayEtiket(yil: number, ay: number): string {
  return new Intl.DateTimeFormat("tr-TR", {
    month: "long",
    year: "numeric",
  }).format(new Date(yil, ay - 1, 1));
}

function Bar({
  deger,
  max,
  renk,
}: {
  deger: number;
  max: number;
  renk: string;
}) {
  const yuzde = max > 0 ? Math.min(100, Math.round((deger / max) * 100)) : 0;
  return (
    <div className="h-2.5 w-full overflow-hidden rounded-full bg-white/8">
      <div
        className={`bar-anim h-full rounded-full ${renk}`}
        style={{ width: `${yuzde}%` }}
      />
    </div>
  );
}

export default async function RaporlarSayfasi({
  searchParams,
}: {
  searchParams: Promise<{ ay?: string }>;
}) {
  const sp = await searchParams;
  const simdi = new Date();
  let yil = simdi.getFullYear();
  let ay = simdi.getMonth() + 1;

  if (sp.ay && /^\d{4}-\d{2}$/.test(sp.ay)) {
    const [y, a] = sp.ay.split("-").map(Number);
    if (a >= 1 && a <= 12) {
      yil = y;
      ay = a;
    }
  }

  const { bas, son } = ayAraligi(yil, ay);
  const onceki = new Date(yil, ay - 2, 1);
  const sonraki = new Date(yil, ay, 1);
  const oncekiAy = `${onceki.getFullYear()}-${String(onceki.getMonth() + 1).padStart(2, "0")}`;
  const sonrakiAy = `${sonraki.getFullYear()}-${String(sonraki.getMonth() + 1).padStart(2, "0")}`;

  const [yukler, giderler] = await Promise.all([
    prisma.yuk.findMany({
      where: { tarih: { gte: bas, lt: son } },
      include: { firma: true, odemeler: true },
    }),
    prisma.gider.findMany({
      where: { tarih: { gte: bas, lt: son } },
    }),
  ]);

  const gelirToplam = yukler.reduce((t, y) => t + y.toplamTutar, 0);
  const gelirNet = yukler.reduce((t, y) => t + y.netTutar, 0);
  const toplananKdv = yukler.reduce((t, y) => t + y.kdvTutar, 0);
  const isletmeGiderleri = giderler.filter((g) => isletmeGideriMi(g.kategori));
  const giderToplam = isletmeGiderleri.reduce((t, g) => t + g.toplamTutar, 0);
  const giderNet = isletmeGiderleri.reduce((t, g) => t + g.netTutar, 0);
  const odenenKdv = giderler.reduce((t, g) => t + g.kdvTutar, 0);
  const demirbasKdv = giderler
    .filter((g) => g.kategori === "DEMIRBAS")
    .reduce((t, g) => t + g.kdvTutar, 0);
  const netKar = gelirNet - giderNet;
  const maxGelirGider = Math.max(gelirToplam, giderToplam, 1);

  // Firma bazlı ciro
  const firmaMap = new Map<string, number>();
  for (const y of yukler) {
    firmaMap.set(y.firma.ad, (firmaMap.get(y.firma.ad) || 0) + y.toplamTutar);
  }
  const firmaSirasi = [...firmaMap.entries()]
    .map(([ad, tutar]) => ({ ad, tutar }))
    .sort((a, b) => b.tutar - a.tutar);
  const maxFirma = firmaSirasi[0]?.tutar || 1;

  // Kategori bazlı gider (demirbaş ayrı satırda kalabilir)
  const katMap = new Map<string, number>();
  for (const g of giderler) {
    katMap.set(g.kategori, (katMap.get(g.kategori) || 0) + g.toplamTutar);
  }
  const katSirasi = GIDER_KATEGORILERI.map((k) => ({
    kod: k.kod,
    ad: k.ad,
    tutar: katMap.get(k.kod) || 0,
  }))
    .filter((k) => k.tutar > 0)
    .sort((a, b) => b.tutar - a.tutar);
  const maxKat = katSirasi[0]?.tutar || 1;

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-end justify-between gap-3 reveal">
        <div>
          <p className="text-[11px] font-bold uppercase tracking-[0.18em] text-amber">
            Analiz
          </p>
          <h1 className="font-display text-3xl font-extrabold text-paper sm:text-4xl">
            Raporlar
          </h1>
          <p className="mt-1 text-sm text-fog">Aylık gelir, gider ve KDV özeti</p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <a
            href={`/api/excel?ay=${yil}-${String(ay).padStart(2, "0")}`}
            className="btn btn-teal !px-3 !py-2 text-xs sm:text-sm"
          >
            Excel indir
          </a>
          <div className="flex items-center gap-1 rounded-xl border border-white/10 bg-asphalt-2 p-1">
            <Link
              href={`/raporlar?ay=${oncekiAy}`}
              className="rounded-lg px-3 py-1.5 text-sm font-semibold text-fog hover:bg-white/5 hover:text-paper"
            >
              ←
            </Link>
            <span className="min-w-[9rem] text-center text-sm font-bold capitalize text-paper">
              {ayEtiket(yil, ay)}
            </span>
            <Link
              href={`/raporlar?ay=${sonrakiAy}`}
              className="rounded-lg px-3 py-1.5 text-sm font-semibold text-fog hover:bg-white/5 hover:text-paper"
            >
              →
            </Link>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <div className="kart p-4 reveal reveal-d1">
          <div className="text-[11px] font-bold uppercase tracking-wider text-fog">Gelir</div>
          <div className="mt-1 font-display text-xl font-extrabold text-teal">
            {tlYaz(gelirToplam)}
          </div>
          <div className="text-xs text-fog">{yukler.length} yük</div>
        </div>
        <div className="kart p-4 reveal reveal-d2">
          <div className="text-[11px] font-bold uppercase tracking-wider text-fog">Gider</div>
          <div className="mt-1 font-display text-xl font-extrabold text-ember">
            {tlYaz(giderToplam)}
          </div>
          <div className="text-xs text-fog">{giderler.length} kayıt</div>
        </div>
        <div className="kart p-4 reveal reveal-d3">
          <div className="text-[11px] font-bold uppercase tracking-wider text-fog">Net kâr</div>
          <div
            className={`mt-1 font-display text-xl font-extrabold ${
              netKar >= 0 ? "text-teal" : "text-ember"
            }`}
          >
            {tlYaz(netKar)}
          </div>
          <div className="text-xs text-fog">KDV hariç</div>
        </div>
        <div className="kart p-4 reveal reveal-d4">
          <div className="text-[11px] font-bold uppercase tracking-wider text-fog">KDV farkı</div>
          <div className="mt-1 font-display text-xl font-extrabold text-amber">
            {tlYaz(toplananKdv - odenenKdv)}
          </div>
          <div className="text-xs text-fog">
            +{tlYaz(toplananKdv)} / −{tlYaz(odenenKdv)}
          </div>
        </div>
      </div>

      <div className="kart space-y-3 p-4 reveal reveal-d2">
        <h2 className="font-display text-lg font-bold text-paper">Gelir vs Gider</h2>
        <div>
          <div className="mb-1 flex justify-between text-sm">
            <span className="text-fog">Gelir</span>
            <span className="font-semibold text-paper">{tlYaz(gelirToplam)}</span>
          </div>
          <Bar deger={gelirToplam} max={maxGelirGider} renk="bg-teal" />
        </div>
        <div>
          <div className="mb-1 flex justify-between text-sm">
            <span className="text-fog">Gider</span>
            <span className="font-semibold text-paper">{tlYaz(giderToplam)}</span>
          </div>
          <Bar deger={giderToplam} max={maxGelirGider} renk="bg-ember" />
        </div>
      </div>

      <div className="kart space-y-3 p-4 reveal reveal-d3">
        <h2 className="font-display text-lg font-bold text-paper">Firma bazlı ciro</h2>
        {firmaSirasi.length === 0 ? (
          <p className="text-sm text-fog">Bu ay yük yok.</p>
        ) : (
          firmaSirasi.map((f) => (
            <div key={f.ad}>
              <div className="mb-1 flex justify-between text-sm">
                <span className="text-fog">{f.ad}</span>
                <span className="font-semibold text-paper">{tlYaz(f.tutar)}</span>
              </div>
              <Bar deger={f.tutar} max={maxFirma} renk="bg-sky" />
            </div>
          ))
        )}
      </div>

      <div className="kart space-y-3 p-4 reveal reveal-d4">
        <h2 className="font-display text-lg font-bold text-paper">Gider kategorileri</h2>
        {katSirasi.length === 0 ? (
          <p className="text-sm text-fog">Bu ay gider yok.</p>
        ) : (
          katSirasi.map((k) => (
            <div key={k.kod}>
              <div className="mb-1 flex justify-between text-sm">
                <span className="text-fog">{kategoriAdi(k.kod)}</span>
                <span className="font-semibold text-paper">{tlYaz(k.tutar)}</span>
              </div>
              <Bar deger={k.tutar} max={maxKat} renk="bg-amber" />
            </div>
          ))
        )}
      </div>
    </div>
  );
}
