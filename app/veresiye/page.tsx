import VeresiyeDefteri from "@/components/finans/VeresiyeDefteri";
import { kategoriAdi } from "@/lib/sabitler";
import { veresiyeDurumu } from "@/lib/veresiye";

export const dynamic = "force-dynamic";

export default async function VeresiyeSayfasi() {
  const yerler = await veresiyeDurumu();
  return (
    <div className="mx-auto max-w-lg space-y-4">
      <div className="reveal">
        <p className="sayfa-eyebrow">Para</p>
        <h1 className="font-display text-3xl font-extrabold text-paper">Veresiye defteri</h1>
      </div>
      <VeresiyeDefteri
        yerler={yerler.map((y) => ({
          yer: y.yer,
          alinan: y.alinan,
          odenen: y.odenen,
          kalan: y.kalan,
          hareketler: [
            ...y.alimlar.map((a) => ({
              anahtar: `g${a.id}`,
              href: `/giderler/${a.id}/duzenle`,
              tarihIso: a.tarih.toISOString(),
              ad: a.litre ? `${kategoriAdi(a.kategori)} · ${a.litre.toLocaleString("tr-TR")} lt` : kategoriAdi(a.kategori),
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
        }))}
      />
    </div>
  );
}
