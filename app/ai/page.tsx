import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { aiKapaliMi, aiKullanilabilir } from "@/lib/ai/istemci";
import { tlYaz } from "@/lib/para";

export const dynamic = "force-dynamic";

export default async function AiMerkeziSayfasi() {
  const [yeniIlan, donusEslesme, acikTalep, adayFirma, sonAnaliz, kaynakSayisi] =
    await Promise.all([
      prisma.yukIlani.count({ where: { durum: "YENI" } }),
      prisma.yukIlani.count({
        where: { donusTalebiId: { not: null }, durum: "YENI" },
      }),
      prisma.donusTalebi.count({ where: { aktif: true } }),
      prisma.adayFirma.count({ where: { durum: "YENI" } }),
      prisma.aiAnaliz.findFirst({ orderBy: { tarih: "desc" } }),
      prisma.ilanKaynagi.count({ where: { aktif: true } }),
    ]);

  const enIyiIlan = await prisma.yukIlani.findFirst({
    where: { durum: "YENI", ucret: { not: null } },
    orderBy: [{ ucret: "desc" }],
  });

  const kartlar = [
    {
      href: "/ai/yukler",
      baslik: "Yük Bulucu",
      aciklama: "Telegram grupları, ilan siteleri ve web aramasından toplanan yükler",
      rozet: yeniIlan > 0 ? `${yeniIlan} yeni` : null,
      renk: "text-amber",
    },
    {
      href: "/plan",
      baslik: "Sefer Planlayıcı",
      aciklama: "Ankara'dayım, 3 günlük tur — ilanlardan zincir kur",
      rozet: null,
      renk: "text-teal",
    },
    {
      href: "/ai/donus",
      baslik: "Dönüş Yükü",
      aciklama: "Boş dönmemek için açık talepler ve bulunan eşleşmeler",
      rozet:
        donusEslesme > 0
          ? `${donusEslesme} eşleşme`
          : acikTalep > 0
            ? `${acikTalep} açık talep`
            : null,
      renk: "text-teal",
    },
    {
      href: "/ai/firmalar",
      baslik: "Aday Firmalar",
      aciklama: "OSB'ler ve fabrikalardan çıkarılan potansiyel müşteri listesi",
      rozet: adayFirma > 0 ? `${adayFirma} aday` : null,
      renk: "text-paper",
    },
    {
      href: "/ai/musteriler",
      baslik: "Müşteri Havuzu",
      aciklama: "Yük sahibi / komisyoncu — ilan telefonlarından biriken doğrudan müşteri",
      rozet: null,
      renk: "text-teal",
    },
    {
      href: "/ai/gruplar",
      baslik: "Grup kalite",
      aciklama: "İsabet %, 7g mesaj/ilan, trafik dengesi — çöp grupları gör",
      rozet: null,
      renk: "text-ember",
    },
    {
      href: "/ai/analiz",
      baslik: "Analiz Merkezi",
      aciklama: "Kârlı rota, yakıt, tahsilat ve KDV üzerine günlük değerlendirme",
      rozet: sonAnaliz ? "güncel" : null,
      renk: "text-ok",
    },
  ];

  return (
    <div className="space-y-5">
      <div className="reveal">
        <p className="text-[11px] font-bold uppercase tracking-[0.18em] text-amber">
          Yapay zekâ
        </p>
        <h1 className="font-display text-3xl font-extrabold text-paper sm:text-4xl">
          AI Merkezi
        </h1>
        <p className="mt-1 text-sm text-fog">
          {kaynakSayisi > 0
            ? `${kaynakSayisi} kaynak arka planda taranıyor.`
            : "Henüz kaynak eklenmemiş — Ayarlar'daki AI bölümünden başla."}
        </p>
      </div>

      {aiKapaliMi() ? (
        <div className="rounded-xl border border-amber/30 bg-amber/10 px-4 py-3 text-sm text-paper reveal">
          <strong>AI kapalı (AI_KAPALI=true).</strong> OpenAI çağrıları durduruldu.
        </div>
      ) : (
        !aiKullanilabilir() && (
          <div className="rounded-xl border border-ember/30 bg-ember/10 px-4 py-3 text-sm text-paper reveal">
            <strong>OpenAI anahtarı tanımlı değil.</strong> AI modülleri anahtar
            eklenene kadar boş görünür.
          </div>
        )
      )}

      {enIyiIlan && (
        <section className="kart relative overflow-hidden p-5 reveal reveal-d1">
          <div
            className="pointer-events-none absolute -right-14 -top-16 h-48 w-48 rounded-full opacity-25 blur-3xl"
            style={{ background: "radial-gradient(circle, #2fbf9f, transparent 70%)" }}
          />
          <div className="relative">
            <div className="text-[11px] font-bold uppercase tracking-[0.16em] text-fog">
              En yüksek ücretli açık ilan
            </div>
            <div className="font-display mt-1 text-2xl font-extrabold text-paper">
              {enIyiIlan.nereden || enIyiIlan.cikisIl} →{" "}
              {enIyiIlan.nereye || enIyiIlan.varisIl}
            </div>
            <div className="font-display text-xl font-extrabold text-teal">
              {enIyiIlan.ucret !== null ? tlYaz(enIyiIlan.ucret) : ""}
            </div>
            <Link
              href="/ai/yukler"
              className="btn btn-teal !px-3 !py-2 mt-3 inline-block text-xs"
            >
              İlanlara git
            </Link>
          </div>
        </section>
      )}

      <div className="grid gap-3 sm:grid-cols-2">
        {kartlar.map((k, i) => (
          <Link
            key={k.href}
            href={k.href}
            className={`kart group p-5 transition-colors hover:border-amber/30 reveal reveal-d${i + 1}`}
          >
            <div className="flex items-start justify-between gap-2">
              <h2 className={`font-display text-lg font-bold ${k.renk}`}>
                {k.baslik}
              </h2>
              {k.rozet && (
                <span className="rounded-full border border-white/15 bg-white/5 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider text-fog">
                  {k.rozet}
                </span>
              )}
            </div>
            <p className="mt-1.5 text-sm leading-relaxed text-fog">{k.aciklama}</p>
            <span className="mt-3 inline-block text-sm font-semibold text-amber opacity-0 transition-opacity group-hover:opacity-100">
              Aç →
            </span>
          </Link>
        ))}
      </div>

      {sonAnaliz && (
        <section className="kart space-y-2 p-4 sm:p-5 reveal reveal-d5">
          <div className="text-[11px] font-bold uppercase tracking-[0.14em] text-fog">
            {sonAnaliz.baslik}
          </div>
          <p className="whitespace-pre-line text-sm leading-relaxed text-paper">
            {sonAnaliz.metin.split("\n").slice(0, 3).join("\n")}
          </p>
          <Link
            href="/ai/analiz"
            className="inline-block text-sm font-semibold text-amber hover:underline"
          >
            Tamamını oku →
          </Link>
        </section>
      )}
    </div>
  );
}
