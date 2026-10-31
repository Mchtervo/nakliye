import { sessizKaynagiAc } from "@/app/ai-actions";
import AksiyonButonu from "@/components/AksiyonButonu";
import { sessizKaynaklar } from "@/lib/kaynaklar/verimsizKaynak";

/** Ayarlar: ilan getirmediği için mesajı AI'ye gönderilmeyen gruplar. */
export default async function SessizGruplar() {
  const liste = await sessizKaynaklar().catch(() => []);
  return (
    <div id="sessiz-gruplar" className="border-t border-white/8 pt-3">
      <h3 className="font-display text-base font-bold text-paper">Susturulan gruplar</h3>
      <p className="mb-2 text-sm text-fog">
        Son 7 günde ilan getirmeyen ya da koridor dışı bölgeye ait gruplar. Mesajları 14 gün AI&apos;ye
        gönderilmez, para harcamaz; süre bitince yeniden denenir.
      </p>
      {liste.length === 0 ? (
        <p className="text-sm text-fog">Şu an susturulan grup yok.</p>
      ) : (
        <ul className="space-y-1.5">
          {liste.map((s) => (
            <li key={s.id} className="flex items-center gap-3 rounded-xl bg-white/[0.04] px-3 py-2">
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-semibold text-paper">{s.ad}</p>
                <p className="text-xs text-fog">{s.sebep}</p>
              </div>
              <AksiyonButonu
                calistir={sessizKaynagiAc.bind(null, s.id)}
                etiket="Geri aç"
                bekleyenEtiket="…"
                sinif="shrink-0 rounded-lg border border-white/10 px-2.5 py-1 text-xs font-semibold text-paper hover:bg-white/5"
              />
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
