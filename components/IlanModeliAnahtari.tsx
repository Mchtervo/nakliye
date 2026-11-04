"use client";

import { ilanModeliDegistir } from "@/app/ai-actions";
import AksiyonButonu from "@/components/AksiyonButonu";

/** İlan okuma modeli: EVREN önce (ücretsiz, nano yedekli) ya da yalnız OpenAI nano. */
export default function IlanModeliAnahtari({ evren }: { evren: boolean }) {
  return (
    <div className="space-y-2.5 rounded-2xl border border-white/10 p-3.5">
      <h3 className="font-display text-base font-bold text-paper">İlan okuma modeli</h3>
      <p className="text-sm text-paper">
        Şu an:{" "}
        <strong>{evren ? "EVREN önce (ücretsiz), cevap vermezse OpenAI nano" : "Yalnız OpenAI nano (ücretli, en hızlı)"}</strong>
      </p>
      <p className="text-xs leading-relaxed text-paper/70">
        EVREN ücretsiz ama yavaş ve arada boş döner. Boş ya da hatalı cevapta aynı mesaj otomatik nano&apos;ya gider; kuyrukta 7 dakikadan eski
        mesaj varsa EVREN hiç denenmez. Değişiklik en geç 1 dakikada geçerli olur.
      </p>
      <div className="flex flex-wrap gap-2">
        <AksiyonButonu calistir={() => ilanModeliDegistir("EVREN")} etiket={evren ? "✓ EVREN açık" : "EVREN'i aç"} />
        <AksiyonButonu calistir={() => ilanModeliDegistir("NANO")} etiket={!evren ? "✓ Yalnız nano" : "Yalnız nano kullan"} />
      </div>
    </div>
  );
}
