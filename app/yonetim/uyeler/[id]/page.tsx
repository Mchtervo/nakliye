import { notFound } from "next/navigation";
import FirmaAvatar from "@/components/kasa/FirmaAvatar";
import YonetimKabuk from "@/components/yonetim/YonetimKabuk";
import { UyeIslemleri } from "@/components/yonetim/YonetimIslemleri";
import { aracEtiketi } from "@/lib/aracTip";
import { anaPrisma } from "@/lib/prismaAna";
import { telefonGoster, telefonTelHref } from "@/lib/telefon";
import { yoneticiSayfasi } from "@/lib/yetki";
import { ISLEM_ADI, dkOnce } from "@/lib/yonetimVeri";

export const dynamic = "force-dynamic";

const tarih = (d: Date) => d.toLocaleDateString("tr-TR", { day: "numeric", month: "long", year: "numeric" });

/** Üye ayrıntısı: hesap, kurulum, araç özeti ve yönetici işlemleri. Defter / finans gösterilmez. */
export default async function YonetimUyeDetay({ params }: { params: Promise<{ id: string }> }) {
  await yoneticiSayfasi();
  const id = Number((await params).id);
  if (!Number.isInteger(id) || id <= 0) notFound();
  const u = await anaPrisma.uye.findUnique({ where: { id } });
  if (!u) notFound();
  const [kayitlar, sikayet] = await Promise.all([
    anaPrisma.yonetimKaydi.findMany({ where: { uyeId: id }, orderBy: { id: "desc" }, take: 10 }),
    anaPrisma.ilanSikayet.count({ where: { uyeId: id } }),
  ]);
  const t = (u.kurulumTaslak ?? {}) as { sinif?: string; kasaTipi?: string; anaUs?: string; kapasiteTon?: number; plaka?: string };
  const ad = u.ad || u.kullaniciAdi;
  const tel = u.telefon ? telefonTelHref(u.telefon) : null;
  const arac = t.sinif ? [aracEtiketi({ ad: "", sinif: t.sinif, kasaTipi: t.kasaTipi }), t.kapasiteTon ? `${t.kapasiteTon} ton` : null, t.plaka].filter(Boolean).join(" · ") : "—";
  const bilgi: [string, string][] = [
    ["Telefon", u.telefon ? `${telefonGoster(u.telefon)} · ${u.telefonDogrulandi ? "doğrulandı" : "doğrulanmadı"}` : "—"],
    ["Kullanıcı adı", u.kullaniciAdi],
    ["Şehir (ana üs)", u.sehir || t.anaUs || "—"],
    ["Kayıt", tarih(u.createdAt)],
    ["Son giriş", u.sonGiris ? dkOnce(u.sonGiris) : "Hiç"],
    ["Kurulum", u.kurulumBitti ? `Tamamlandı · ${tarih(u.kurulumBitti)}` : `${u.kurulumAdim}/3 adım`],
    ["Araç (kurulumda)", arac],
    ["İlan şikâyeti", `${sikayet} bildirim`],
  ];

  return (
    <YonetimKabuk sekme="uyeler" baslik={ad} alt={u.aktif ? "Aktif hesap" : "Kapalı hesap"} geriHref="/yonetim/uyeler" gorsel={null}>
      <section className="rp-kart px-4 py-2" aria-label="Hesap bilgileri">
        <div className="flex items-center gap-3 border-b border-[var(--a-cizgi)] py-3">
          <FirmaAvatar id={u.id} ad={ad} />
          <span className="min-w-0 flex-1">
            <span className="block truncate text-[16px] font-extrabold">{ad}</span>
            <span className={`yn-durum ${!u.aktif ? "yn-durum-kotu" : !u.kurulumBitti ? "yn-durum-belirsiz" : "yn-durum-iyi"}`}>
              {!u.aktif ? "Kapalı" : !u.kurulumBitti ? "Kurulum bekliyor" : "Aktif"}
            </span>
          </span>
          {tel && (
            <a href={tel} className="ana-hap">
              Ara
            </a>
          )}
        </div>
        <dl>
          {bilgi.map(([k, v]) => (
            <div key={k} className="flex items-start justify-between gap-3 border-b border-[var(--a-cizgi)] py-2.5 last:border-0">
              <dt className="text-[13px] text-[var(--a-ikincil)]">{k}</dt>
              <dd className="text-right text-[13.5px] font-semibold">{v}</dd>
            </div>
          ))}
        </dl>
      </section>
      <p className="rp-not -mt-3">
        <span aria-hidden>ⓘ</span>
        <span>Üyenin seferleri, giderleri ve kasası bu panelde gösterilmez. Gerekirse “Üyenin paneline gir” ile bakarsın; giriş işlem kaydına yazılır.</span>
      </p>

      <UyeIslemleri uyeId={u.id} aktif={u.aktif} ad={ad} />

      <section aria-labelledby="uye-kayit">
        <h2 id="uye-kayit" className="ana-baslik px-1">
          İşlem geçmişi
        </h2>
        {kayitlar.length === 0 ? (
          <p className="rp-bos mt-2">Bu üye için yönetici işlemi yok.</p>
        ) : (
          <ul className="rp-kart mt-2 px-4">
            {kayitlar.map((k) => (
              <li key={k.id} className="flex items-center justify-between gap-3 border-b border-[var(--a-cizgi)] py-2.5 text-[13.5px] last:border-0">
                <span className="font-semibold">{ISLEM_ADI[k.islem] ?? k.islem}</span>
                <span className="text-[12px] text-[var(--a-ikincil)]">{dkOnce(k.createdAt)}</span>
              </li>
            ))}
          </ul>
        )}
      </section>
    </YonetimKabuk>
  );
}
