import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { kurustanGiris, tarihYaz, tlYaz } from "@/lib/para";
import { aiTercihleriOku } from "@/lib/ayarlar";
import { aiKapaliMi, aiKullanilabilir } from "@/lib/ai/istemci";
import { aracBelirsizMi, aracTipiAdi } from "@/lib/arac";
import { fiyatGorunumu, gecenSure } from "@/lib/ilanGorunum";
import { SUPHE_SINIRI, tercihKosulu } from "@/lib/kaynaklar/filtre";
import { eskiIlanlariTemizle, simdiTara } from "@/app/ai-actions";
import AksiyonButonu from "@/components/AksiyonButonu";
import IlanAksiyonlari from "@/components/IlanAksiyonlari";

export const dynamic = "force-dynamic";

const SEKMELER = [
  { kod: "YENI", ad: "Yeni" },
  { kod: "ILGILENIYOR", ad: "Takipte" },
  { kod: "DONUS", ad: "Dönüş" },
  { kod: "SUPHELI", ad: "Şüpheli" },
  { kod: "HEPSI", ad: "Hepsi" },
] as const;

export default async function AiYuklerSayfasi({
  searchParams,
}: {
  searchParams: Promise<{ sekme?: string }>;
}) {
  const sp = await searchParams;
  const sekme = SEKMELER.some((s) => s.kod === sp.sekme)
    ? (sp.sekme as string)
    : "YENI";

  const tercih = await aiTercihleriOku();

  // Şüpheli (<50) SADECE Şüpheli sekmesinde. Ana liste / Hepsi / Dönüş'e girmez.
  const filtre =
    sekme === "SUPHELI"
      ? { guvenSkoru: { lt: SUPHE_SINIRI } }
      : sekme === "HEPSI"
        ? { guvenSkoru: { gte: SUPHE_SINIRI } }
        : sekme === "DONUS"
          ? { donusTalebiId: { not: null }, guvenSkoru: { gte: SUPHE_SINIRI } }
          : sekme === "YENI"
            ? { durum: "YENI", ...tercihKosulu(tercih) }
            : { durum: sekme, guvenSkoru: { gte: SUPHE_SINIRI } };

  const [ilanlar, kaynakSayisi, yeniSayisi, donusSayisi, supheliSayisi] =
    await Promise.all([
      prisma.yukIlani.findMany({
        where: filtre,
        orderBy: [{ createdAt: "desc" }],
        take: 60,
        include: { kaynak: { select: { ad: true, tur: true } } },
      }),
      prisma.ilanKaynagi.count({ where: { aktif: true } }),
      prisma.yukIlani.count({
        where: { durum: "YENI", ...tercihKosulu(tercih) },
      }),
      prisma.yukIlani.count({ where: { donusTalebiId: { not: null } } }),
      prisma.yukIlani.count({ where: { guvenSkoru: { lt: SUPHE_SINIRI } } }),
    ]);

  const aiAcik = aiKullanilabilir();
  const killSwitch = aiKapaliMi();
  const anahtarVar = Boolean(process.env.OPENAI_API_KEY);

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-end justify-between gap-3 reveal">
        <div>
          <p className="text-[11px] font-bold uppercase tracking-[0.18em] text-amber">
            Yapay zekâ
          </p>
          <h1 className="font-display text-3xl font-extrabold text-paper sm:text-4xl">
            Yük Bulucu
          </h1>
          <p className="mt-1 text-sm text-fog">
            {kaynakSayisi > 0
              ? `${kaynakSayisi} kaynak taranıyor · ${yeniSayisi} yeni ilan`
              : "Henüz kaynak yok — Ayarlar'dan ekle veya botu gruba davet et."}
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <AksiyonButonu
            calistir={simdiTara}
            etiket="Şimdi tara"
            bekleyenEtiket="Taranıyor..."
            sinif="btn btn-amber !px-3 !py-2 text-xs sm:text-sm"
          />
          <Link href="/ayarlar#ai" className="btn btn-ghost !px-3 !py-2 text-xs sm:text-sm">
            Kaynaklar
          </Link>
        </div>
      </div>

      {killSwitch && (
        <div className="rounded-xl border border-amber/30 bg-amber/10 px-4 py-3 text-sm text-paper reveal">
          <strong>AI kapalı (AI_KAPALI=true).</strong> Cron OpenAI çağrısı
          yapmıyor. Telegram tarama devam eder; kuyruk birikir. Yeni key ile
          önce Ayarlar&apos;dan &quot;10 mesaj işle ve dur&quot; testini çalıştır.
        </div>
      )}

      {!killSwitch && !anahtarVar && (
        <div className="rounded-xl border border-ember/30 bg-ember/10 px-4 py-3 text-sm text-paper reveal">
          <strong>OpenAI anahtarı yok.</strong> İlanları çözümlemek için
          <code className="mx-1 rounded bg-black/30 px-1">OPENAI_API_KEY</code>
          tanımlanmalı.
        </div>
      )}

      {aiAcik && kaynakSayisi === 0 && (
        <div className="kart space-y-2 border-amber/25 p-4 text-sm text-fog reveal">
          <div className="font-display text-base font-bold text-paper">
            Nasıl çalışır
          </div>
          <p>
            <span className="font-semibold text-paper">1.</span> Telegram botunu
            yük gruplarına ekle — grup mesajları otomatik okunur.
          </p>
          <p>
            <span className="font-semibold text-paper">2.</span> Ayarlar&apos;dan
            yük ilan sitesi adresi veya AI arama sorgusu ekle.
          </p>
          <p>
            <span className="font-semibold text-paper">3.</span> Bir yük
            kaydettiğinde dönüş yükü araması kendiliğinden açılır.
          </p>
        </div>
      )}

      <div className="flex flex-wrap gap-1 rounded-xl border border-white/10 bg-asphalt-2 p-1 reveal reveal-d1">
        {SEKMELER.map((s) => {
          const aktif = s.kod === sekme;
          const rozet =
            s.kod === "YENI"
              ? yeniSayisi
              : s.kod === "DONUS"
                ? donusSayisi
                : s.kod === "SUPHELI"
                  ? supheliSayisi
                  : null;
          return (
            <Link
              key={s.kod}
              href={`/ai/yukler?sekme=${s.kod}`}
              className={`flex-1 rounded-lg px-3 py-2 text-center text-sm font-semibold transition-colors ${
                aktif ? "bg-white/10 text-amber" : "text-fog hover:text-paper"
              }`}
            >
              {s.ad}
              {rozet !== null && rozet > 0 && (
                <span className="ml-1.5 text-xs font-bold text-amber">{rozet}</span>
              )}
            </Link>
          );
        })}
      </div>

      {sekme === "YENI" && (
        <p className="text-xs text-fog reveal">
          Filtre:{" "}
          {[
            tercih.aracTipleri.map((k) => aracTipiAdi(k)).join(" / ") || null,
            tercih.maxTonaj ? `en fazla ${tercih.maxTonaj} ton` : null,
            tercih.sehir || tercih.anaUs || null,
            tercih.rotalar.join(" · ") || null,
            tercih.minUcret ? `en az ${tlYaz(tercih.minUcret)}` : null,
          ]
            .filter(Boolean)
            .join(" · ") || "yok"}
          {" · "}
          <Link href="/ayarlar#ai" className="text-amber">
            değiştir
          </Link>
        </p>
      )}

      {ilanlar.length === 0 ? (
        <div className="bos-durum">
          {sekme === "YENI"
            ? "Şu an yeni ilan yok. Kaynaklar tarandıkça burası dolar."
            : "Bu listede kayıt yok."}
        </div>
      ) : (
        <div className="space-y-3">
          {ilanlar.map((ilan, i) => {
            const fiyat = fiyatGorunumu(ilan);
            return (
            <div
              key={ilan.id}
              className={`kart space-y-3 p-4 sm:p-5 reveal reveal-d${Math.min(i + 1, 6)} ${
                ilan.donusTalebiId ? "border-teal/30" : ""
              }`}
            >
              <div className="flex flex-wrap items-start justify-between gap-2">
                <div className="min-w-0">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="font-display text-lg font-bold text-paper">
                      {ilan.nereden || ilan.cikisIl || "?"} →{" "}
                      {ilan.nereye || ilan.varisIl || "?"}
                    </span>
                    {ilan.donusTalebiId && (
                      <span className="rounded-full border border-teal/40 bg-teal/15 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider text-teal">
                        Dönüş yükü
                      </span>
                    )}
                    {ilan.durum === "ILGILENIYOR" && (
                      <span className="rounded-full border border-amber/40 bg-amber/15 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider text-amber">
                        Takipte
                      </span>
                    )}
                    {ilan.durum === "YUKE_DONDU" && (
                      <span className="rounded-full border border-ok/40 bg-ok/15 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider text-ok">
                        Yüke çevrildi
                      </span>
                    )}
                    {aracBelirsizMi(ilan.aracTipi, ilan.aracTipiKod) && (
                      <span className="rounded-full border border-amber/40 bg-amber/15 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider text-amber">
                        Araç tipi belirsiz
                      </span>
                    )}
                  </div>
                  <div className="mt-1 text-sm text-fog">
                    {[
                      ilan.firmaAdi,
                      ilan.yukTipi,
                      ilan.aracTipi,
                      ilan.tonaj ? `${ilan.tonaj} ton` : null,
                      ilan.yuklemeTarihi ? tarihYaz(ilan.yuklemeTarihi) : null,
                    ]
                      .filter(Boolean)
                      .join(" · ") || "Detay yok"}
                  </div>
                </div>

                {fiyat.ana && (
                  <div className="text-right">
                    <div className="font-display text-xl font-extrabold text-teal">
                      {fiyat.ana}
                    </div>
                    {fiyat.tahmin && (
                      <div className="text-[11px] text-fog">
                        tahmini komple {fiyat.tahmin}
                      </div>
                    )}
                  </div>
                )}
                {fiyat.belirsiz && (
                  <div className="text-xs font-semibold text-amber">
                    fiyat türü belirsiz
                  </div>
                )}
              </div>

              <p className="rounded-lg border border-white/8 bg-white/4 px-3 py-2 text-sm leading-relaxed text-fog">
                {ilan.hamMetin.length > 320
                  ? `${ilan.hamMetin.slice(0, 320)}...`
                  : ilan.hamMetin}
              </p>

              <div className="flex flex-wrap items-center justify-between gap-2 border-t border-white/8 pt-3">
                <div className="text-xs text-fog">
                  {ilan.kaynak?.ad || "Elle eklendi"} · {gecenSure(ilan.createdAt)} ·
                  güven %{ilan.guvenSkoru}
                </div>
                <IlanAksiyonlari
                  ilan={{
                    id: ilan.id,
                    durum: ilan.durum,
                    nereden: ilan.nereden,
                    nereye: ilan.nereye,
                    firmaAdi: ilan.firmaAdi,
                    telefon: ilan.telefon,
                    ucretYazi: ilan.ucret !== null ? kurustanGiris(ilan.ucret) : null,
                  }}
                />
              </div>
            </div>
            );
          })}
        </div>
      )}

      {ilanlar.length > 0 && (
        <div className="flex justify-center">
          <AksiyonButonu
            calistir={eskiIlanlariTemizle}
            etiket="14 günden eski ilanları temizle"
            bekleyenEtiket="Temizleniyor..."
            onay="14 günden eski, işlem yapılmamış ilanlar silinsin mi?"
            sinif="text-xs font-semibold text-fog hover:text-amber"
          />
        </div>
      )}
    </div>
  );
}
