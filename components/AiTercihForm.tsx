"use client";

import { useActionState } from "react";
import { aiTercihKaydet, type AiSonuc } from "@/app/ai-actions";
import { BOLGELER, type BolgeKodu } from "@/lib/bolgeler";

export default function AiTercihForm({
  sehir,
  rotalar,
  minUcretYazi,
  bolgeler,
  telegramAcik,
  pushAcik,
  telegramUyeAcik,
}: {
  sehir: string;
  rotalar: string;
  minUcretYazi: string;
  bolgeler: BolgeKodu[];
  telegramAcik: boolean;
  pushAcik: boolean;
  telegramUyeAcik: boolean;
}) {
  const [durum, aksiyon, bekliyor] = useActionState<AiSonuc, FormData>(
    aiTercihKaydet,
    null
  );

  return (
    <form action={aksiyon} className="space-y-3">
      <div>
        <label htmlFor="sehir" className="etiket">
          Bulunduğun şehir
        </label>
        <input
          id="sehir"
          name="sehir"
          type="text"
          placeholder="Örnek: Ankara"
          defaultValue={sehir}
          className="alan"
        />
        <p className="mt-1 text-xs text-fog">
          Bu şehirden çıkan yükler öncelikli bildirilir.
        </p>
      </div>

      <div>
        <label htmlFor="rotalar" className="etiket">
          Sık çalıştığın rotalar
        </label>
        <input
          id="rotalar"
          name="rotalar"
          type="text"
          placeholder="Ankara-İstanbul, Mersin-Bursa"
          defaultValue={rotalar}
          className="alan"
        />
        <p className="mt-1 text-xs text-fog">
          Virgülle ayır. Tek şehir yazarsan o şehre giden/gelen her yük sayılır.
        </p>
      </div>

      <div>
        <label htmlFor="minUcret" className="etiket">
          En düşük ücret (isteğe bağlı)
        </label>
        <input
          id="minUcret"
          name="minUcret"
          type="text"
          inputMode="decimal"
          placeholder="Örnek: 15.000"
          defaultValue={minUcretYazi}
          className="alan"
        />
        <p className="mt-1 text-xs text-fog">
          Altındaki ilanlar için bildirim gelmez (ekranda yine görünür).
        </p>
      </div>

      <div>
        <span className="etiket">Takip edilecek bölgeler</span>
        <div className="mt-1 grid grid-cols-2 gap-1.5">
          {BOLGELER.map((b) => (
            <label
              key={b.kod}
              className="flex cursor-pointer items-center gap-2 rounded-xl border border-white/10 bg-white/4 px-2.5 py-2"
            >
              <input
                type="checkbox"
                name="bolgeler"
                value={b.kod}
                defaultChecked={bolgeler.includes(b.kod)}
                className="h-4.5 w-4.5 rounded accent-[#f0a020]"
              />
              <span className="text-sm font-semibold text-paper">{b.ad}</span>
            </label>
          ))}
        </div>
        <p className="mt-1 text-xs text-fog">
          Grup araması ve bildirimler bu bölgelere göre yapılır. Hiçbirini
          seçmezsen Türkiye geneli taranır.
        </p>
      </div>

      <div className="space-y-2 rounded-xl border border-white/10 bg-white/4 p-3">
        <label className="flex cursor-pointer items-center gap-3">
          <input
            type="checkbox"
            name="telegramUye"
            value="1"
            defaultChecked={telegramUyeAcik}
            className="h-5 w-5 rounded accent-[#f0a020]"
          />
          <span className="text-sm font-semibold text-paper">
            Telegram gruplarını kendi hesabımla tara
          </span>
        </label>
        <label className="flex cursor-pointer items-center gap-3">
          <input
            type="checkbox"
            name="bildirimTelegram"
            value="1"
            defaultChecked={telegramAcik}
            className="h-5 w-5 rounded accent-[#f0a020]"
          />
          <span className="text-sm font-semibold text-paper">
            Telegram bildirimi
          </span>
        </label>
        <label className="flex cursor-pointer items-center gap-3">
          <input
            type="checkbox"
            name="bildirimPush"
            value="1"
            defaultChecked={pushAcik}
            className="h-5 w-5 rounded accent-[#f0a020]"
          />
          <span className="text-sm font-semibold text-paper">
            Telefon bildirimi (push)
          </span>
        </label>
      </div>

      {durum && "hata" in durum && (
        <div className="rounded-xl border border-ember/30 bg-ember/10 px-3 py-2.5 text-sm font-semibold text-ember">
          {durum.hata}
        </div>
      )}
      {durum && "bilgi" in durum && (
        <div className="rounded-xl border border-ok/30 bg-ok/10 px-3 py-2.5 text-sm font-semibold text-ok">
          {durum.bilgi}
        </div>
      )}

      <button type="submit" disabled={bekliyor} className="btn btn-amber btn-block">
        {bekliyor ? "Kaydediliyor..." : "Tercihleri Kaydet"}
      </button>
    </form>
  );
}
