import Link from "next/link";
import { cikisYap } from "@/app/auth-actions";
import SifreDegistirForm from "@/components/SifreDegistirForm";
import HizliAraForm from "@/components/HizliAraForm";
import AiTercihForm from "@/components/AiTercihForm";
import YenidenIsleButonu from "@/components/YenidenIsleButonu";
import KaynakForm from "@/components/KaynakForm";
import PushIzinButonu from "@/components/PushIzinButonu";
import AksiyonButonu from "@/components/AksiyonButonu";
import { prisma } from "@/lib/prisma";
import { aiTercihleriOku } from "@/lib/ayarlar";
import { aiKullanilabilir } from "@/lib/ai/istemci";
import { telegramKullanilabilir } from "@/lib/bildirim/telegram";
import { pushAcikAnahtar } from "@/lib/bildirim/push";
import { kurustanGiris, tarihYaz } from "@/lib/para";
import { KAYNAK_TUR_ADLARI, type KaynakTuru } from "@/lib/kaynaklar/tip";
import {
  TELEGRAM_UYE,
  grupDurumlari,
  telegramUyeKullanilabilir,
} from "@/lib/kaynaklar/telegramUye";
import { gecenSure } from "@/lib/ilanGorunum";
import {
  kaynakDurumDegistir,
  kaynakSil,
  kaynakTakibeAl,
} from "@/app/ai-actions";
import { elemeSayaclariOku } from "@/lib/kaynaklar/elemeSayac";
import { aiMaliyetOzeti } from "@/lib/ai/maliyetOzeti";
import AiMaliyetPaneli from "@/components/AiMaliyetPaneli";

function bugunAy(): string {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
}

export const dynamic = "force-dynamic";

function DurumRozeti({ tamam, ad }: { tamam: boolean; ad: string }) {
  return (
    <span
      className={`rounded-full border px-2.5 py-1 text-[11px] font-bold uppercase tracking-wider ${
        tamam
          ? "border-ok/35 bg-ok/12 text-ok"
          : "border-white/15 bg-white/5 text-fog"
      }`}
    >
      {ad} {tamam ? "hazır" : "yok"}
    </span>
  );
}

export default async function AyarlarSayfasi() {
  const ay = bugunAy();

  const [hizliAra, tercih, tumKaynaklar, bekleyenMesaj, gruplar, maliyet, eleme] =
    await Promise.all([
      prisma.ayar.findUnique({ where: { anahtar: "hizli_ara_telefon" } }),
      aiTercihleriOku(),
      prisma.ilanKaynagi.findMany({ orderBy: [{ tur: "asc" }, { ad: "asc" }] }),
      prisma.hamMesaj.count({ where: { islendi: false } }),
      grupDurumlari(),
      aiMaliyetOzeti(),
      elemeSayaclariOku(),
    ]);

  const kaynaklar = tumKaynaklar.filter((k) => k.tur !== TELEGRAM_UYE);
  const takipteki = gruplar.filter((g) => g.durum === "AKTIF" && g.aktif);
  const adaylar = gruplar
    .filter((g) => g.durum === "ADAY")
    .sort((a, b) => (b.uyeSayisi ?? 0) - (a.uyeSayisi ?? 0));
  const takipEdilmiyor = gruplar.filter(
    (g) => g.durum === "PASIF" || (g.durum === "AKTIF" && !g.aktif)
  );

  return (
    <div className="mx-auto max-w-lg space-y-5">
      <div className="reveal">
        <p className="text-[11px] font-bold uppercase tracking-[0.18em] text-amber">
          Sistem
        </p>
        <h1 className="font-display text-3xl font-extrabold text-paper">Ayarlar</h1>
      </div>

      <section id="ai" className="kart space-y-4 border-amber/20 p-4 sm:p-5 reveal reveal-d1">
        <div>
          <h2 className="font-display text-lg font-bold text-paper">
            Yapay zekâ
          </h2>
          <p className="text-sm text-fog">
            Yük bulucu, dönüş yükü ve bildirim tercihleri.
          </p>
        </div>

        <div className="flex flex-wrap gap-2">
          <DurumRozeti tamam={aiKullanilabilir()} ad="OpenAI" />
          <DurumRozeti tamam={telegramKullanilabilir()} ad="Telegram botu" />
          <DurumRozeti
            tamam={telegramUyeKullanilabilir()}
            ad="Telegram hesabı"
          />
          <DurumRozeti
            tamam={Boolean(tercih.telegramChatId)}
            ad="Telegram bağlantısı"
          />
          <DurumRozeti tamam={Boolean(pushAcikAnahtar())} ad="Push" />
        </div>

        {!tercih.telegramChatId && telegramKullanilabilir() && (
          <p className="rounded-xl border border-amber/25 bg-amber/10 px-3 py-2.5 text-sm text-paper">
            Telegram&apos;da bota özelden <strong>/baglan</strong> yaz — bildirimler
            oraya gelmeye başlasın.
          </p>
        )}

        <AiTercihForm
          sehir={tercih.sehir || ""}
          rotalar={tercih.rotalar.join(", ")}
          minUcretYazi={tercih.minUcret ? kurustanGiris(tercih.minUcret) : ""}
          bolgeler={tercih.bolgeler}
          aracTipleri={tercih.aracTipleri}
          maxTonaj={tercih.maxTonaj ? String(tercih.maxTonaj) : ""}
          anaUs={tercih.anaUs || ""}
          ekIller={tercih.ekIller.join(", ")}
          koridorIller={tercih.koridorIller.join(", ")}
          telegramAcik={tercih.telegramAcik}
          pushAcik={tercih.pushAcik}
          telegramUyeAcik={tercih.telegramUyeAcik}
          waSablon={tercih.waSablon}
          tdmKaraListe={tercih.tdmKaraListe}
          tdmGunlukLimit={String(tercih.tdmGunlukLimit)}
          autoDeploy={tercih.autoDeploy}
        />

        <YenidenIsleButonu />

        <AiMaliyetPaneli ozet={maliyet} />

        <div className="border-t border-white/8 pt-3">
          <h3 className="font-display text-base font-bold text-paper">
            Telefon bildirimi
          </h3>
          <p className="mb-2 text-sm text-fog">
            Uygulama kapalıyken de yeni yük bildirimi gelsin.
          </p>
          <PushIzinButonu acikAnahtar={pushAcikAnahtar()} />
        </div>
      </section>

      <section className="kart space-y-4 p-4 sm:p-5 reveal reveal-d2">
        <div>
          <h2 className="font-display text-lg font-bold text-paper">
            Telegram grupları
          </h2>
          <p className="text-sm text-fog">
            Üye olduğun uygun gruplar kendiliğinden takibe alınır. Aday
            gruplara sen katılırsın; katıldıktan sonra 5 dakika içinde
            takibe geçerler.
          </p>
        </div>

        {!telegramUyeKullanilabilir() ? (
          <p className="rounded-xl border border-amber/25 bg-amber/10 px-3 py-2.5 text-sm text-paper">
            Telegram hesabı bağlı değil. Bilgisayarda{" "}
            <strong>npm run telegram:oturum</strong> çalıştırıp çıkan{" "}
            <strong>TELEGRAM_SESSION</strong> anahtarını Netlify&apos;a ekle.
          </p>
        ) : (
          <div className="flex flex-wrap gap-2 text-xs font-semibold">
            <span className="rounded-full border border-ok/35 bg-ok/12 px-2.5 py-1 text-ok">
              {takipteki.length} takipte
            </span>
            <span className="rounded-full border border-white/15 bg-white/5 px-2.5 py-1 text-fog">
              {adaylar.length} aday
            </span>
            <span className="rounded-full border border-white/15 bg-white/5 px-2.5 py-1 text-fog">
              {takipEdilmiyor.length} takip edilmiyor
            </span>
            <span className="rounded-full border border-white/15 bg-white/5 px-2.5 py-1 text-fog">
              {bekleyenMesaj} mesaj sırada
            </span>
          </div>
        )}

        {Object.keys(eleme).length > 0 && (
          <p className="rounded-xl border border-white/10 bg-white/4 px-3 py-2 text-xs text-fog">
            Bugün ön filtre:{" "}
            {Object.entries(eleme)
              .sort((a, b) => b[1] - a[1])
              .map(([k, v]) => `${k}=${v}`)
              .join(" · ")}
          </p>
        )}

        {(
          [
            { baslik: "Takipte", liste: takipteki, limit: 25 },
            { baslik: "Aday", liste: adaylar, limit: 20 },
            { baslik: "Takip edilmiyor", liste: takipEdilmiyor, limit: 30 },
          ] as const
        ).map((bolum) =>
          bolum.liste.length === 0 ? null : (
            <div key={bolum.baslik} className="space-y-1.5">
              <h3 className="text-[11px] font-bold uppercase tracking-wider text-fog">
                {bolum.baslik} ({bolum.liste.length})
              </h3>
              {bolum.liste.slice(0, bolum.limit).map((g) => (
                <div
                  key={g.id}
                  className="rounded-xl border border-white/10 bg-white/4 px-3 py-2"
                >
                  <div className="flex items-center justify-between gap-2">
                    <div className="min-w-0">
                      <div className="truncate text-sm font-semibold text-paper">
                        {g.ad}
                        {g.kullaniciAdi ? (
                          <span className="ml-1 font-normal text-fog">
                            @{g.kullaniciAdi}
                          </span>
                        ) : null}
                      </div>
                      <div className="text-xs text-fog">
                        {g.durum === "ADAY"
                          ? [
                              "Aday",
                              g.uyeSayisi ? `${g.uyeSayisi} üye` : null,
                            ]
                              .filter(Boolean)
                              .join(" · ")
                          : [
                              `${g.takipGun}g takip`,
                              `${g.mesajToplam} mesaj`,
                              `${g.ilanAdedi} ilan`,
                              g.sonIlan
                                ? `son ilan: ${gecenSure(g.sonIlan)}`
                                : "son ilan: yok",
                              g.sonTarama
                                ? `okuma: ${gecenSure(g.sonTarama)}`
                                : null,
                              `çekilen bugün: ${g.cekilenBugun}`,
                              g.bekleyen > 0 ? `${g.bekleyen} sırada` : null,
                            ]
                              .filter(Boolean)
                              .join(" · ")}
                      </div>
                      <div className="mt-0.5 text-[11px] text-amber/90">
                        {g.teshis}
                      </div>
                    </div>
                    <div className="flex shrink-0 items-center gap-1">
                      {(g.durum === "ADAY" ||
                        g.durum === "PASIF" ||
                        !g.aktif) && (
                        <AksiyonButonu
                          calistir={kaynakTakibeAl.bind(null, g.id)}
                          etiket="Takibe al"
                          bekleyenEtiket="..."
                          sinif="rounded-lg border border-ok/30 px-2.5 py-1.5 text-xs font-semibold text-ok hover:bg-ok/10"
                        />
                      )}
                      {g.kullaniciAdi && (
                        <a
                          href={`https://t.me/${g.kullaniciAdi}`}
                          target="_blank"
                          rel="noreferrer"
                          className="rounded-lg border border-white/15 px-2.5 py-1.5 text-xs font-semibold text-paper hover:bg-white/8"
                        >
                          Aç
                        </a>
                      )}
                      <AksiyonButonu
                        calistir={kaynakSil.bind(null, g.id)}
                        etiket="Sil"
                        bekleyenEtiket="..."
                        onay={`${g.ad} listeden çıkarılsın mı?`}
                        sinif="rounded-lg px-2.5 py-1.5 text-xs font-semibold text-ember/90 hover:bg-ember/10"
                      />
                    </div>
                  </div>
                  {(g.sonHata || Object.keys(g.elenenBugun).length > 0) &&
                    g.durum === "AKTIF" &&
                    g.aktif && (
                      <p className="mt-1.5 rounded-lg border border-white/10 bg-white/4 px-2 py-1 text-xs text-fog">
                        {g.sonHata
                          ? g.sonHata.slice(0, 140)
                          : `Eleme: ${Object.entries(g.elenenBugun)
                              .map(([k, v]) => `${k}=${v}`)
                              .join(" · ")}`}
                      </p>
                    )}
                </div>
              ))}
              {bolum.liste.length > bolum.limit && (
                <p className="text-xs text-fog">
                  …ve {bolum.liste.length - bolum.limit} daha.
                </p>
              )}
            </div>
          )
        )}
      </section>

      <section className="kart space-y-4 p-4 sm:p-5 reveal reveal-d3">
        <div>
          <h2 className="font-display text-lg font-bold text-paper">
            Diğer yük kaynakları
          </h2>
          <p className="text-sm text-fog">
            İlan siteleri, AI web araması ve bot eklediğin gruplar.
          </p>
        </div>

        {kaynaklar.length === 0 ? (
          <p className="rounded-xl border border-dashed border-white/12 px-3 py-2.5 text-sm text-fog">
            Henüz kaynak yok.
          </p>
        ) : (
          <div className="space-y-2">
            {kaynaklar.map((k) => (
              <div
                key={k.id}
                className="rounded-xl border border-white/10 bg-white/4 p-3"
              >
                <div className="flex flex-wrap items-start justify-between gap-2">
                  <div className="min-w-0">
                    <div className="font-semibold text-paper">{k.ad}</div>
                    <div className="truncate text-xs text-fog">
                      {KAYNAK_TUR_ADLARI[k.tur as KaynakTuru] || k.tur} ·{" "}
                      {k.bulunanAdet} ilan
                      {k.sonTarama ? ` · ${tarihYaz(k.sonTarama)}` : " · hiç taranmadı"}
                    </div>
                  </div>
                  <div className="flex shrink-0 items-center gap-1">
                    <AksiyonButonu
                      calistir={kaynakDurumDegistir.bind(null, k.id)}
                      etiket={k.aktif ? "Duraklat" : "Başlat"}
                      bekleyenEtiket="..."
                      sinif={`rounded-lg border px-2.5 py-1.5 text-xs font-semibold ${
                        k.aktif
                          ? "border-ok/35 text-ok hover:bg-ok/10"
                          : "border-white/20 text-fog hover:text-paper"
                      }`}
                    />
                    <AksiyonButonu
                      calistir={kaynakSil.bind(null, k.id)}
                      etiket="Sil"
                      bekleyenEtiket="..."
                      onay={`${k.ad} kaynağı silinsin mi?`}
                      sinif="rounded-lg px-2.5 py-1.5 text-xs font-semibold text-ember/90 hover:bg-ember/10"
                    />
                  </div>
                </div>
                {k.sonHata && (
                  <p className="mt-2 rounded-lg border border-ember/25 bg-ember/10 px-2 py-1 text-xs text-ember">
                    {k.sonHata.slice(0, 160)}
                  </p>
                )}
              </div>
            ))}
          </div>
        )}

        <div className="border-t border-white/8 pt-3">
          <KaynakForm />
        </div>
      </section>

      <section className="kart space-y-3 p-4 sm:p-5 reveal reveal-d4">
        <h2 className="font-display text-lg font-bold text-paper">Hızlı ara</h2>
        <p className="text-sm text-fog">
          Ana ekrandaki Ara butonu bu numarayı açar (eş, ortak, ofis…).
        </p>
        <HizliAraForm baslangic={hizliAra?.deger || ""} />
      </section>

      <section className="kart space-y-3 p-4 sm:p-5 reveal reveal-d5">
        <h2 className="font-display text-lg font-bold text-paper">Excel döküm</h2>
        <p className="text-sm text-fog">
          Seçili ayın yük, gider ve özetini Excel olarak indir.
        </p>
        <a href={`/api/excel?ay=${ay}`} className="btn btn-teal inline-flex">
          Bu ayı Excel indir
        </a>
        <Link href="/raporlar" className="block text-sm text-fog hover:text-amber">
          Başka ay için önce Raporlar&apos;dan ay seç → sonra buraya dön
        </Link>
      </section>

      <section className="kart space-y-3 p-4 sm:p-5 reveal reveal-d6">
        <h2 className="font-display text-lg font-bold text-paper">Yedekle</h2>
        <p className="text-sm text-fog">
          Tüm veritabanı + fiş fotoğrafları tek ZIP. Güvenli bir yere kaydet
          (USB, Drive, WhatsApp Kendine Gönder).
        </p>
        <a href="/api/yedek" className="btn btn-amber inline-flex">
          Yedek ZIP indir
        </a>
      </section>

      <section className="kart-paper space-y-3 p-4 sm:p-5 reveal reveal-d6">
        <h2 className="font-display text-lg font-bold text-ink">Şifre değiştir</h2>
        <SifreDegistirForm />
      </section>

      <section className="kart space-y-3 p-4 sm:p-5 reveal reveal-d6">
        <h2 className="font-display text-lg font-bold text-paper">Oturum</h2>
        <form action={cikisYap}>
          <button type="submit" className="btn btn-ghost">
            Çıkış Yap
          </button>
        </form>
      </section>
    </div>
  );
}
