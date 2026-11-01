import Link from "next/link";
import YonetimKabuk from "@/components/yonetim/YonetimKabuk";
import { IlanKaldir, SikayetIslem } from "@/components/yonetim/YonetimIslemleri";
import { SUPHE_SINIRI } from "@/lib/kaynaklar/filtre";
import { anaPrisma } from "@/lib/prismaAna";
import { telefonGoster } from "@/lib/telefon";
import { yoneticiSayfasi } from "@/lib/yetki";
import { dkOnce } from "@/lib/yonetimVeri";

export const dynamic = "force-dynamic";

const NEDEN: Record<string, string> = {
  YANLIS_NUMARA: "Yanlış numara",
  SAHTE: "Sahte / dolandırıcılık",
  YANLIS_BILGI: "Yanlış bilgi",
  DIGER: "Diğer",
};

/** n gün önceki an (sorgu sınırı) */
function gunOnce(n: number): Date {
  return new Date(Date.now() - n * 24 * 60 * 60 * 1000);
}

function Rota({ i }: { i: { nereden: string | null; nereye: string | null; cikisIl: string | null; varisIl: string | null } }) {
  return (
    <span className="block truncate text-[15px] font-extrabold">
      {i.nereden || i.cikisIl || "?"} → {i.nereye || i.varisIl || "?"}
    </span>
  );
}

/** İlanlar ve şikâyetler: üyelerin bildirdiği ilanlar + düşük güvenli yeni ilanlar. */
export default async function YonetimIlanlar({ searchParams }: { searchParams: Promise<{ sekme?: string }> }) {
  await yoneticiSayfasi();
  const supheli = (await searchParams).sekme === "supheli";
  const sikayetler = await anaPrisma.ilanSikayet.findMany({ where: { durum: "ACIK" }, orderBy: { createdAt: "desc" }, take: 60 });
  const sonuclanan = supheli ? [] : await anaPrisma.ilanSikayet.findMany({ where: { durum: { not: "ACIK" } }, orderBy: { kapandi: "desc" }, take: 15 });
  const ilanlar = await anaPrisma.yukIlani.findMany({
    where: supheli
      ? { guvenSkoru: { lt: SUPHE_SINIRI }, durum: "YENI", createdAt: { gte: gunOnce(3) } }
      : { id: { in: sikayetler.map((s) => s.ilanId) } },
    orderBy: { createdAt: "desc" },
    take: 60,
    select: { id: true, nereden: true, nereye: true, cikisIl: true, varisIl: true, telefon: true, firmaAdi: true, guvenSkoru: true, durum: true, createdAt: true, kaynak: { select: { ad: true } } },
  });
  const ilanMap = new Map(ilanlar.map((i) => [i.id, i]));
  const uyeler = await anaPrisma.uye.findMany({ where: { id: { in: [...sikayetler, ...sonuclanan].map((s) => s.uyeId) } }, select: { id: true, ad: true, kullaniciAdi: true } });
  const uyeAd = new Map(uyeler.map((u) => [u.id, u.ad || u.kullaniciAdi]));

  return (
    <YonetimKabuk sekme="ilanlar" baslik="İlanlar ve şikâyetler" alt="Ortak ilan listesinin denetimi" rozet={{ ilanlar: sikayetler.length }}>
      <div className="grid grid-cols-2 gap-2">
        <Link href="/yonetim/ilanlar" className={`ana-hap justify-center ${!supheli ? "!border-[#4f46e5] !bg-[#eef0ff] !text-[#3730a3]" : ""}`}>
          Şikâyetler ({sikayetler.length})
        </Link>
        <Link href="/yonetim/ilanlar?sekme=supheli" className={`ana-hap justify-center ${supheli ? "!border-[#4f46e5] !bg-[#eef0ff] !text-[#3730a3]" : ""}`}>
          Şüpheli ilanlar
        </Link>
      </div>

      {!supheli &&
        (sikayetler.length === 0 ? (
          <p className="rp-bos">Açık şikâyet yok. Üyeler Yük Bul’daki ilanı “Sorun bildir” ile bildirince burada görünür.</p>
        ) : (
          <ul className="space-y-2.5">
            {sikayetler.map((s) => {
              const i = ilanMap.get(s.ilanId);
              return (
                <li key={s.id} className="rp-kart space-y-2 px-4 py-3">
                  <div className="flex items-start justify-between gap-2">
                    <span className="min-w-0">
                      {i ? <Rota i={i} /> : <span className="block text-[15px] font-extrabold">İlan #{s.ilanId} (silinmiş)</span>}
                      <span className="block text-[12px] text-[var(--a-ikincil)]">
                        {[i?.firmaAdi, i?.telefon ? telefonGoster(i.telefon) : null, i?.kaynak?.ad].filter(Boolean).join(" · ")}
                      </span>
                    </span>
                    <span className="shrink-0 rounded-full bg-[#fee2e2] px-2.5 py-1 text-[11.5px] font-bold text-[#b91c1c]">{NEDEN[s.neden] ?? s.neden}</span>
                  </div>
                  {s.not && <p className="rounded-xl bg-[#f6f7fb] px-3 py-2 text-[13px]">“{s.not}”</p>}
                  <div className="flex items-center justify-between gap-2">
                    <span className="text-[12px] text-[var(--a-ikincil)]">
                      {uyeAd.get(s.uyeId) ?? `Üye #${s.uyeId}`} · {dkOnce(s.createdAt)}
                    </span>
                    <SikayetIslem id={s.id} />
                  </div>
                </li>
              );
            })}
          </ul>
        ))}

      {!supheli && sonuclanan.length > 0 && (
        <section aria-labelledby="sonuclanan">
          <h2 id="sonuclanan" className="ana-baslik px-1">
            Sonuçlanan şikâyetler
          </h2>
          <ul className="rp-kart mt-2 px-4">
            {sonuclanan.map((s) => (
              <li key={s.id} className="flex items-center justify-between gap-3 border-b border-[var(--a-cizgi)] py-2.5 text-[13px] last:border-0">
                <span className="min-w-0 truncate">
                  İlan #{s.ilanId} · {NEDEN[s.neden] ?? s.neden} · {uyeAd.get(s.uyeId) ?? `Üye #${s.uyeId}`}
                </span>
                <span className={`shrink-0 font-bold ${s.durum === "KALDIRILDI" ? "text-[#dc2626]" : "text-[var(--a-ikincil)]"}`}>
                  {s.durum === "KALDIRILDI" ? "Kaldırıldı" : "Yok sayıldı"}
                  {s.kapandi ? ` · ${dkOnce(s.kapandi)}` : ""}
                </span>
              </li>
            ))}
          </ul>
        </section>
      )}

      {supheli &&
        (ilanlar.length === 0 ? (
          <p className="rp-bos">Son 3 günde güveni düşük yeni ilan yok.</p>
        ) : (
          <>
            <p className="rp-not -mt-2">
              <span aria-hidden>ⓘ</span>
              <span>Güven puanı {SUPHE_SINIRI}’nin altındaki yeni ilanlar. Kaldırınca kimsenin listesinde görünmez (silinmez).</span>
            </p>
            <ul className="rp-kart px-3">
              {ilanlar.map((i) => (
                <li key={i.id} className="flex items-center gap-3 border-b border-[var(--a-cizgi)] py-3 last:border-0">
                  <span className="min-w-0 flex-1">
                    <Rota i={i} />
                    <span className="block truncate text-[12px] text-[var(--a-ikincil)]">
                      Güven {i.guvenSkoru} · {i.kaynak?.ad ?? "kaynak yok"} · {dkOnce(i.createdAt)}
                    </span>
                  </span>
                  <IlanKaldir id={i.id} />
                </li>
              ))}
            </ul>
          </>
        ))}
    </YonetimKabuk>
  );
}
