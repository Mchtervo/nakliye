import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { kurustanGiris, tlYaz } from "@/lib/para";
import { aiTercihleriOku } from "@/lib/ayarlar";
import { aiKapaliMi, aiKullanilabilir } from "@/lib/ai/istemci";
import { aracTipiAdi } from "@/lib/arac";
import { SUPHE_SINIRI, tercihKosulu } from "@/lib/kaynaklar/filtre";
import { eskiIlanlariTemizle, simdiTara } from "@/app/ai-actions";
import AksiyonButonu from "@/components/AksiyonButonu";
import IlanKart from "@/components/IlanKart";

export const dynamic = "force-dynamic";

const SEKMELER = [
  { kod: "YENI", ad: "Yeni" },
  { kod: "ILGILENIYOR", ad: "Takipte" },
  { kod: "DONUS", ad: "Dönüş" },
  { kod: "SUPHELI", ad: "Şüpheli" },
  { kod: "HEPSI", ad: "Hepsi" },
] as const;

const DORT_SAAT_MS = 4 * 60 * 60 * 1000;

/** Taze + güven + fiyat belli → üstte. */
function siralamaSkoru(ilan: {
  createdAt: Date;
  guvenSkoru: number;
  ucret: number | null;
  fiyatTon: number | null;
}): number {
  const saat = (Date.now() - ilan.createdAt.getTime()) / 3_600_000;
  const taze = Math.max(0, 36 - saat); // 0–36
  const fiyat =
    (ilan.ucret !== null && ilan.ucret > 0) ||
    (ilan.fiyatTon !== null && ilan.fiyatTon > 0)
      ? 28
      : 0;
  const guvenBonus = ilan.guvenSkoru >= 70 ? 18 : ilan.guvenSkoru >= 50 ? 8 : 0;
  return ilan.guvenSkoru + taze + fiyat + guvenBonus;
}

function iyiIsMi(ilan: {
  createdAt: Date;
  guvenSkoru: number;
  ucret: number | null;
  fiyatTon: number | null;
}): boolean {
  const taze = Date.now() - ilan.createdAt.getTime() < DORT_SAAT_MS;
  const fiyatVar =
    (ilan.ucret !== null && ilan.ucret > 0) ||
    (ilan.fiyatTon !== null && ilan.fiyatTon > 0);
  return taze && ilan.guvenSkoru >= 70 && fiyatVar;
}

export default async function AiYuklerSayfasi({
  searchParams,
}: {
  searchParams: Promise<{ sekme?: string; id?: string }>;
}) {
  const sp = await searchParams;
  const sekme = SEKMELER.some((s) => s.kod === sp.sekme)
    ? (sp.sekme as string)
    : "YENI";
  const odakId = Number(sp.id);
  const odak =
    Number.isInteger(odakId) && odakId > 0 ? odakId : null;

  const tercih = await aiTercihleriOku();

  const filtre =
    sekme === "SUPHELI"
      ? { guvenSkoru: { lt: SUPHE_SINIRI } }
      : sekme === "HEPSI"
        ? { guvenSkoru: { gte: SUPHE_SINIRI } }
        : sekme === "DONUS"
          ? { donusTalebiId: { not: null }, guvenSkoru: { gte: SUPHE_SINIRI } }
          : sekme === "YENI"
            ? { durum: "YENI", ...tercihKosulu(tercih) }
            : sekme === "ILGILENIYOR"
              ? {
                  durum: {
                    in: [
                      "ILGILENIYOR",
                      "ILETISIME_GECILDI",
                      "PAZARLIKTA",
                      "CEVAP_YOK",
                    ],
                  },
                  guvenSkoru: { gte: SUPHE_SINIRI },
                }
              : { durum: sekme, guvenSkoru: { gte: SUPHE_SINIRI } };

  const [ilanlar, kaynakSayisi, yeniSayisi, donusSayisi, supheliSayisi] =
    await Promise.all([
      prisma.yukIlani.findMany({
        where: filtre,
        orderBy: [{ createdAt: "desc" }],
        take: 80,
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

  let sirali = [...ilanlar].sort(
    (a, b) => siralamaSkoru(b) - siralamaSkoru(a)
  );
  if (odak) {
    const idx = sirali.findIndex((i) => i.id === odak);
    if (idx > 0) {
      sirali = [sirali[idx], ...sirali.filter((i) => i.id !== odak)];
    }
  }

  const iyiSayisi = sirali.filter(iyiIsMi).length;
  const simdi = Date.now();

  return (
    <div className="mx-auto max-w-lg space-y-4">
      <div className="flex flex-wrap items-end justify-between gap-3 reveal">
        <div>
          <p className="text-[11px] font-bold uppercase tracking-[0.18em] text-amber">
            Yük
          </p>
          <h1 className="font-display text-3xl font-extrabold text-paper">
            Bulucu
          </h1>
          {iyiSayisi > 0 ? (
            <p className="mt-1 text-sm font-semibold text-teal">
              Bugün {iyiSayisi} iyi iş
            </p>
          ) : (
            <p className="mt-1 text-sm text-fog">
              {yeniSayisi > 0
                ? `${yeniSayisi} yeni ilan`
                : kaynakSayisi > 0
                  ? "Şu an öne çıkan yok"
                  : "Kaynak yok — Ayarlar"}
            </p>
          )}
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <AksiyonButonu
            calistir={simdiTara}
            etiket="Tara"
            bekleyenEtiket="..."
            sinif="btn btn-amber !px-3 !py-2 text-xs sm:text-sm"
          />
          <Link
            href="/ayarlar#ai"
            className="btn btn-ghost !px-3 !py-2 text-xs sm:text-sm"
          >
            Ayarlar
          </Link>
        </div>
      </div>

      {killSwitch && (
        <div className="rounded-xl border border-amber/30 bg-amber/10 px-3 py-2.5 text-sm text-paper">
          <strong>AI kapalı.</strong> Tarama devam eder; kuyruk birikir.
        </div>
      )}

      {!killSwitch && !anahtarVar && (
        <div className="rounded-xl border border-ember/30 bg-ember/10 px-3 py-2.5 text-sm text-paper">
          <strong>OpenAI anahtarı yok.</strong>
        </div>
      )}

      {aiAcik && kaynakSayisi === 0 && (
        <div className="rounded-xl border border-white/10 bg-white/4 px-3 py-2.5 text-sm text-fog">
          Telegram botunu gruba ekle veya Ayarlar&apos;dan kaynak ekle.
        </div>
      )}

      <div className="flex gap-1 overflow-x-auto rounded-xl border border-white/10 bg-asphalt-2 p-1">
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
              className={`shrink-0 rounded-lg px-3 py-2.5 text-center text-sm font-semibold ${
                aktif ? "bg-white/10 text-amber" : "text-fog hover:text-paper"
              }`}
            >
              {s.ad}
              {rozet !== null && rozet > 0 && (
                <span className="ml-1 text-xs font-bold text-amber">{rozet}</span>
              )}
            </Link>
          );
        })}
      </div>

      {sekme === "YENI" && (
        <p className="text-xs text-fog">
          {[
            tercih.aracTipleri.map((k) => aracTipiAdi(k)).join(" / ") || null,
            tercih.maxTonaj ? `≤${tercih.maxTonaj}t` : null,
            tercih.minUcret ? `≥${tlYaz(tercih.minUcret)}` : null,
          ]
            .filter(Boolean)
            .join(" · ") || "filtre yok"}
          {" · "}
          <Link href="/ayarlar#ai" className="text-amber">
            değiştir
          </Link>
        </p>
      )}

      {sirali.length === 0 ? (
        <div className="bos-durum">
          {sekme === "YENI"
            ? "Şu an yeni ilan yok."
            : "Bu listede kayıt yok."}
        </div>
      ) : (
        <div className="space-y-3">
          {sirali.map((ilan) => {
            const yasMs = simdi - ilan.createdAt.getTime();
            return (
              <IlanKart
                key={ilan.id}
                ilan={{
                  id: ilan.id,
                  durum: ilan.durum,
                  nereden: ilan.nereden,
                  nereye: ilan.nereye,
                  cikisIl: ilan.cikisIl,
                  varisIl: ilan.varisIl,
                  tonaj: ilan.tonaj,
                  aracTipi: ilan.aracTipi,
                  aracTipiKod: ilan.aracTipiKod,
                  ucret: ilan.ucret,
                  fiyatTon: ilan.fiyatTon,
                  fiyatBelirsiz: ilan.fiyatBelirsiz,
                  firmaAdi: ilan.firmaAdi,
                  telefon: ilan.telefon,
                  gonderenUserId: ilan.gonderenUserId,
                  guvenSkoru: ilan.guvenSkoru,
                  hamMetin: ilan.hamMetin,
                  createdAt: ilan.createdAt,
                  donusTalebiId: ilan.donusTalebiId,
                  kaynakAd: ilan.kaynak?.ad ?? null,
                  ucretYazi:
                    ilan.ucret !== null ? kurustanGiris(ilan.ucret) : null,
                  odakli: odak === ilan.id,
                  soluk: yasMs > DORT_SAAT_MS,
                  vurgulu: iyiIsMi(ilan),
                }}
              />
            );
          })}
        </div>
      )}

      {sirali.length > 0 && (
        <div className="flex justify-center pb-4">
          <AksiyonButonu
            calistir={eskiIlanlariTemizle}
            etiket="14 günden eskileri temizle"
            bekleyenEtiket="..."
            onay="14 günden eski, işlem yapılmamış ilanlar silinsin mi?"
            sinif="text-xs font-semibold text-fog hover:text-amber"
          />
        </div>
      )}
    </div>
  );
}
