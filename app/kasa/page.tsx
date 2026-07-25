import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { tlYaz, tarihYaz } from "@/lib/para";
import { bugunTarihStr } from "@/lib/tarih";
import { kasaHareketSil } from "@/app/actions";
import KasaForm from "@/components/KasaForm";
import SilButonu from "@/components/SilButonu";

export const dynamic = "force-dynamic";

export default async function KasaSayfasi() {
  const hareketler = await prisma.kasaHareket.findMany({
    orderBy: [{ tarih: "desc" }, { id: "desc" }],
  });

  const bakiye = hareketler.reduce((t, h) => {
    return h.tip === "GIRIS" ? t + h.tutar : t - h.tutar;
  }, 0);

  const girisToplam = hareketler
    .filter((h) => h.tip === "GIRIS")
    .reduce((t, h) => t + h.tutar, 0);
  const cikisToplam = hareketler
    .filter((h) => h.tip === "CIKIS")
    .reduce((t, h) => t + h.tutar, 0);

  return (
    <div className="space-y-5">
      <div className="reveal">
        <p className="text-[11px] font-bold uppercase tracking-[0.18em] text-amber">
          Nakit
        </p>
        <h1 className="font-display text-3xl font-extrabold text-paper sm:text-4xl">
          Kasa
        </h1>
        <p className="mt-1 text-sm text-fog">
          Eldeki para. Manuel giriş / çıkış ekle; bakiye panoda da görünür.
        </p>
      </div>

      <div className="grid gap-3 sm:grid-cols-3">
        <div className="kart space-y-1 p-4 reveal reveal-d1 sm:col-span-1">
          <div className="text-[10px] font-bold uppercase tracking-wider text-fog">
            Kasada kalan
          </div>
          <div
            className={`font-display text-3xl font-extrabold ${
              bakiye >= 0 ? "text-teal" : "text-ember"
            }`}
          >
            {tlYaz(bakiye)}
          </div>
        </div>
        <div className="kart space-y-1 p-4 reveal reveal-d2">
          <div className="text-[10px] font-bold uppercase tracking-wider text-fog">
            Toplam giriş
          </div>
          <div className="font-display text-2xl font-extrabold text-ok">
            {tlYaz(girisToplam)}
          </div>
        </div>
        <div className="kart space-y-1 p-4 reveal reveal-d3">
          <div className="text-[10px] font-bold uppercase tracking-wider text-fog">
            Toplam çıkış
          </div>
          <div className="font-display text-2xl font-extrabold text-ember">
            {tlYaz(cikisToplam)}
          </div>
        </div>
      </div>

      <div className="grid gap-5 lg:grid-cols-2">
        <div className="kart-paper p-4 sm:p-5 reveal reveal-d2">
          <h2 className="font-display mb-3 text-lg font-bold text-ink">
            Yeni hareket
          </h2>
          <KasaForm bugunTarih={bugunTarihStr()} />
        </div>

        <div className="space-y-3 reveal reveal-d3">
          <h2 className="font-display text-lg font-bold text-paper">Hareketler</h2>
          {hareketler.length === 0 ? (
            <div className="bos-durum">Henüz kasa hareketi yok.</div>
          ) : (
            hareketler.map((h) => (
              <div
                key={h.id}
                className="kart flex flex-wrap items-center justify-between gap-2 p-4"
              >
                <div>
                  <div className="font-display text-base font-bold text-paper">
                    {h.tip === "GIRIS" ? "Giriş" : "Çıkış"}
                    {h.aciklama ? ` · ${h.aciklama}` : ""}
                  </div>
                  <div className="text-sm text-fog">{tarihYaz(h.tarih)}</div>
                </div>
                <div className="flex items-center gap-2">
                  <span
                    className={`font-display text-lg font-extrabold ${
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

      <Link
        href="/"
        className="block text-center text-sm font-medium text-fog hover:text-amber"
      >
        ← Panele dön
      </Link>
    </div>
  );
}
