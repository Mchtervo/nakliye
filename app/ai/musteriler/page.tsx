import Link from "next/link";
import { musteriHavuzuOku } from "@/lib/musteriHavuz";
import MusteriKart from "@/components/MusteriKart";

export const dynamic = "force-dynamic";

const SEKMELER = [
  { kod: "SAHIP", ad: "Yük sahibi" },
  { kod: "KOMISYONCU", ad: "Komisyoncu" },
  { kod: "HEPSI", ad: "Hepsi" },
] as const;

export default async function MusteriHavuzSayfasi({
  searchParams,
}: {
  searchParams: Promise<{ sekme?: string }>;
}) {
  const sp = await searchParams;
  const sekme = SEKMELER.some((s) => s.kod === sp.sekme)
    ? (sp.sekme as string)
    : "HEPSI";

  const hepsi = await musteriHavuzuOku({ gun: 60 });
  const liste =
    sekme === "SAHIP"
      ? hepsi.filter((m) => m.sinif === "YUK_SAHIBI")
      : sekme === "KOMISYONCU"
        ? hepsi.filter((m) => m.sinif === "KOMISYONCU")
        : hepsi;

  const sahipSayisi = hepsi.filter((m) => m.sinif === "YUK_SAHIBI").length;
  const komisyonSayisi = hepsi.filter((m) => m.sinif === "KOMISYONCU").length;
  const karisikSayisi = hepsi.filter((m) => m.sinif === "KARISIK").length;

  return (
    <div className="mx-auto max-w-lg space-y-4">
      <div className="reveal">
        <p className="text-[11px] font-bold uppercase tracking-[0.18em] text-amber">
          Havuz
        </p>
        <h1 className="font-display text-3xl font-extrabold text-paper">
          Müşteri
        </h1>
        <p className="mt-1 text-sm text-fog">
          Aynı çıkış + aynı yük cinsi → yük sahibi. Çok rota → komisyoncu.
          Doğrudan yük sahibi aramak navlunu %25–30 artırır.
        </p>
        <p className="mt-2 text-xs text-teal">
          {sahipSayisi} yük sahibi · {komisyonSayisi} komisyoncu ·{" "}
          {karisikSayisi} karışık · {hepsi.length} toplam (60 gün)
        </p>
      </div>

      <div className="-mx-1 flex gap-1 overflow-x-auto rounded-xl border border-white/10 bg-asphalt-2 p-1 scrollbar-none">
        {SEKMELER.map((s) => {
          const aktif = s.kod === sekme;
          const rozet =
            s.kod === "SAHIP"
              ? sahipSayisi
              : s.kod === "KOMISYONCU"
                ? komisyonSayisi
                : hepsi.length;
          return (
            <Link
              key={s.kod}
              href={`/ai/musteriler?sekme=${s.kod}`}
              className={`shrink-0 rounded-lg px-3 py-2.5 text-center text-sm font-semibold ${
                aktif ? "bg-white/10 text-amber" : "text-fog hover:text-paper"
              }`}
            >
              {s.ad}
              {rozet > 0 && (
                <span className="ml-1 text-xs font-bold text-amber">{rozet}</span>
              )}
            </Link>
          );
        })}
      </div>

      <p className="text-xs text-fog">
        <Link href="/ai/yukler" className="font-semibold text-amber hover:underline">
          ← Yük bulucu
        </Link>
      </p>

      {liste.length === 0 ? (
        <div className="bos-durum">
          Henüz sınıflandırılacak telefon yok. İlan biriktikçe dolar.
        </div>
      ) : (
        <div className="space-y-2.5">
          {liste.map((m) => (
            <MusteriKart
              key={m.telefon}
              m={{
                telefon: m.telefon,
                firmaAdi: m.firmaAdi,
                sinif: m.sinif,
                baskinCikis: m.baskinCikis,
                baskinYukTipi: m.baskinYukTipi,
                baskinGuzergah: m.baskinGuzergah,
                haftalikSiklik: m.haftalikSiklik,
                ilanAdet: m.ilanAdet,
                rotaAdet: m.rotaAdet,
                koridorDisi: m.koridorDisi,
                isaretli: m.isaretli,
                sonNot: m.sonNot,
                sonIlan: m.sonIlan.toISOString(),
              }}
            />
          ))}
        </div>
      )}
    </div>
  );
}
