import Link from "next/link";
import type { Prisma } from "@prisma/client";
import FirmaAvatar from "@/components/kasa/FirmaAvatar";
import YeniUyePaneli from "@/components/yonetim/YeniUyePaneli";
import YonetimKabuk from "@/components/yonetim/YonetimKabuk";
import { aracEtiketi } from "@/lib/aracTip";
import { anaPrisma } from "@/lib/prismaAna";
import { telefonGoster } from "@/lib/telefon";
import { yoneticiSayfasi } from "@/lib/yetki";
import { dkOnce } from "@/lib/yonetimVeri";

export const dynamic = "force-dynamic";

const FILTRE = [
  { kod: "", ad: "Tümü" },
  { kod: "aktif", ad: "Aktif" },
  { kod: "kurulum", ad: "Kurulum bekliyor" },
  { kod: "dogrulanmadi", ad: "Doğrulanmadı" },
  { kod: "kapali", ad: "Kapalı" },
];

/** Üye listesi: arama, hesap durumu. Yalnız hesap bilgisi (defter / finans yok). */
export default async function YonetimUyeler({ searchParams }: { searchParams: Promise<{ q?: string; durum?: string }> }) {
  await yoneticiSayfasi();
  const sp = await searchParams;
  const q = (sp.q ?? "").trim().slice(0, 40);
  const durum = FILTRE.some((f) => f.kod === sp.durum) ? (sp.durum ?? "") : "";
  const rakam = q.replace(/\D/g, "").replace(/^0/, "");
  const where: Prisma.UyeWhereInput = {
    ...(q
      ? {
          OR: [
            { ad: { contains: q, mode: "insensitive" } },
            { kullaniciAdi: { contains: q.toLocaleLowerCase("tr-TR") } },
            ...(rakam.length >= 3 ? [{ telefon: { contains: rakam } }] : []),
          ],
        }
      : {}),
    ...(durum === "aktif" ? { aktif: true } : durum === "kapali" ? { aktif: false } : durum === "kurulum" ? { aktif: true, kurulumBitti: null } : durum === "dogrulanmadi" ? { telefonDogrulandi: null } : {}),
  };
  const uyeler = await anaPrisma.uye.findMany({ where, orderBy: { createdAt: "desc" }, take: 200 });

  return (
    <YonetimKabuk sekme="uyeler" baslik="Üyeler" alt="Hesaplar ve durumları" gorsel="/ana/kisi.webp">
      <form className="flex gap-2" role="search">
        {durum && <input type="hidden" name="durum" value={durum} />}
        <input name="q" defaultValue={q} placeholder="Ad, telefon veya kullanıcı adı" className="ana-alan min-w-0 flex-1" aria-label="Üye ara" />
        <button type="submit" className="ana-ana-dugme !min-h-[2.9rem] shrink-0 !px-4">
          Ara
        </button>
      </form>
      <div className="-mt-3 flex flex-wrap items-center gap-2">
        {FILTRE.map((f) => {
          const p = new URLSearchParams();
          if (q) p.set("q", q);
          if (f.kod) p.set("durum", f.kod);
          return (
            <Link key={f.kod} href={`/yonetim/uyeler?${p}`} className={`ana-hap ${durum === f.kod ? "!border-[#4f46e5] !bg-[#eef0ff] !text-[#3730a3]" : ""}`}>
              {f.ad}
            </Link>
          );
        })}
        <span className="ml-auto">
          <YeniUyePaneli />
        </span>
      </div>

      {uyeler.length === 0 ? (
        <p className="rp-bos">{q || durum ? "Bu aramaya uyan üye yok." : "Henüz üye yok. Üyeler giriş ekranından kendileri kaydolur."}</p>
      ) : (
        <ul className="rp-kart px-3" aria-label={`${uyeler.length} üye`}>
          {uyeler.map((u) => {
            const t = (u.kurulumTaslak ?? {}) as { sinif?: string; kasaTipi?: string };
            const arac = t.sinif ? aracEtiketi({ ad: "", sinif: t.sinif, kasaTipi: t.kasaTipi }) : null;
            return (
              <li key={u.id} className="border-b border-[var(--a-cizgi)] last:border-0">
                <Link href={`/yonetim/uyeler/${u.id}`} className="rp-satir">
                  <FirmaAvatar id={u.id} ad={u.ad || u.kullaniciAdi} />
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-[15px] font-bold">{u.ad || u.kullaniciAdi}</span>
                    <span className="block truncate text-[12px] text-[var(--a-ikincil)]">
                      {[arac, u.sehir, u.telefon ? telefonGoster(u.telefon) : null].filter(Boolean).join(" · ") || "Bilgi yok"}
                    </span>
                    <span className="block text-[11.5px] text-[var(--a-ikincil)]">
                      {u.sonGiris ? `Son giriş ${dkOnce(u.sonGiris)}` : "Hiç giriş yapmadı"} ·{" "}
                      <span className={u.telefonDogrulandi ? "font-semibold text-[#16a34a]" : "font-semibold text-[#a16207]"}>{u.telefonDogrulandi ? "telefon doğrulandı" : "telefon doğrulanmadı"}</span>
                    </span>
                  </span>
                  <span className={`yn-durum ${!u.aktif ? "yn-durum-kotu" : !u.kurulumBitti ? "yn-durum-belirsiz" : "yn-durum-iyi"}`}>
                    {!u.aktif ? "Kapalı" : !u.kurulumBitti ? "Kurulum" : "Aktif"}
                  </span>
                </Link>
              </li>
            );
          })}
        </ul>
      )}
    </YonetimKabuk>
  );
}
