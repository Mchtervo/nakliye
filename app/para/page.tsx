import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { tlYaz, tarihYaz } from "@/lib/para";
import { bugunTarihStr } from "@/lib/tarih";
import { kasaHareketSil } from "@/app/actions";
import KasaForm from "@/components/KasaForm";
import SilButonu from "@/components/SilButonu";

export const dynamic = "force-dynamic";

const SEKMELER = [
  { kod: "ozet", ad: "Özet" },
  { kod: "kasa", ad: "Kasada" },
  { kod: "cari", ad: "Cariler" },
] as const;

type Sekme = (typeof SEKMELER)[number]["kod"];

export default async function ParaSayfasi({
  searchParams,
}: {
  searchParams: Promise<{ sekme?: string }>;
}) {
  const sp = await searchParams;
  const sekme: Sekme = SEKMELER.some((s) => s.kod === sp.sekme)
    ? (sp.sekme as Sekme)
    : "ozet";

  const [hareketler, firmalar] = await Promise.all([
    prisma.kasaHareket.findMany({
      orderBy: [{ tarih: "desc" }, { id: "desc" }],
      take: 80,
    }),
    prisma.firma.findMany({
      include: { yukler: { include: { odemeler: true } } },
      orderBy: { ad: "asc" },
    }),
  ]);

  const kasaBakiye = hareketler.reduce(
    (t, h) => (h.tip === "GIRIS" ? t + h.tutar : t - h.tutar),
    0
  );
  const girisToplam = hareketler
    .filter((h) => h.tip === "GIRIS")
    .reduce((t, h) => t + h.tutar, 0);
  const cikisToplam = hareketler
    .filter((h) => h.tip === "CIKIS")
    .reduce((t, h) => t + h.tutar, 0);

  const cariler = firmalar.map((f) => {
    const anlasilan = f.yukler.reduce((t, y) => t + y.toplamTutar, 0);
    const odenen = f.yukler.reduce(
      (t, y) => t + y.odemeler.reduce((o, p) => o + p.tutar, 0),
      0
    );
    const kalan = Math.max(0, anlasilan - odenen);
    const acikYuk = f.yukler.filter((y) => {
      const o = y.odemeler.reduce((s, p) => s + p.tutar, 0);
      return y.toplamTutar - o > 0;
    }).length;
    return {
      id: f.id,
      ad: f.ad,
      anlasilan,
      odenen,
      kalan,
      yukSayisi: f.yukler.length,
      acikYuk,
    };
  });
  cariler.sort((a, b) => b.kalan - a.kalan || a.ad.localeCompare(b.ad, "tr"));

  const toplamAlacak = cariler.reduce((t, s) => t + s.kalan, 0);
  const borcluFirma = cariler.filter((s) => s.kalan > 0).length;

  return (
    <div className="mx-auto max-w-lg space-y-4">
      <div>
        <p className="sayfa-eyebrow">Para</p>
        <h1 className="font-display text-3xl font-bold tracking-tight text-paper">
          Kasa &amp; Cari
        </h1>
        <p className="mt-2 text-sm leading-relaxed text-fog">
          Kasada nakit · firmalarda alacak — tek yerde.
        </p>
      </div>

      <div className="grid grid-cols-2 gap-2.5">
        <div className="rounded-2xl border border-white/12 bg-[#161e2a] p-3.5">
          <p className="text-xs font-semibold text-fog">Kasada</p>
          <p
            className={`mt-1 font-display text-2xl font-bold ${
              kasaBakiye >= 0 ? "text-paper" : "text-ember"
            }`}
          >
            {tlYaz(kasaBakiye)}
          </p>
        </div>
        <div className="rounded-2xl border border-white/12 bg-[#161e2a] p-3.5">
          <p className="text-xs font-semibold text-fog">Alacak</p>
          <p className="mt-1 font-display text-2xl font-bold text-amber">
            {tlYaz(toplamAlacak)}
          </p>
          <p className="mt-0.5 text-xs text-fog">
            {borcluFirma > 0 ? `${borcluFirma} firmada` : "borç yok"}
          </p>
        </div>
      </div>

      <div className="flex gap-1 rounded-2xl border border-white/10 bg-[#121a26] p-1">
        {SEKMELER.map((s) => {
          const aktif = s.kod === sekme;
          return (
            <Link
              key={s.kod}
              href={`/para?sekme=${s.kod}`}
              className={`flex-1 rounded-xl py-2.5 text-center text-sm font-bold ${
                aktif ? "bg-amber/15 text-amber" : "text-paper/70 hover:text-paper"
              }`}
            >
              {s.ad}
            </Link>
          );
        })}
      </div>

      {sekme === "ozet" && (
        <div className="space-y-3">
          <Link
            href="/para?sekme=kasa"
            className="block rounded-2xl border border-white/12 bg-[#161e2a] p-4"
          >
            <div className="flex items-center justify-between gap-2">
              <div>
                <p className="font-display text-lg font-bold text-paper">Kasada nakit</p>
                <p className="mt-1 text-sm text-fog">
                  Giriş {tlYaz(girisToplam)} · çıkış {tlYaz(cikisToplam)}
                </p>
              </div>
              <span className="text-fog">→</span>
            </div>
          </Link>
          <Link
            href="/para?sekme=cari"
            className="block rounded-2xl border border-white/12 bg-[#161e2a] p-4"
          >
            <div className="flex items-center justify-between gap-2">
              <div>
                <p className="font-display text-lg font-bold text-paper">
                  Firmalardan alacak
                </p>
                <p className="mt-1 text-sm text-fog">
                  {cariler.length} cari · {borcluFirma} açık
                </p>
              </div>
              <span className="text-fog">→</span>
            </div>
          </Link>
          {cariler.filter((c) => c.kalan > 0).slice(0, 4).map((f) => (
            <Link
              key={f.id}
              href={`/firmalar/${f.id}`}
              className="flex items-center justify-between gap-3 rounded-xl border border-white/10 bg-black/20 px-3 py-3"
            >
              <span className="truncate font-semibold text-paper">{f.ad}</span>
              <span className="shrink-0 font-bold text-amber">{tlYaz(f.kalan)}</span>
            </Link>
          ))}
        </div>
      )}

      {sekme === "kasa" && (
        <div className="space-y-4">
          <div className="rounded-2xl border border-white/12 bg-paper-2 p-4 text-ink">
            <h2 className="font-display mb-3 text-lg font-bold">Yeni hareket</h2>
            <KasaForm bugunTarih={bugunTarihStr()} />
          </div>
          <div className="space-y-2">
            <h2 className="font-display text-lg font-bold text-paper">Hareketler</h2>
            {hareketler.length === 0 ? (
              <div className="bos-durum">Henüz kasa hareketi yok.</div>
            ) : (
              hareketler.map((h) => (
                <div
                  key={h.id}
                  className="flex flex-wrap items-center justify-between gap-2 rounded-xl border border-white/10 bg-[#161e2a] p-3.5"
                >
                  <div>
                    <p className="font-semibold text-paper">
                      {h.tip === "GIRIS" ? "Giriş" : "Çıkış"}
                      {h.aciklama ? ` · ${h.aciklama}` : ""}
                    </p>
                    <p className="text-sm text-fog">{tarihYaz(h.tarih)}</p>
                  </div>
                  <div className="flex items-center gap-2">
                    <span
                      className={`font-display text-lg font-bold ${
                        h.tip === "GIRIS" ? "text-ok" : "text-ember"
                      }`}
                    >
                      {h.tip === "GIRIS" ? "+" : "−"}
                      {tlYaz(h.tutar)}
                    </span>
                    <SilButonu
                      onay="Bu kasa hareketini silmek istediğine emin misin?"
                      sil={kasaHareketSil.bind(null, h.id)}
                    />
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      )}

      {sekme === "cari" && (
        <div className="space-y-3">
          {cariler.length === 0 ? (
            <div className="bos-durum">
              Henüz firma yok. İlk seferi yazınca cari oluşur.
            </div>
          ) : (
            cariler.map((f) => (
              <Link
                key={f.id}
                href={`/firmalar/${f.id}`}
                className="block rounded-2xl border border-white/12 bg-[#161e2a] p-4"
              >
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0">
                    <p className="truncate font-display text-lg font-bold text-paper">
                      {f.ad}
                    </p>
                    <p className="mt-1 text-sm text-fog">
                      {f.yukSayisi} sefer
                      {f.acikYuk > 0 ? ` · ${f.acikYuk} açık` : " · hepsi tahsil"}
                    </p>
                  </div>
                  <p
                    className={`shrink-0 font-display text-xl font-bold ${
                      f.kalan > 0 ? "text-amber" : "text-ok"
                    }`}
                  >
                    {f.kalan > 0 ? tlYaz(f.kalan) : "Tamam"}
                  </p>
                </div>
              </Link>
            ))
          )}
        </div>
      )}
    </div>
  );
}
