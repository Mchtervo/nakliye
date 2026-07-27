import Link from "next/link";
import {
  musteriHavuzuOku,
  telefonGorunum,
  type MusteriSinif,
} from "@/lib/musteriHavuz";
import { gecenSure } from "@/lib/ilanGorunum";

export const dynamic = "force-dynamic";

const SEKMELER = [
  { kod: "SAHIP", ad: "Yük sahibi" },
  { kod: "KOMISYONCU", ad: "Komisyoncu" },
  { kod: "HEPSI", ad: "Hepsi" },
] as const;

function sinifEtiket(s: MusteriSinif): string {
  if (s === "YUK_SAHIBI") return "Yük sahibi";
  if (s === "KOMISYONCU") return "Komisyoncu";
  return "Karışık";
}

export default async function MusteriHavuzSayfasi({
  searchParams,
}: {
  searchParams: Promise<{ sekme?: string }>;
}) {
  const sp = await searchParams;
  const sekme = SEKMELER.some((s) => s.kod === sp.sekme)
    ? (sp.sekme as string)
    : "SAHIP";

  const hepsi = await musteriHavuzuOku({ gun: 60 });
  const liste =
    sekme === "SAHIP"
      ? hepsi.filter((m) => m.sinif === "YUK_SAHIBI")
      : sekme === "KOMISYONCU"
        ? hepsi.filter((m) => m.sinif === "KOMISYONCU")
        : hepsi;

  const sahipSayisi = hepsi.filter((m) => m.sinif === "YUK_SAHIBI").length;
  const komisyonSayisi = hepsi.filter((m) => m.sinif === "KOMISYONCU").length;

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
          {sahipSayisi} yük sahibi · {komisyonSayisi} komisyoncu (60 gün)
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
            <article
              key={m.telefon}
              className={`rounded-2xl border px-3.5 py-3 ${
                m.sinif === "YUK_SAHIBI"
                  ? "border-teal/30 bg-teal/8"
                  : m.sinif === "KOMISYONCU"
                    ? "border-white/10 bg-white/4 opacity-70"
                    : "border-white/10 bg-white/4"
              }`}
            >
              <div className="flex items-start justify-between gap-2">
                <div className="min-w-0">
                  <div className="truncate font-semibold text-paper">
                    {m.firmaAdi || "İsimsiz"}
                  </div>
                  <a
                    href={`tel:0${m.telefon}`}
                    className="mt-0.5 inline-block text-sm font-bold text-teal hover:underline"
                  >
                    {telefonGorunum(m.telefon)}
                  </a>
                </div>
                <span
                  className={`shrink-0 rounded-md px-1.5 py-0.5 text-[10px] font-bold uppercase tracking-wide ${
                    m.sinif === "YUK_SAHIBI"
                      ? "bg-teal/20 text-teal"
                      : m.sinif === "KOMISYONCU"
                        ? "bg-ember/15 text-ember"
                        : "bg-white/10 text-fog"
                  }`}
                >
                  {sinifEtiket(m.sinif)}
                </span>
              </div>
              <div className="mt-2 flex flex-wrap gap-x-3 gap-y-1 text-xs text-fog">
                {m.baskinCikis && <span>Çıkış: {m.baskinCikis}</span>}
                {m.baskinYukTipi && <span>Yük: {m.baskinYukTipi}</span>}
                <span>{m.ilanAdet} ilan</span>
                <span>{m.rotaAdet} rota</span>
                <span>son: {gecenSure(m.sonIlan)}</span>
              </div>
              {m.sinif === "YUK_SAHIBI" && (
                <p className="mt-1.5 text-[11px] font-semibold text-teal/90">
                  Doğrudan müşteri adayı — komisyoncuyu aradan çıkar
                </p>
              )}
            </article>
          ))}
        </div>
      )}
    </div>
  );
}
