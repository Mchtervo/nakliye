import Image from "next/image";
import { redirect } from "next/navigation";
import { uyeAktifDegistir, uyePanelineGir, uyeSifreSifirla } from "@/app/uye-actions";
import AksiyonButonu from "@/components/AksiyonButonu";
import { HareketKok } from "@/components/ana/Hareket";
import { anaYazi } from "@/components/ana/yazi";
import FirmaAvatar from "@/components/kasa/FirmaAvatar";
import YeniUyeForm from "@/components/uye/YeniUyeForm";
import { tarihYaz } from "@/lib/para";
import { anaPrisma } from "@/lib/prismaAna";
import { uyeDurumu, yoneticiMi, type UyeDurumu } from "@/lib/uyeProfil";

export const dynamic = "force-dynamic";

/** Yönetici paneli: üyeler, durumları, üye paneline giriş. Üyelerin mali kayıtları burada listelenmez. */
export default async function YonetimSayfasi() {
  if (!(await yoneticiMi())) redirect("/");
  const hesaplar = await anaPrisma.uye.findMany({ orderBy: { createdAt: "desc" }, select: { id: true } });
  const uyeler = (await Promise.all(hesaplar.map((h) => uyeDurumu(h.id).catch(() => null)))).filter((u): u is UyeDurumu => u !== null);
  const aktif = uyeler.filter((u) => u.aktif).length;
  const eksikli = uyeler.filter((u) => u.eksikler.length > 0).length;

  return (
    <div className={`ana ${anaYazi.variable}`}>
      <HareketKok>
        <header className="ana-ust ks-ust">
          <div className="ana-ust-zemin" aria-hidden />
          <div className="ana-ic relative">
            <div className="ana-gir flex items-center gap-2 pt-3">
              <Image src="/ana/logo-2.png" alt="" width={40} height={36} className="h-9 w-10 shrink-0" />
              <div className="min-w-0 leading-tight">
                <p className="truncate text-[16px] font-extrabold tracking-[-0.02em] text-white">Nakliye Defteri</p>
                <p className="text-[12px] font-semibold text-[#9fb0ff]">Yönetim</p>
              </div>
            </div>
            <h1 className="ana-gir mt-4 text-[1.75rem] font-extrabold leading-tight tracking-[-0.03em] text-white" style={{ animationDelay: "40ms" }}>
              Üyeler
            </h1>
            <div className="ana-gir mt-3 grid grid-cols-3 gap-2" style={{ animationDelay: "70ms" }}>
              {(
                [
                  ["Üye", uyeler.length],
                  ["Aktif", aktif],
                  ["Eksik bilgili", eksikli],
                ] as const
              ).map(([ad, sayi]) => (
                <div key={ad} className="rounded-[1.1rem] border border-white/15 bg-white/10 px-3 py-2.5">
                  <p className="text-[12px] text-[#c7cffd]">{ad}</p>
                  <p className="text-[1.5rem] font-extrabold leading-tight text-white tabular-nums">{sayi}</p>
                </div>
              ))}
            </div>
          </div>
        </header>

        <div className="ana-ic relative z-10 -mt-8 space-y-4 pb-6">
          <section className="ana-gir space-y-3" style={{ animationDelay: "100ms" }} aria-labelledby="uye-liste">
            <h2 id="uye-liste" className="sr-only">
              Üye listesi
            </h2>
            {uyeler.length === 0 && (
              <div className="rounded-[1.4rem] bg-white px-5 py-7 text-center text-[14.5px] text-[#3b4262] shadow-[var(--a-golge)]">Henüz üye yok. Aşağıdan ekle.</div>
            )}
            {uyeler.map((u) => (
              <article key={u.id} className={`sf-kart ${u.aktif ? "" : "opacity-60"}`}>
                <div className="flex items-center gap-3">
                  <FirmaAvatar id={u.id} ad={u.ad || u.kullaniciAdi} />
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-[16px] font-extrabold">{u.ad || "Adı girilmemiş"}</p>
                    <p className="truncate text-[12.5px] text-[var(--a-ikincil)]">
                      @{u.kullaniciAdi}
                      {u.telefon ? ` · ${u.telefon}` : ""}
                      {u.sehir ? ` · ${u.sehir}` : ""}
                    </p>
                  </div>
                  <span className={`sf-rozet ${!u.aktif ? "bg-[#eef0f8] text-[#4b5375]" : u.eksikler.length ? "bg-[#fff1dc] text-[#c2410c]" : "bg-[#dcfce7] text-[#15803d]"}`}>
                    {!u.aktif ? "Kapalı" : !u.hazir ? "Hazırlanıyor" : u.eksikler.length ? "Eksik bilgi" : "Aktif"}
                  </span>
                </div>
                <dl className="mt-3 grid grid-cols-2 gap-x-3 gap-y-1.5 border-t border-[var(--a-cizgi)] pt-2.5 text-[13px]">
                  <div>
                    <dt className="text-[11.5px] text-[var(--a-ikincil)]">Araç</dt>
                    <dd className="truncate font-semibold">{u.arac?.plaka ? `${u.arac.ad} · ${u.arac.plaka}` : "Eklenmedi"}</dd>
                  </div>
                  <div>
                    <dt className="text-[11.5px] text-[var(--a-ikincil)]">Son giriş</dt>
                    <dd className="font-semibold">{u.sonGiris ? tarihYaz(u.sonGiris) : "Hiç girmedi"}</dd>
                  </div>
                  <div>
                    <dt className="text-[11.5px] text-[var(--a-ikincil)]">Kayıt</dt>
                    <dd className="font-semibold">{tarihYaz(u.createdAt)}</dd>
                  </div>
                  <div>
                    <dt className="text-[11.5px] text-[var(--a-ikincil)]">Kullanım</dt>
                    <dd className="font-semibold">
                      {u.seferSayisi} sefer · {u.giderSayisi} gider
                    </dd>
                  </div>
                  {u.eksikler.length > 0 && (
                    <div className="col-span-2">
                      <dt className="text-[11.5px] text-[var(--a-ikincil)]">Eksik</dt>
                      <dd className="font-semibold text-[#c2410c]">{u.eksikler.join(", ")}</dd>
                    </div>
                  )}
                </dl>
                <div className="mt-3 grid grid-cols-[1.3fr_1fr] gap-2">
                  <form action={uyePanelineGir.bind(null, u.id)}>
                    <button type="submit" disabled={!u.aktif || !u.hazir} className="ana-ana-dugme w-full !min-h-11 !text-[14px] disabled:opacity-50">
                      Paneline gir
                    </button>
                  </form>
                  <AksiyonButonu
                    calistir={uyeAktifDegistir.bind(null, u.id)}
                    etiket={u.aktif ? "Hesabı kapat" : "Hesabı aç"}
                    bekleyenEtiket="…"
                    onay={u.aktif ? `@${u.kullaniciAdi} hesabı kapatılsın mı? Giriş yapamaz, verisi silinmez.` : undefined}
                    sinif={`sf-ikincil-dugme w-full !min-h-11 ${u.aktif ? "!text-[#dc2626]" : ""}`}
                  />
                </div>
                <form
                  action={async (f: FormData) => {
                    "use server";
                    await uyeSifreSifirla(u.id, String(f.get("sifre") || ""));
                  }}
                  className="mt-2 flex gap-2"
                >
                  <div className="sf-alan flex-1 !min-h-10">
                    <input name="sifre" required minLength={4} autoComplete="off" placeholder="Yeni şifre" aria-label={`@${u.kullaniciAdi} yeni şifre`} className="sf-girdi !text-[13.5px]" />
                  </div>
                  <button type="submit" className="sf-ikincil-dugme shrink-0 !min-h-10 !px-4">
                    Şifreyi değiştir
                  </button>
                </form>
              </article>
            ))}
          </section>

          <section className="rounded-[1.5rem] bg-white p-4 shadow-[var(--a-golge)]" aria-labelledby="yeni-uye">
            <h2 id="yeni-uye" className="ana-baslik">
              Yeni üye
            </h2>
            <p className="mb-3 text-[12.5px] text-[var(--a-ikincil)]">Üye kendi boş defteriyle başlar; senin yüklerini, borçlarını, seferlerini göremez.</p>
            <YeniUyeForm />
          </section>
        </div>
      </HareketKok>
    </div>
  );
}
