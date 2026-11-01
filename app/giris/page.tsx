import { HareketKok } from "@/components/ana/Hareket";
import { anaYazi } from "@/components/ana/yazi";
import Karsilama from "@/components/uyelik/Karsilama";

export default async function GirisSayfasi({
  searchParams,
}: {
  searchParams: Promise<{ next?: string; giris?: string; kapandi?: string }>;
}) {
  const sp = await searchParams;
  const next = sp.next && /^\/(?!\/)/.test(sp.next) ? sp.next : "/";

  return (
    <div className={`ana ${anaYazi.variable}`}>
      <HareketKok>
        {/* Bir sayfadan girişe yönlendirildiyse (next) giriş paneli açık gelir */}
        <Karsilama next={next} girisAcik={Boolean(sp.giris || sp.next || sp.kapandi)} kapandi={Boolean(sp.kapandi)} />
      </HareketKok>
    </div>
  );
}
