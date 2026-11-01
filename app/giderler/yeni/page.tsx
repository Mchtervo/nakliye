import GiderForm from "@/components/GiderForm";
import { anaYazi } from "@/components/ana/yazi";
import { HareketKok } from "@/components/ana/Hareket";
import { bugunTarihStr } from "@/lib/tarih";
import { veresiyeYerleri } from "@/lib/veresiye";

export const dynamic = "force-dynamic";

export default async function YeniGiderSayfasi({
  searchParams,
}: {
  searchParams: Promise<{ odeme?: string; yer?: string }>;
}) {
  const sp = await searchParams;
  const yerler = await veresiyeYerleri().catch(() => []);
  return (
    <div className={`ana ${anaYazi.variable}`}>
      <HareketKok>
        <GiderForm
          baslik="Yeni gider"
          altBaslik="Gider kaydı oluştur"
          bugunTarih={bugunTarihStr()}
          veresiyeYerleri={yerler}
          ilkVeresiye={sp.odeme === "VERESIYE"}
          ilkVeresiyeYer={(sp.yer || "").trim().slice(0, 80) || undefined}
        />
      </HareketKok>
    </div>
  );
}
