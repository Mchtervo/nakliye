import { baglamCikar } from "@/lib/ai/ilanCozumle";
import { sadelestir } from "@/lib/iller";
import { prisma } from "@/lib/prisma";
import {
  ortakBaglamSatirlari,
  rotaSatirSayisi,
  satirlaraBol,
} from "@/lib/kaynaklar/onFiltre";

function hamdaVarMi(ham: string, deger: string | null): boolean | null {
  if (!deger) return null;
  const sadeHam = sadelestir(ham);
  const sade = sadelestir(deger);
  if (!sade) return null;
  if (sadeHam.includes(sade)) return true;
  // Telefon: sadece rakam
  const rakamHam = ham.replace(/\D/g, "");
  const rakam = deger.replace(/\D/g, "");
  if (rakam.length >= 10 && rakamHam.includes(rakam.slice(-10))) return true;
  return false;
}

/** Test sonrası: ilan ↔ ham metin kalite özeti (çok rotalılar öncelikli). */
export async function testKaliteRaporu(mesajIdler: number[]): Promise<string> {
  if (mesajIdler.length === 0) return "Kalite: mesaj id yok.";

  const mesajlar = await prisma.hamMesaj.findMany({
    where: { id: { in: mesajIdler } },
    select: { id: true, metin: true },
  });
  if (mesajlar.length === 0) return "Kalite: mesaj bulunamadı.";

  const satirlar: string[] = ["── KALİTE (ilan ↔ ham) ──"];
  let telOk = 0;
  let telBos = 0;
  let telUydurma = 0;
  let firmaOk = 0;
  let firmaBos = 0;
  let yerUydurma = 0;
  let yerOk = 0;
  let ornekSay = 0;

  // Çok rotalı mesajları önce göster.
  const sirali = [...mesajlar].sort(
    (a, b) => rotaSatirSayisi(b.metin) - rotaSatirSayisi(a.metin)
  );

  for (const m of sirali) {
    const rotaN = rotaSatirSayisi(m.metin);
    const ilanlar = await prisma.yukIlani.findMany({
      where: { hamMetin: m.metin },
      orderBy: { id: "desc" },
      take: 12,
      select: {
        id: true,
        firmaAdi: true,
        telefon: true,
        nereden: true,
        nereye: true,
        cikisIl: true,
        varisIl: true,
        yuklemeTarihi: true,
        guvenSkoru: true,
      },
    });

    const baglam = ortakBaglamSatirlari(m.metin);
    const hamTel = Boolean(
      m.metin.match(/(\+?90|0)\s*5\d{2}[\s.-]?\d{3}[\s.-]?\d{2}[\s.-]?\d{2}/)
    );
    const yerBaglam = baglamCikar(m.metin);

    if (rotaN >= 3 || ilanlar.length >= 2) {
      satirlar.push(
        `\nMesaj #${m.id} · ~${rotaN} rota · ${ilanlar.length} ilan · bağlam ${baglam.length} satır`
      );
      satirlar.push(
        `Ham baş: ${satirlaraBol(m.metin).slice(0, 3).join(" | ").slice(0, 160)}`
      );
      if (baglam.length) {
        satirlar.push(`Ortak bağlam: ${baglam.slice(0, 4).join(" · ").slice(0, 160)}`);
      }

      for (const i of ilanlar.slice(0, 6)) {
        const tel = hamdaVarMi(m.metin, i.telefon);
        const firma = hamdaVarMi(m.metin, i.firmaAdi);
        const yerler = [i.nereden, i.nereye, i.cikisIl, i.varisIl].filter(
          Boolean
        ) as string[];
        const yerSorun = yerler.filter((y) => {
          const s = sadelestir(y);
          if (!s) return false;
          if (yerBaglam.sade.includes(s)) return false;
          if (yerBaglam.iller.has(y)) return false;
          // il adı set'te yoksa ve sade metinde yoksa uydurma adayı
          return !illeriGeciyor(m.metin, y);
        });

        if (i.telefon) {
          if (tel) telOk += 1;
          else telUydurma += 1;
        } else if (hamTel) {
          telBos += 1;
        }

        if (i.firmaAdi) {
          if (firma) firmaOk += 1;
          else firmaBos += 1; // hamda yok sayılabilir kısaltma
        } else {
          firmaBos += 1;
        }

        for (const y of yerler) {
          if (hamdaVarMi(m.metin, y) || illeriGeciyor(m.metin, y)) yerOk += 1;
          else yerUydurma += 1;
        }

        const tarih = i.yuklemeTarihi
          ? i.yuklemeTarihi.toISOString().slice(0, 10)
          : "—";
        satirlar.push(
          `  #${i.id} ${i.cikisIl || i.nereden || "?"}→${i.varisIl || i.nereye || "?"} · tel ${i.telefon || "YOK"}${tel === false ? "⚠" : tel ? "✓" : ""} · firma ${i.firmaAdi || "YOK"}${firma === true ? "✓" : ""} · tar ${tarih} · g%${i.guvenSkoru}` +
            (yerSorun.length ? ` · yer? ${yerSorun.join(",")}` : "")
        );
        ornekSay += 1;
      }
    } else if (ilanlar.length > 0 && ornekSay < 4) {
      const i = ilanlar[0];
      satirlar.push(
        `Mesaj #${m.id} (tekil): ${i.cikisIl || "?"}→${i.varisIl || "?"} tel ${i.telefon || "YOK"} firma ${i.firmaAdi || "YOK"}`
      );
      ornekSay += 1;
    }
  }

  satirlar.push(
    `\nÖzet sayaç: tel✓${telOk} tel_boş(hamda_var)${telBos} tel⚠${telUydurma} · firma✓${firmaOk} firma_boş/uyuşmaz${firmaBos} · yer✓${yerOk} yer⚠${yerUydurma}`
  );
  if (telBos > 0) {
    satirlar.push(
      "⚠ Hamda telefon var ama bazı ilanlarda boş — bağlam parçaya gitmiyor olabilir."
    );
  }
  if (yerUydurma > 0) {
    satirlar.push("⚠ Hamda geçmeyen yer adı var — uydurma kontrolü.");
  }
  if (telBos === 0 && telUydurma === 0 && yerUydurma === 0) {
    satirlar.push("✓ Telefon/yer kalite bayrakları temiz (örneklenen çok-rotalılar).");
  }

  return satirlar.join("\n");
}

function illeriGeciyor(ham: string, yer: string): boolean {
  const s = sadelestir(yer);
  if (!s) return false;
  return sadelestir(ham).includes(s);
}
