import Link from "next/link";
import { tlYaz } from "@/lib/para";
import {
  ayEtiketi,
  ayKisaEtiketi,
  ayParametresi,
  ayParametresiOku,
  kdvDonemiHesapla,
  sonAylarKdv,
} from "@/lib/kdv";

export const dynamic = "force-dynamic";

export default async function KdvMerkeziSayfasi({
  searchParams,
}: {
  searchParams: Promise<{ ay?: string }>;
}) {
  const sp = await searchParams;
  const { yil, ay } = ayParametresiOku(sp.ay);

  const [donem, trend] = await Promise.all([
    kdvDonemiHesapla(yil, ay),
    sonAylarKdv(6, yil, ay),
  ]);

  const onceki = new Date(yil, ay - 2, 1);
  const sonraki = new Date(yil, ay, 1);
  const maxTrend = Math.max(
    1,
    ...trend.map((t) => Math.max(t.hesaplananKdv, t.indirilecekKdv))
  );
  const maxKategori = donem.kategoriler[0]?.kdv || 1;

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-end justify-between gap-3 reveal">
        <div>
          <p className="text-[11px] font-bold uppercase tracking-[0.18em] text-amber">
            Vergi
          </p>
          <h1 className="font-display text-3xl font-extrabold text-paper sm:text-4xl">
            KDV Merkezi
          </h1>
          <p className="mt-1 text-sm text-fog">
            Hesap yapmana gerek yok — ay seç, ödeyeceğin KDV burada.
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <a
            href={`/api/excel?ay=${ayParametresi(yil, ay)}`}
            className="btn btn-teal !px-3 !py-2 text-xs sm:text-sm"
          >
            Excel indir
          </a>
          <div className="flex items-center gap-1 rounded-xl border border-white/10 bg-asphalt-2 p-1">
            <Link
              href={`/kdv?ay=${ayParametresi(onceki.getFullYear(), onceki.getMonth() + 1)}`}
              className="rounded-lg px-3 py-1.5 text-sm font-semibold text-fog hover:bg-white/5 hover:text-paper"
            >
              ←
            </Link>
            <span className="min-w-[9rem] text-center text-sm font-bold capitalize text-paper">
              {ayEtiketi(yil, ay)}
            </span>
            <Link
              href={`/kdv?ay=${ayParametresi(sonraki.getFullYear(), sonraki.getMonth() + 1)}`}
              className="rounded-lg px-3 py-1.5 text-sm font-semibold text-fog hover:bg-white/5 hover:text-paper"
            >
              →
            </Link>
          </div>
        </div>
      </div>

      <section className="kart relative overflow-hidden p-5 sm:p-7 reveal reveal-d1">
        <div
          className="pointer-events-none absolute -right-16 -top-20 h-56 w-56 rounded-full opacity-25 blur-3xl"
          style={{ background: "radial-gradient(circle, #f0a020, transparent 70%)" }}
        />
        <div className="relative">
          <div className="text-[11px] font-bold uppercase tracking-[0.16em] text-fog">
            {donem.odenecekKdv > 0 ? "Bu ay devlete ödeyeceğin" : "Sonraki aya devreden"}
          </div>
          <div
            className={`font-display mt-1 text-4xl font-extrabold sm:text-5xl ${
              donem.odenecekKdv > 0 ? "text-amber" : "text-ok"
            }`}
          >
            {tlYaz(donem.odenecekKdv > 0 ? donem.odenecekKdv : donem.devredenKdv)}
          </div>
          <p className="mt-2 max-w-lg text-sm leading-relaxed text-fog">
            {donem.odenecekKdv > 0 ? (
              <>
                Yüklerden topladığın {tlYaz(donem.hesaplananKdv)} KDV&apos;den,
                giderlerin KDV&apos;si {tlYaz(donem.indirilecekKdv)} düşüldü.
              </>
            ) : (
              <>
                Giderlerinin KDV&apos;si yüklerinkinden fazla. Bu ay KDV ödemiyorsun;
                fark sonraki aya devrediyor.
              </>
            )}
          </p>
          <div className="lane-strip mt-5 max-w-xs" />
        </div>
      </section>

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <div className="kart p-4 reveal reveal-d1">
          <div className="text-[11px] font-bold uppercase tracking-wider text-fog">
            Hesaplanan KDV
          </div>
          <div className="mt-1 font-display text-xl font-extrabold text-teal">
            {tlYaz(donem.hesaplananKdv)}
          </div>
          <div className="text-xs text-fog">
            {donem.yukAdet} yük · devlete borç
          </div>
        </div>
        <div className="kart p-4 reveal reveal-d2">
          <div className="text-[11px] font-bold uppercase tracking-wider text-fog">
            İndirilecek KDV
          </div>
          <div className="mt-1 font-display text-xl font-extrabold text-ember">
            {tlYaz(donem.indirilecekKdv)}
          </div>
          <div className="text-xs text-fog">
            {donem.giderAdet} gider · borçtan düşer
          </div>
        </div>
        <div className="kart p-4 reveal reveal-d3">
          <div className="text-[11px] font-bold uppercase tracking-wider text-fog">
            Demirbaş KDV
          </div>
          <div className="mt-1 font-display text-xl font-extrabold text-paper">
            {tlYaz(donem.demirbasKdv)}
          </div>
          <div className="text-xs text-fog">İndirilecek KDV&apos;nin içinde</div>
        </div>
        <div className="kart p-4 reveal reveal-d4">
          <div className="text-[11px] font-bold uppercase tracking-wider text-fog">
            Devreden KDV
          </div>
          <div className="mt-1 font-display text-xl font-extrabold text-ok">
            {tlYaz(donem.devredenKdv)}
          </div>
          <div className="text-xs text-fog">Sonraki aya aktarılır</div>
        </div>
      </div>

      <section className="kart space-y-4 p-4 sm:p-5 reveal reveal-d2">
        <div>
          <h2 className="font-display text-lg font-bold text-paper">Son 6 ay</h2>
          <p className="text-xs text-fog">
            Yeşil: hesaplanan (topladığın) · Turuncu: indirilecek (ödediğin)
          </p>
        </div>
        <div className="space-y-3">
          {trend.map((t) => (
            <div key={`${t.yil}-${t.ay}`}>
              <div className="mb-1 flex items-baseline justify-between gap-2">
                <span className="text-sm font-semibold capitalize text-paper">
                  {ayKisaEtiketi(t.yil, t.ay)} {t.yil}
                </span>
                <span className="text-xs font-semibold text-fog">
                  {t.odenecekKdv > 0
                    ? `Ödenecek ${tlYaz(t.odenecekKdv)}`
                    : t.devredenKdv > 0
                      ? `Devreden ${tlYaz(t.devredenKdv)}`
                      : "Kayıt yok"}
                </span>
              </div>
              <div className="space-y-1">
                <div className="h-2 overflow-hidden rounded-full bg-white/8">
                  <div
                    className="bar-anim h-full rounded-full bg-teal"
                    style={{
                      width: `${Math.round((t.hesaplananKdv / maxTrend) * 100)}%`,
                    }}
                  />
                </div>
                <div className="h-2 overflow-hidden rounded-full bg-white/8">
                  <div
                    className="bar-anim h-full rounded-full bg-amber"
                    style={{
                      width: `${Math.round((t.indirilecekKdv / maxTrend) * 100)}%`,
                    }}
                  />
                </div>
              </div>
            </div>
          ))}
        </div>
      </section>

      <section className="kart space-y-4 p-4 sm:p-5 reveal reveal-d3">
        <div>
          <h2 className="font-display text-lg font-bold text-paper">
            İndirilecek KDV nereden geliyor
          </h2>
          <p className="text-xs text-fog">Gider türüne göre bu ayki KDV dağılımı</p>
        </div>
        {donem.kategoriler.length === 0 ? (
          <div className="bos-durum">
            Bu ay KDV&apos;li gider kaydı yok. Fişleri girdikçe burası dolar.
          </div>
        ) : (
          <div className="space-y-3">
            {donem.kategoriler.map((k) => (
              <div key={k.kod}>
                <div className="mb-1 flex items-baseline justify-between gap-2">
                  <span className="text-sm font-semibold text-paper">
                    {k.ad}
                    <span className="ml-2 text-xs font-medium text-fog">
                      {k.adet} kayıt
                    </span>
                  </span>
                  <span className="font-display text-base font-bold text-amber">
                    {tlYaz(k.kdv)}
                  </span>
                </div>
                <div className="h-2 overflow-hidden rounded-full bg-white/8">
                  <div
                    className="bar-anim h-full rounded-full bg-amber"
                    style={{ width: `${Math.round((k.kdv / maxKategori) * 100)}%` }}
                  />
                </div>
              </div>
            ))}
          </div>
        )}
      </section>

      <section className="kart space-y-2 border-white/8 p-4 text-sm leading-relaxed text-fog reveal reveal-d4">
        <h2 className="font-display text-base font-bold text-paper">
          Kısaca nasıl işliyor
        </h2>
        <p>
          Müşteriye kestiğin faturadaki KDV{" "}
          <span className="font-semibold text-paper">hesaplanan KDV</span>&apos;dir,
          onu devlet adına tahsil edersin.
        </p>
        <p>
          Yakıt, lastik, bakım, demirbaş gibi harcamalarında ödediğin KDV{" "}
          <span className="font-semibold text-paper">indirilecek KDV</span>&apos;dir;
          o para cebinden ekstra çıkmaz, borcundan düşülür.
        </p>
        <p>
          İkisinin farkı pozitifse aradaki tutarı ödersin, negatifse sonraki aya
          devreder. Fiş toplamak doğrudan cebine kalan paradır.
        </p>
        {(donem.kdvsizYukAdet > 0 || donem.kdvsizGiderAdet > 0) && (
          <p className="text-amber">
            Bu ay {donem.kdvsizYukAdet} yük ve {donem.kdvsizGiderAdet} gider
            KDV&apos;siz işaretli — hesaba katılmadı.
          </p>
        )}
      </section>

      <div className="flex flex-wrap justify-center gap-3 text-sm">
        <Link href="/raporlar" className="font-medium text-fog hover:text-amber">
          Raporlar →
        </Link>
        <Link href="/muhasebeci" className="font-medium text-fog hover:text-amber">
          Muhasebeciye gönder →
        </Link>
      </div>
    </div>
  );
}
