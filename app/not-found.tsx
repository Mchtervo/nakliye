import Link from "next/link";
import { anaYazi } from "@/components/ana/yazi";

/** Bulunamayan sayfa / silinmiş kayıt: açık zeminli, ana sayfaya dönüşlü. */
export default function Bulunamadi() {
  return (
    <div className={`ana ${anaYazi.variable}`}>
      <div className="ana-ic flex min-h-[70dvh] flex-col items-center justify-center gap-4 py-10 text-center">
        <h1 className="text-[1.4rem] font-extrabold">Bu sayfa bulunamadı</h1>
        <p className="max-w-xs text-[14.5px] text-[var(--a-ikincil)]">Kayıt silinmiş ya da adres değişmiş olabilir.</p>
        <Link href="/" className="ana-ana-dugme w-full max-w-xs">
          Ana sayfaya dön
        </Link>
      </div>
    </div>
  );
}
