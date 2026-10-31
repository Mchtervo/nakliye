import { bakimYapildi } from "@/app/actions";
import AksiyonButonu from "@/components/AksiyonButonu";
import AracKmFormu from "@/components/AracKmFormu";
import { aiTercihleriOku } from "@/lib/ayarlar";
import { kmOzeti } from "@/lib/seferKm";

const km = (n: number) => `${n.toLocaleString("tr-TR")} km`;

/**
 * Ana sayfa: bu ay ve toplam km (seferlerden), tahmini gösterge ve bakıma
 * kalan km. Gösterge elle girilir; sonraki seferler üstüne eklenir.
 */
export default async function AracKmKarti() {
  const tercih = await aiTercihleriOku();
  const o = await kmOzeti(new Date(), tercih.anaUs || "Ankara").catch(() => null);
  if (!o) return null;

  const aralik = o.arac?.bakimAralikKm ?? null;
  const gecen = aralik && o.bakimaKalan !== null ? aralik - o.bakimaKalan : null;
  const oran = aralik && gecen !== null ? Math.min(1, Math.max(0, gecen / aralik)) : null;
  const renk =
    o.bakimaKalan === null ? "bg-white/30" : o.bakimaKalan <= 0 ? "bg-ember" : o.bakimaKalan <= 1000 ? "bg-amber" : "bg-teal";
  const ayarEksik = !o.arac?.kmSayac || !aralik || o.arac.sonBakimKm == null;

  return (
    <section id="km" className="kart space-y-4 p-4 sm:p-5 reveal">
      <div>
        <p className="text-[11px] font-bold uppercase tracking-[0.14em] text-amber">Araç ve kilometre</p>
        <h2 className="font-display text-xl font-bold">
          {o.bakimaKalan === null
            ? "Kilometre"
            : o.bakimaKalan <= 0
              ? `Bakım ${km(-o.bakimaKalan)} geçti`
              : `Bakıma ${km(o.bakimaKalan)} kaldı`}
        </h2>
      </div>

      <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
        <div className="rounded-xl bg-white/[0.04] p-3">
          <p className="text-xs text-fog">Bu ay</p>
          <p className="font-display text-lg font-bold tabular-nums">{km(o.buAy.toplam)}</p>
          <p className="text-[11px] text-fog">
            {km(o.buAy.yuklu)} yüklü · {km(o.buAy.bos)} boş
          </p>
        </div>
        <div className="rounded-xl bg-white/[0.04] p-3">
          <p className="text-xs text-fog">Bugüne kadar</p>
          <p className="font-display text-lg font-bold tabular-nums">{km(o.hepsi.toplam)}</p>
          <p className="text-[11px] text-fog">
            {km(o.hepsi.yuklu)} yüklü · {km(o.hepsi.bos)} boş
          </p>
        </div>
        <div className="col-span-2 rounded-xl bg-white/[0.04] p-3 sm:col-span-1">
          <p className="text-xs text-fog">Gösterge (tahmini)</p>
          <p className="font-display text-lg font-bold tabular-nums">
            {o.tahminiSayac !== null ? km(o.tahminiSayac) : "—"}
          </p>
          <p className="text-[11px] text-fog">
            {o.arac?.kmTarih
              ? `${o.arac.kmTarih.toLocaleDateString("tr-TR")} girişinden + seferler`
              : "Göstergeyi bir kez gir"}
          </p>
        </div>
      </div>

      {oran !== null && o.sonrakiBakimKm !== null && (
        <div className="space-y-1.5">
          <div className="h-2 overflow-hidden rounded-full bg-white/10">
            <div className={`h-full rounded-full ${renk}`} style={{ width: `${Math.round(oran * 100)}%` }} />
          </div>
          <div className="flex items-center justify-between gap-2 text-xs text-fog">
            <span>Sonraki bakım: {km(o.sonrakiBakimKm)}</span>
            <AksiyonButonu
              calistir={bakimYapildi}
              etiket="Bakım yapıldı"
              bekleyenEtiket="Kaydediliyor…"
              sinif="rounded-lg border border-white/10 px-2.5 py-1 text-xs font-semibold text-paper hover:bg-white/5"
            />
          </div>
        </div>
      )}

      {o.bilinmeyenSefer > 0 && (
        <p className="text-xs text-fog">
          {o.bilinmeyenSefer} seferin yeri tanınmadı, km&apos;si sayılmadı — seferi düzenleyip km yazabilirsin.
        </p>
      )}

      <AracKmFormu
        ilkAcik={ayarEksik}
        kmSayac={o.tahminiSayac ?? o.arac?.kmSayac ?? null}
        bakimAralikKm={aralik}
        sonBakimKm={o.arac?.sonBakimKm ?? null}
      />
    </section>
  );
}
