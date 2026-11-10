import Link from "next/link";
import { tlYazKisa } from "@/lib/para";
import { ayAraligi } from "@/lib/tarih";
import { tirBazliOzet, tirToplami, type TirSatiri } from "@/lib/tirOzet";

function Satir({ s, toplam }: { s: TirSatiri; toplam?: boolean }) {
  const net = s.gelir - s.gider;
  return (
    <li className={`border-b border-[var(--a-cizgi)] py-2.5 last:border-0 ${toplam ? "rounded-xl bg-[#f3f5fc] px-2.5" : ""}`}>
      <div className="flex items-baseline justify-between gap-2">
        <span className="min-w-0">
          <span className={`block truncate text-[14.5px] ${toplam ? "font-extrabold" : "font-bold"}`}>{s.sofor && !toplam ? s.sofor : s.etiket}</span>
          <span className="block truncate text-[11.5px] text-[var(--a-ikincil)]">
            {[!toplam && s.sofor ? s.etiket : null, `${s.sefer} sefer`].filter(Boolean).join(" · ")}
          </span>
        </span>
        <span className={`shrink-0 text-[15px] font-extrabold tabular-nums ${net < 0 ? "text-[#dc2626]" : "text-[#15803d]"}`}>{tlYazKisa(net)}</span>
      </div>
      <div className="mt-0.5 flex gap-4 text-[12.5px] tabular-nums text-[var(--a-ikincil)]">
        <span>Gelir {tlYazKisa(s.gelir)}</span>
        <span>Gider {tlYazKisa(s.gider)}</span>
      </div>
    </li>
  );
}

/** Ana sayfa: bu ay her tırın (şoförün) gelir / gider / neti + tüm tırların toplamı. */
export default async function TirlarOzeti() {
  const simdi = new Date();
  const { bas, son } = ayAraligi(simdi.getFullYear(), simdi.getMonth() + 1);
  const tirlar = await tirBazliOzet(bas, son).catch(() => []);
  if (tirlar.length === 0) return null;

  return (
    <section className="ana-bolum ana-gir" style={{ animationDelay: "320ms" }} aria-labelledby="tirlar-bu-ay">
      <div className="flex items-baseline justify-between gap-3">
        <h2 id="tirlar-bu-ay" className="ana-baslik">
          Tırlar bu ay
        </h2>
        <Link href="/raporlar" className="text-[12.5px] font-bold text-[var(--a-indigo)]">
          Raporlar ›
        </Link>
      </div>
      <ul className="mt-2">
        {tirlar.map((s) => (
          <Satir key={s.id} s={s} />
        ))}
        {tirlar.length > 1 && <Satir s={tirToplami(tirlar)} toplam />}
      </ul>
      <p className="mt-1.5 text-[11.5px] text-[var(--a-ikincil)]">KDV hariç. Tır seçilmeden girilen eski kayıtlar ilk tıra yazılır.</p>
    </section>
  );
}
