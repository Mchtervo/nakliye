import Link from "next/link";
import { grupDurumlari } from "@/lib/kaynaklar/telegramUye";
import {
  SAYAC_MIN_VERI_GUN,
  sayacBaslangicGaranti,
} from "@/lib/ayarlar";
import { bugunAnahtar } from "@/lib/kaynaklar/elemeSayac";

export const dynamic = "force-dynamic";

function isabetSirasi(a: number | null, b: number | null): number {
  // %0 en üstte; null (ölçülemedi) en sonda
  const aa = a === null ? 1000 : a;
  const bb = b === null ? 1000 : b;
  return aa - bb;
}

export default async function GrupKaliteSayfasi() {
  const sayacGun = await sayacBaslangicGaranti();
  const gruplar = (await grupDurumlari()).filter(
    (g) => g.durum === "AKTIF" && g.aktif
  );
  gruplar.sort((a, b) => {
    const is = isabetSirasi(a.koridorIsabet, b.koridorIsabet);
    if (is !== 0) return is;
    // Trafik: çok çeken ama 0 ilan üstte
    const skorA = a.ilanHafta === 0 ? a.cekilenBugun : -a.ilanHafta;
    const skorB = b.ilanHafta === 0 ? b.cekilenBugun : -b.ilanHafta;
    return skorB - skorA;
  });

  const bugun = bugunAnahtar();
  const sayacGunSayisi = Math.max(
    0,
    Math.floor(
      (Date.parse(`${bugun}T12:00:00+03:00`) -
        Date.parse(`${sayacGun}T12:00:00+03:00`)) /
        (24 * 60 * 60 * 1000)
    )
  );
  const sayacHazir = sayacGunSayisi >= SAYAC_MIN_VERI_GUN;

  return (
    <div className="space-y-5">
      <div className="reveal">
        <p className="text-[11px] font-bold uppercase tracking-[0.18em] text-amber">
          <Link href="/ai" className="hover:text-paper">
            AI Merkezi
          </Link>
          {" · "}Gruplar
        </p>
        <h1 className="font-display text-3xl font-extrabold text-paper sm:text-4xl">
          Grup kalite raporu
        </h1>
        <p className="mt-1 text-sm text-fog">
          İsabet %0 üstte (kırmızı). Sayaç başlangıcı:{" "}
          <span className="text-paper">{sayacGun}</span>
          {" · "}
          {sayacHazir
            ? `${sayacGunSayisi}g veri — budama sayaç kuralları açık`
            : `${sayacGunSayisi}/${SAYAC_MIN_VERI_GUN}g — sayaç budaması bekliyor (konu dışı içerik yine aday)`}
        </p>
      </div>

      <div className="overflow-x-auto rounded-xl border border-white/10 reveal">
        <table className="w-full min-w-[640px] text-left text-sm">
          <thead className="border-b border-white/10 bg-white/4 text-[11px] uppercase tracking-wider text-fog">
            <tr>
              <th className="px-3 py-2 font-bold">Grup</th>
              <th className="px-3 py-2 font-bold">Üye</th>
              <th className="px-3 py-2 font-bold">Bugün olay</th>
              <th className="px-3 py-2 font-bold">7g mesaj</th>
              <th className="px-3 py-2 font-bold">7g ilan</th>
              <th className="px-3 py-2 font-bold">İsabet</th>
              <th className="px-3 py-2 font-bold">Teşhis</th>
            </tr>
          </thead>
          <tbody>
            {gruplar.map((g) => {
              const sifir =
                g.koridorIsabet === 0 ||
                (g.koridorIsabet === null &&
                  g.cekilenBugun > 5 &&
                  g.ilanHafta === 0);
              return (
                <tr
                  key={g.id}
                  className={
                    sifir
                      ? "border-b border-ember/20 bg-ember/10"
                      : "border-b border-white/6"
                  }
                >
                  <td className="px-3 py-2">
                    <div
                      className={`font-semibold ${sifir ? "text-ember" : "text-paper"}`}
                    >
                      #{g.id} {g.ad}
                    </div>
                    {g.kullaniciAdi ? (
                      <div className="text-xs text-fog">@{g.kullaniciAdi}</div>
                    ) : null}
                  </td>
                  <td className="px-3 py-2 text-fog">
                    {g.uyeSayisi ?? "—"}
                  </td>
                  <td className="px-3 py-2 text-paper">
                    {g.cekilenBugun}
                    <span className="text-fog">
                      /{g.kuyrukBugun}k
                    </span>
                  </td>
                  <td className="px-3 py-2">{g.mesajHafta}</td>
                  <td className="px-3 py-2">{g.ilanHafta}</td>
                  <td
                    className={`px-3 py-2 font-bold ${
                      g.koridorIsabet === 0
                        ? "text-ember"
                        : g.koridorIsabet !== null && g.koridorIsabet < 20
                          ? "text-amber"
                          : "text-paper"
                    }`}
                  >
                    {g.koridorIsabet !== null
                      ? `%${g.koridorIsabet}`
                      : "—"}
                  </td>
                  <td className="max-w-[220px] px-3 py-2 text-xs text-fog">
                    {g.teshis}
                  </td>
                </tr>
              );
            })}
            {gruplar.length === 0 && (
              <tr>
                <td
                  colSpan={7}
                  className="px-3 py-6 text-center text-fog"
                >
                  Aktif grup yok
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
