import Link from "next/link";
import { HareketKok } from "@/components/ana/Hareket";
import { anaYazi } from "@/components/ana/yazi";
import { DonemGecis } from "@/components/finans/RaporGrafik";
import RaporUst from "@/components/finans/RaporUst";
import MusteriSatir from "@/components/musteri/MusteriSatir";
import { musteriHavuzuOku, telefonGorunum } from "@/lib/musteriHavuz";

export const dynamic = "force-dynamic";

const SEKMELER = [
  { kod: "SAHIP", ad: "Yük sahibi" },
  { kod: "KOMISYONCU", ad: "Komisyoncu" },
  { kod: "HEPSI", ad: "Hepsi" },
] as const;

/**
 * Yük sahibi ve komisyoncular: ortak ilanlardaki telefonlardan çıkarılır.
 * Not ve "müşterim" işareti kullanıcının kendi hesabındadır; diğer üyeleri etkilemez.
 */
export default async function MusterilerSayfasi({ searchParams }: { searchParams: Promise<{ sekme?: string }> }) {
  const sp = await searchParams;
  const sekme = SEKMELER.some((s) => s.kod === sp.sekme) ? (sp.sekme as string) : "HEPSI";
  const hepsi = await musteriHavuzuOku({ gun: 60 });
  const liste = (sekme === "SAHIP" ? hepsi.filter((m) => m.sinif === "YUK_SAHIBI") : sekme === "KOMISYONCU" ? hepsi.filter((m) => m.sinif === "KOMISYONCU") : hepsi).slice(0, 80);

  return (
    <div className={`ana ${anaYazi.variable}`}>
      <HareketKok>
        <RaporUst>
          <h1 className="text-[1.6rem] font-extrabold leading-tight tracking-[-0.03em] text-white">Yük sahibi ve komisyoncular</h1>
          <p className="mt-0.5 text-[13.5px] text-[#c7cffd]">En çok ilan paylaşandan başlayarak</p>
        </RaporUst>
        <div className="ana-ic relative z-10 -mt-10 space-y-4 pb-8">
          <nav className="yn-sekmeler !grid-cols-3" aria-label="Müşteri türü">
            {SEKMELER.map((s) => (
              <Link key={s.kod} href={`/musteriler?sekme=${s.kod}`} aria-current={sekme === s.kod ? "page" : undefined} className={`yn-sekme !min-h-11 ${sekme === s.kod ? "!bg-[#4f46e5] !text-white" : ""}`}>
                {s.ad}
              </Link>
            ))}
          </nav>
          <DonemGecis key={sekme}>
            {liste.length === 0 ? (
              <p className="rp-bos">Bu türde telefonlu ilan yok.</p>
            ) : (
              <ul className="space-y-3">
                {liste.map((m, i) => (
                  <MusteriSatir
                    key={m.telefon}
                    idx={i}
                    m={{
                      telefon: m.telefon,
                      telefonYazi: telefonGorunum(m.telefon),
                      ad: m.firmaAdi || "İsimsiz ilan sahibi",
                      sinif: m.sinif,
                      guzergah: m.baskinGuzergah,
                      sehirYazi: m.sehirler.length ? `Çıkış: ${m.sehirler.map((s) => `${s.il} %${s.pay}`).join(" · ")}` : null,
                      sayilar: `Bugün ${m.bugun} · 7 günde ${m.hafta} · toplam ${m.toplam}${m.takipGun < 60 ? ` (${m.takipGun} gündür takipte)` : ""}`,
                      ozet: `${m.rotaAdet} rota${m.koridorDisi ? " · koridor dışı" : ""}`,
                      isaretli: m.isaretli,
                      sonNot: m.sonNot,
                    }}
                  />
                ))}
              </ul>
            )}
          </DonemGecis>
          <p className="rp-not">
            <span aria-hidden>ⓘ</span>
            <span>
              Sayılar listede görünen yeni ilanlardan sayılır (aynı ilanın tekrarı sayılmaz). Sayaç yeni başladı; &quot;gündür takipte&quot; yazanların sayısı her gün büyür.
              Sınıflandırma tahmindir. Notların ve işaretlerin yalnız sende görünür.
            </span>
          </p>
        </div>
      </HareketKok>
    </div>
  );
}
