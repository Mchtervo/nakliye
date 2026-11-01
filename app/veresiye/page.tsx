import VeresiyeDefteri from "@/components/finans/VeresiyeDefteri";
import { kategoriAdi } from "@/lib/sabitler";
import { veresiyeDurumu } from "@/lib/veresiye";

export const dynamic = "force-dynamic";

export default async function VeresiyeSayfasi() {
  const yerler = await veresiyeDurumu();
  return (
    <VeresiyeDefteri
      yerler={yerler.map((y) => {
        // Kart ikonu: o yerden en çok alınan kategori
        const sayac = new Map<string, number>();
        for (const a of y.alimlar) sayac.set(a.kategori, (sayac.get(a.kategori) ?? 0) + a.tutar);
        const kategori = [...sayac].sort((a, b) => b[1] - a[1])[0]?.[0];
        return {
          yer: y.yer,
          kategori,
          alinan: y.alinan,
          odenen: y.odenen,
          kalan: y.kalan,
          hareketler: [
            ...y.alimlar.map((a) => ({
              anahtar: `g${a.id}`,
              href: `/giderler/${a.id}/duzenle`,
              tarihIso: a.tarih.toISOString(),
              ad: a.litre ? `${kategoriAdi(a.kategori)} · ${a.litre.toLocaleString("tr-TR")} lt` : `${kategoriAdi(a.kategori)} alımı`,
              tutar: a.tutar,
              odeme: false,
            })),
            ...y.odemeler.map((o) => ({
              anahtar: `o${o.id}`,
              tarihIso: o.tarih.toISOString(),
              ad: "Ödeme",
              tutar: o.tutar,
              odeme: true,
            })),
          ].sort((a, b) => b.tarihIso.localeCompare(a.tarihIso)),
        };
      })}
    />
  );
}
