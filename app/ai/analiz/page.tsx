import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { tlYaz } from "@/lib/para";
import { aiKullanilabilir } from "@/lib/ai/istemci";
import { metrikleriTopla, type AnalizMetrikleri } from "@/lib/ai/gunlukAnaliz";
import { analiziYenile } from "@/app/ai-actions";
import AksiyonButonu from "@/components/AksiyonButonu";

export const dynamic = "force-dynamic";

function Satir({
  etiket,
  deger,
  vurgu,
}: {
  etiket: string;
  deger: string;
  vurgu?: string;
}) {
  return (
    <div className="flex items-baseline justify-between gap-3 border-b border-white/6 py-2 last:border-0">
      <span className="text-sm text-fog">{etiket}</span>
      <span className={`font-display font-bold ${vurgu || "text-paper"}`}>
        {deger}
      </span>
    </div>
  );
}

export default async function AiAnalizSayfasi() {
  const [sonAnaliz, metrikler] = await Promise.all([
    prisma.aiAnaliz.findFirst({ orderBy: { tarih: "desc" } }),
    metrikleriTopla(),
  ]);

  const m: AnalizMetrikleri = metrikler;
  const maddeler = sonAnaliz
    ? sonAnaliz.metin
        .split("\n")
        .map((s) => s.replace(/^[-•*]\s*/, "").trim())
        .filter(Boolean)
    : [];

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-end justify-between gap-3 reveal">
        <div>
          <p className="text-[11px] font-bold uppercase tracking-[0.18em] text-amber">
            Yapay zekâ
          </p>
          <h1 className="font-display text-3xl font-extrabold text-paper sm:text-4xl">
            Analiz Merkezi
          </h1>
          <p className="mt-1 text-sm text-fog">
            {m.donemAdi} rakamları üzerinden günlük değerlendirme.
          </p>
        </div>
        <AksiyonButonu
          calistir={analiziYenile}
          etiket="Yeniden üret"
          bekleyenEtiket="Analiz ediliyor..."
          sinif="btn btn-amber !px-3 !py-2 text-xs sm:text-sm"
        />
      </div>

      {!aiKullanilabilir() && (
        <div className="rounded-xl border border-ember/30 bg-ember/10 px-4 py-3 text-sm text-paper reveal">
          <strong>OpenAI anahtarı yok.</strong> Aşağıdaki rakamlar hesaplanır ama
          yorum üretilemez.
        </div>
      )}

      {sonAnaliz && (
        <section className="kart space-y-3 p-4 sm:p-5 reveal reveal-d1">
          <div className="text-[11px] font-bold uppercase tracking-[0.14em] text-amber">
            {sonAnaliz.baslik}
          </div>
          <ul className="space-y-2">
            {maddeler.map((madde, i) => (
              <li key={i} className="flex gap-2.5 text-sm leading-relaxed text-paper">
                <span className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full bg-amber" />
                {madde}
              </li>
            ))}
          </ul>
        </section>
      )}

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <div className="kart p-4 reveal reveal-d1">
          <div className="text-[11px] font-bold uppercase tracking-wider text-fog">
            Gelir
          </div>
          <div className="mt-1 font-display text-xl font-extrabold text-teal">
            {tlYaz(m.gelirToplam)}
          </div>
        </div>
        <div className="kart p-4 reveal reveal-d2">
          <div className="text-[11px] font-bold uppercase tracking-wider text-fog">
            Gider
          </div>
          <div className="mt-1 font-display text-xl font-extrabold text-ember">
            {tlYaz(m.giderToplam)}
          </div>
        </div>
        <div className="kart p-4 reveal reveal-d3">
          <div className="text-[11px] font-bold uppercase tracking-wider text-fog">
            Net kâr
          </div>
          <div
            className={`mt-1 font-display text-xl font-extrabold ${
              m.netKar >= 0 ? "text-ok" : "text-ember"
            }`}
          >
            {tlYaz(m.netKar)}
          </div>
        </div>
        <div className="kart p-4 reveal reveal-d4">
          <div className="text-[11px] font-bold uppercase tracking-wider text-fog">
            Yakıt / ciro
          </div>
          <div className="mt-1 font-display text-xl font-extrabold text-amber">
            %{m.yakitOran}
          </div>
        </div>
      </div>

      <div className="grid gap-3 lg:grid-cols-2">
        <section className="kart p-4 sm:p-5 reveal reveal-d2">
          <h2 className="font-display mb-2 text-lg font-bold text-paper">
            En çok ciro yapan rotalar
          </h2>
          {m.enKarliRotalar.length === 0 ? (
            <p className="text-sm text-fog">Bu ay kayıtlı sefer yok.</p>
          ) : (
            m.enKarliRotalar.map((r) => (
              <Satir
                key={r.rota}
                etiket={`${r.rota} (${r.sefer} sefer)`}
                deger={tlYaz(r.ciro)}
                vurgu="text-teal"
              />
            ))
          )}
        </section>

        <section className="kart p-4 sm:p-5 reveal reveal-d3">
          <h2 className="font-display mb-2 text-lg font-bold text-paper">
            En çok çalışılan firmalar
          </h2>
          {m.enCokCalisilanFirmalar.length === 0 ? (
            <p className="text-sm text-fog">Bu ay kayıtlı sefer yok.</p>
          ) : (
            m.enCokCalisilanFirmalar.map((f) => (
              <Satir
                key={f.ad}
                etiket={`${f.ad} (${f.sefer} sefer)`}
                deger={tlYaz(f.ciro)}
              />
            ))
          )}
        </section>

        <section className="kart p-4 sm:p-5 reveal reveal-d4">
          <h2 className="font-display mb-2 text-lg font-bold text-paper">
            En büyük gider kalemleri
          </h2>
          {m.enBuyukGiderler.length === 0 ? (
            <p className="text-sm text-fog">Bu ay gider kaydı yok.</p>
          ) : (
            m.enBuyukGiderler.map((g) => (
              <Satir
                key={g.ad}
                etiket={g.ad}
                deger={tlYaz(g.tutar)}
                vurgu="text-ember"
              />
            ))
          )}
        </section>

        <section className="kart p-4 sm:p-5 reveal reveal-d5">
          <h2 className="font-display mb-2 text-lg font-bold text-paper">
            Nakit ve vergi
          </h2>
          <Satir etiket="Kasa bakiyesi" deger={tlYaz(m.kasaBakiye)} />
          <Satir
            etiket="Bekleyen alacak"
            deger={tlYaz(m.bekleyenAlacak)}
            vurgu="text-amber"
          />
          <Satir
            etiket="Bu ay ödenecek KDV"
            deger={tlYaz(m.odenecekKdv)}
            vurgu="text-amber"
          />
          <Satir
            etiket="Son 24 saatte bulunan ilan"
            deger={String(m.yeniIlanSayisi)}
          />
        </section>
      </div>

      {m.geciktiAlacaklar.length > 0 && (
        <section className="kart space-y-2 border-amber/25 p-4 sm:p-5 reveal reveal-d6">
          <h2 className="font-display text-lg font-bold text-amber">
            30 günü geçen alacaklar
          </h2>
          {m.geciktiAlacaklar.map((a, i) => (
            <Satir
              key={`${a.firma}-${i}`}
              etiket={`${a.firma} · ${a.gun} gün`}
              deger={tlYaz(a.kalan)}
              vurgu="text-ember"
            />
          ))}
          <Link
            href="/para?sekme=cari"
            className="inline-block pt-1 text-sm font-semibold text-amber hover:underline"
          >
            Cari hesaplara git →
          </Link>
        </section>
      )}
    </div>
  );
}
