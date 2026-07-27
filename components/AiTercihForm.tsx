"use client";

import { useActionState } from "react";
import { aiTercihKaydet, type AiSonuc } from "@/app/ai-actions";
import { ARAC_TIPLERI, type AracTipiKodu } from "@/lib/arac";
import { BOLGELER, type BolgeKodu } from "@/lib/bolgeler";

export default function AiTercihForm({
  sehir,
  rotalar,
  minUcretYazi,
  bolgeler,
  aracTipleri,
  maxTonaj,
  anaUs,
  ekIller,
  koridorIller,
  telegramAcik,
  pushAcik,
  telegramUyeAcik,
  waSablon,
  tdmKaraListe,
  tdmGunlukLimit,
}: {
  sehir: string;
  rotalar: string;
  minUcretYazi: string;
  bolgeler: BolgeKodu[];
  aracTipleri: AracTipiKodu[];
  maxTonaj: string;
  anaUs: string;
  ekIller: string;
  koridorIller: string;
  telegramAcik: boolean;
  pushAcik: boolean;
  telegramUyeAcik: boolean;
  waSablon: {
    ad: string;
    firma: string;
    arac: string;
    tonaj: string;
    musaitlik: string;
    tonTercih: string;
    imza: string;
  };
  tdmKaraListe: string;
  tdmGunlukLimit: string;
}) {
  const [durum, aksiyon, bekliyor] = useActionState<AiSonuc, FormData>(
    aiTercihKaydet,
    null
  );

  return (
    <form action={aksiyon} className="space-y-3">
      <div className="space-y-3 rounded-xl border border-amber/20 bg-amber/5 p-3">
        <div className="text-xs font-bold uppercase tracking-wider text-amber">
          Aracım
        </div>
        <div>
          <span className="etiket">Araç tipi</span>
          <div className="mt-1 grid grid-cols-2 gap-1.5">
            {ARAC_TIPLERI.filter((a) => a.kod !== "DIGER").map((a) => (
              <label
                key={a.kod}
                className="flex cursor-pointer items-center gap-2 rounded-xl border border-white/10 bg-white/4 px-2.5 py-2"
              >
                <input
                  type="checkbox"
                  name="aracTipleri"
                  value={a.kod}
                  defaultChecked={aracTipleri.includes(a.kod)}
                  className="h-4.5 w-4.5 rounded accent-[#f0a020]"
                />
                <span className="text-sm font-semibold text-paper">{a.ad}</span>
              </label>
            ))}
          </div>
          <p className="mt-1 text-xs text-fog">
            Tenteli / kapalı kasa seçiliyse frigo, damper, lowbed, kısadorse,
            açık dorse vb. elenir. «açık veya kapalı» geçer. Tipi yazmayan
            ilanlar geçer; kartta sarı uyarı çıkar.
          </p>
        </div>

        <div className="grid grid-cols-2 gap-3">
          <div>
            <label htmlFor="maxTonaj" className="etiket">
              Max tonaj
            </label>
            <input
              id="maxTonaj"
              name="maxTonaj"
              type="text"
              inputMode="numeric"
              placeholder="Örnek: 24"
              defaultValue={maxTonaj}
              className="alan"
            />
          </div>
          <div>
            <label htmlFor="anaUs" className="etiket">
              Ana üs
            </label>
            <input
              id="anaUs"
              name="anaUs"
              type="text"
              placeholder="Örnek: Ankara"
              defaultValue={anaUs}
              className="alan"
            />
          </div>
        </div>
      </div>

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
        <label htmlFor="koridorIller" className="etiket">
          Koridor illeri (çalışma alanı)
        </label>
        <textarea
          id="koridorIller"
          name="koridorIller"
          rows={3}
          placeholder="Ankara, Kırıkkale, Çankırı, Bolu, Düzce, Sakarya, Kocaeli, İstanbul"
          defaultValue={koridorIller}
          className="alan"
        />
        <p className="mt-1 text-xs text-fog">
          HEM çıkış HEM varış bu listede olmalı. Virgülle ayır. Eskişehir /
          Bursa eklemek için listeye yazıp kaydet — kod gerekmez.
        </p>
      </div>

      <div>
        <span className="etiket">Grup keşfi — bölgeler</span>
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
          Sadece Telegram grup araması için. İlan filtresi yukarıdaki
          koridor listesidir.
        </p>
      </div>

      <div>
        <label htmlFor="ekIller" className="etiket">
          Koridora ek iller (kısayol)
        </label>
        <input
          id="ekIller"
          name="ekIller"
          type="text"
          placeholder="Örnek: Eskişehir, Bilecik, Bursa"
          defaultValue={ekIller}
          className="alan"
        />
        <p className="mt-1 text-xs text-fog">
          Koridor alanına yazmak yerine buraya da ekleyebilirsin.
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

      <div className="space-y-3 rounded-xl border border-teal/20 bg-teal/5 p-3">
        <div className="text-xs font-bold uppercase tracking-wider text-teal">
          WhatsApp mesaj şablonu
        </div>
        <p className="text-xs text-fog">
          «Mesaj Hazırla» butonu bu bilgileri kullanır. Sadece butona basınca
          AI çağrılır.
        </p>
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label htmlFor="waAd" className="etiket">
              Adım
            </label>
            <input
              id="waAd"
              name="waAd"
              type="text"
              placeholder="Mertcan"
              defaultValue={waSablon.ad}
              className="alan"
            />
          </div>
          <div>
            <label htmlFor="waFirma" className="etiket">
              Firma
            </label>
            <input
              id="waFirma"
              name="waFirma"
              type="text"
              placeholder="… Nakliyat"
              defaultValue={waSablon.firma}
              className="alan"
            />
          </div>
          <div>
            <label htmlFor="waArac" className="etiket">
              Araç tipim
            </label>
            <input
              id="waArac"
              name="waArac"
              type="text"
              placeholder="tenteli TIR"
              defaultValue={waSablon.arac}
              className="alan"
            />
          </div>
          <div>
            <label htmlFor="waTonaj" className="etiket">
              Tonajım
            </label>
            <input
              id="waTonaj"
              name="waTonaj"
              type="text"
              placeholder="24"
              defaultValue={waSablon.tonaj}
              className="alan"
            />
          </div>
        </div>
        <div>
          <label htmlFor="waMusaitlik" className="etiket">
            Müsaitlik / üs
          </label>
          <input
            id="waMusaitlik"
            name="waMusaitlik"
            type="text"
            placeholder="Ankara merkezliyim, müsaitim"
            defaultValue={waSablon.musaitlik}
            className="alan"
          />
        </div>
        <div>
          <label htmlFor="waTonTercih" className="etiket">
            Ton tercihi
          </label>
          <input
            id="waTonTercih"
            name="waTonTercih"
            type="text"
            placeholder="komple tercih ederim"
            defaultValue={waSablon.tonTercih}
            className="alan"
          />
        </div>
        <div>
          <label htmlFor="waImza" className="etiket">
            İmza (isteğe bağlı)
          </label>
          <input
            id="waImza"
            name="waImza"
            type="text"
            placeholder="İyi çalışmalar"
            defaultValue={waSablon.imza}
            className="alan"
          />
        </div>
        <div>
          <label htmlFor="tdmGunlukLimit" className="etiket">
            Günlük DM limiti
          </label>
          <input
            id="tdmGunlukLimit"
            name="tdmGunlukLimit"
            type="text"
            inputMode="numeric"
            placeholder="5"
            defaultValue={tdmGunlukLimit}
            className="alan"
          />
          <p className="mt-1 text-xs text-fog">
            İlk hafta 5 önerilir (okuyucu hesabı). 1–30. Sorunsuz giderse
            kademeli artır.
          </p>
        </div>
        <div>
          <label htmlFor="tdmKaraListe" className="etiket">
            DM kara liste (telefon / user id)
          </label>
          <textarea
            id="tdmKaraListe"
            name="tdmKaraListe"
            rows={2}
            placeholder="0532..., 05..., telegram user id — virgülle"
            defaultValue={tdmKaraListe}
            className="alan"
          />
          <p className="mt-1 text-xs text-fog">
            Bu numaralara / kullanıcılara Telegram DM asla gitmez. Otomatik
            gönderim yok — her mesajda [Gönder] onayı şart.
          </p>
        </div>
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
