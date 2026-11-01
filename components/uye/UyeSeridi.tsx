import Link from "next/link";
import { unstable_rethrow } from "next/navigation";
import { yoneticiyeDon } from "@/app/uye-actions";
import { aktifBaglam } from "@/lib/baglam";
import { uyeDurumu } from "@/lib/uyeProfil";

/**
 * Üst şerit (yalnız üye / üye görünümü): yönetici görünümü uyarısı ve
 * eksik profil bilgisi hatırlatması. Yöneticinin kendi ekranında hiçbir şey çizmez.
 */
export default async function UyeSeridi() {
  let b;
  try {
    b = await aktifBaglam();
  } catch (e) {
    unstable_rethrow(e);
    return null;
  }
  if (b.uyeId === null) return null;
  const d = await uyeDurumu(b.uyeId);
  if (!d) return null;

  return (
    <div className="uye-serit">
      {b.yoneticiGoruyor && (
        <form action={yoneticiyeDon} className="uye-serit-satir bg-[#1e1b4b] text-white">
          <span className="min-w-0 truncate">
            <b>{d.ad || d.kullaniciAdi}</b> panelini görüyorsun
          </span>
          <button type="submit" className="shrink-0 rounded-full bg-white px-3 py-1 text-[12.5px] font-bold text-[#1e1b4b]">
            Yönetime dön
          </button>
        </form>
      )}
      {d.eksikler.length > 0 && (
        <Link href={d.kurulumBitti ? "/profil" : "/kurulum"} className="uye-serit-satir uye-serit-eksik bg-[#f97316] text-white">
          <span className="min-w-0 truncate">
            <b>Eksik bilgilerin var:</b> {d.eksikler.join(", ")}
          </span>
          <span className="shrink-0 rounded-full bg-white px-3 py-1 text-[12.5px] font-bold text-[#c2410c]">Doldur</span>
        </Link>
      )}
    </div>
  );
}
