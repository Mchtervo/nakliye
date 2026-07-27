/**
 * Eski YukIlani kayıtlarına gonderenUserId geriye dönük doldurma.
 *
 * Eşleştirme sırası:
 * 1) kaynakId + kaynakMesajId = HamMesaj.mesajId
 * 2) aynı kaynakId + metin eşit / önek
 * 3) kaynakId yoksa yalnız metin eşit / önek
 * 4) (opsiyonel) --gramjs: Telegram'dan fromId çek
 *
 * Kullanım (VPS):
 *   npm run tdm:gonderen-doldur              # dry-run + istatistik
 *   npm run tdm:gonderen-doldur -- --yaz     # yazar
 *   npm run tdm:gonderen-doldur -- --yaz --gramjs
 */
import { TelegramClient, utils } from "telegram";
import { StringSession } from "telegram/sessions/index.js";
import { prisma } from "@/lib/prisma";
import { TELEGRAM_UYE } from "@/lib/kaynaklar/telegramUye";

const yaz = process.argv.includes("--yaz");
const gramjs = process.argv.includes("--gramjs");

type HamUid = {
  id: number;
  kaynakId: number | null;
  mesajId: number | null;
  metin: string;
  gonderenUserId: string;
};

function fromIdCikar(msg: {
  fromId?: unknown;
  senderId?: unknown;
}): string | null {
  try {
    const raw = msg.fromId || msg.senderId;
    if (!raw) return null;
    if (typeof raw === "object" && raw !== null && "userId" in raw) {
      return String((raw as { userId: unknown }).userId);
    }
    return String(
      utils.getPeerId(raw as Parameters<typeof utils.getPeerId>[0])
    );
  } catch {
    return null;
  }
}

/** HamMesaj ↔ ilan metin eşleşmesi (kırpma farkına toleranslı). */
function metinEslesir(ilanMetin: string, hamMetin: string): boolean {
  const a = ilanMetin.trim();
  const b = hamMetin.trim();
  if (!a || !b) return false;
  if (a === b) return true;
  // HamMesaj 2000, YukIlani 4000 kırpılabilir
  if (a.startsWith(b) || b.startsWith(a)) return true;
  const kisa = a.slice(0, 120);
  if (kisa.length >= 40 && b.includes(kisa)) return true;
  return false;
}

async function istatistik(): Promise<void> {
  const [
    hamToplam,
    hamUidVar,
    ilanToplam,
    ilanUidVar,
    ilanUidYok,
    ilanUidYokMesajIdVar,
  ] = await Promise.all([
    prisma.hamMesaj.count(),
    prisma.hamMesaj.count({ where: { gonderenUserId: { not: null } } }),
    prisma.yukIlani.count(),
    prisma.yukIlani.count({ where: { gonderenUserId: { not: null } } }),
    prisma.yukIlani.count({ where: { gonderenUserId: null } }),
    prisma.yukIlani.count({
      where: { gonderenUserId: null, kaynakMesajId: { not: null } },
    }),
  ]);

  console.log("--- durum ---");
  console.log(`HamMesaj: ${hamToplam} (gonderenUserId dolu: ${hamUidVar})`);
  console.log(
    `YukIlani: ${ilanToplam} (uid dolu: ${ilanUidVar}, boş: ${ilanUidYok}, boş+mesajId: ${ilanUidYokMesajIdVar})`
  );
}

async function hamUidListesi(): Promise<HamUid[]> {
  const satirlar = await prisma.hamMesaj.findMany({
    where: { gonderenUserId: { not: null } },
    select: {
      id: true,
      kaynakId: true,
      mesajId: true,
      metin: true,
      gonderenUserId: true,
    },
    orderBy: { createdAt: "desc" },
    take: 50_000,
  });
  return satirlar.filter(
    (s): s is HamUid => Boolean(s.gonderenUserId)
  ) as HamUid[];
}

async function hamMesajdanDoldur(): Promise<{
  guncellenen: number;
  mesajId: number;
  metin: number;
}> {
  const hamlar = await hamUidListesi();
  console.log(`Eşleştirme havuzu: ${hamlar.length} HamMesaj (uid dolu)`);

  // kaynakId|mesajId → uid
  const byMesaj = new Map<string, string>();
  // kaynakId → ham listesi
  const byKaynak = new Map<number, HamUid[]>();
  for (const h of hamlar) {
    if (h.kaynakId != null && h.mesajId != null) {
      byMesaj.set(`${h.kaynakId}:${h.mesajId}`, h.gonderenUserId);
    }
    if (h.kaynakId != null) {
      const liste = byKaynak.get(h.kaynakId) ?? [];
      liste.push(h);
      byKaynak.set(h.kaynakId, liste);
    }
  }

  const eksik = await prisma.yukIlani.findMany({
    where: { gonderenUserId: null },
    select: {
      id: true,
      kaynakId: true,
      kaynakMesajId: true,
      hamMetin: true,
    },
    take: 10_000,
  });
  console.log(`Uid'siz ilan: ${eksik.length}`);

  let guncellenen = 0;
  let viaMesajId = 0;
  let viaMetin = 0;

  for (const ilan of eksik) {
    let uid: string | null = null;
    let yol: "mesajId" | "metin" | null = null;
    let kaynakMesajId: number | null = ilan.kaynakMesajId;

    if (ilan.kaynakId != null && ilan.kaynakMesajId != null) {
      uid = byMesaj.get(`${ilan.kaynakId}:${ilan.kaynakMesajId}`) || null;
      if (uid) yol = "mesajId";
    }

    if (!uid && ilan.hamMetin) {
      const adaylar =
        ilan.kaynakId != null
          ? byKaynak.get(ilan.kaynakId) ?? []
          : hamlar;
      for (const h of adaylar) {
        if (metinEslesir(ilan.hamMetin, h.metin)) {
          uid = h.gonderenUserId;
          yol = "metin";
          if (h.mesajId != null && kaynakMesajId == null) {
            kaynakMesajId = h.mesajId;
          }
          break;
        }
      }
    }

    // Kaynak yok / kaçmış: tüm havuzda metin tara (pahalı ama bir kerelik)
    if (!uid && ilan.hamMetin && ilan.kaynakId == null) {
      for (const h of hamlar) {
        if (metinEslesir(ilan.hamMetin, h.metin)) {
          uid = h.gonderenUserId;
          yol = "metin";
          if (h.mesajId != null) kaynakMesajId = h.mesajId;
          break;
        }
      }
    }

    if (!uid || !yol) continue;

    if (yaz) {
      await prisma.yukIlani.update({
        where: { id: ilan.id },
        data: {
          gonderenUserId: uid,
          ...(kaynakMesajId != null && ilan.kaynakMesajId == null
            ? { kaynakMesajId }
            : {}),
        },
      });
    }

    if (yol === "mesajId") viaMesajId += 1;
    else viaMetin += 1;
    guncellenen += 1;

    if (guncellenen <= 30 || guncellenen % 50 === 0) {
      console.log(
        `[${yol}] ilan #${ilan.id} → ${uid}` +
          (yaz ? "" : " (dry-run)")
      );
    }
  }

  return { guncellenen, mesajId: viaMesajId, metin: viaMetin };
}

async function gramjsHamMesajDoldur(): Promise<number> {
  const apiId = Number(process.env.TELEGRAM_API_ID);
  const apiHash = process.env.TELEGRAM_API_HASH || "";
  const oturum = process.env.TELEGRAM_SESSION || "";
  if (!Number.isInteger(apiId) || apiId <= 0 || !apiHash || !oturum.trim()) {
    console.warn("[gramjs-ham] oturum eksik — atlandı.");
    return 0;
  }

  const eksik = await prisma.hamMesaj.findMany({
    where: {
      gonderenUserId: null,
      mesajId: { not: null },
      kaynakId: { not: null },
    },
    select: { id: true, kaynakId: true, mesajId: true },
    take: 1500,
    orderBy: { createdAt: "desc" },
  });
  if (eksik.length === 0) {
    console.log("[gramjs-ham] aday yok");
    return 0;
  }
  console.log(`[gramjs-ham] aday: ${eksik.length}`);

  const kaynakIds = [...new Set(eksik.map((e) => e.kaynakId!).filter(Boolean))];
  const kaynaklar = await prisma.ilanKaynagi.findMany({
    where: { id: { in: kaynakIds }, tur: TELEGRAM_UYE },
    select: { id: true, hedef: true, kullaniciAdi: true },
  });
  const kaynakMap = new Map(kaynaklar.map((k) => [k.id, k]));

  const client = new TelegramClient(new StringSession(oturum), apiId, apiHash, {
    connectionRetries: 5,
  });
  await client.connect();

  let guncellenen = 0;
  const entityCache = new Map<
    number,
    Awaited<ReturnType<typeof client.getEntity>>
  >();

  try {
    // kaynak bazında mesaj id'lerini toplu çek
    const byKaynak = new Map<number, typeof eksik>();
    for (const e of eksik) {
      const liste = byKaynak.get(e.kaynakId!) ?? [];
      liste.push(e);
      byKaynak.set(e.kaynakId!, liste);
    }

    for (const [kid, satirlar] of byKaynak) {
      const k = kaynakMap.get(kid);
      if (!k) continue;

      let entity = entityCache.get(kid);
      if (!entity) {
        try {
          entity = k.kullaniciAdi
            ? await client.getEntity(k.kullaniciAdi)
            : await client.getEntity(k.hedef);
          entityCache.set(kid, entity);
        } catch (e) {
          console.warn(
            `[gramjs-ham] entity #${kid}:`,
            e instanceof Error ? e.message : e
          );
          continue;
        }
      }

      const ids = satirlar
        .map((s) => s.mesajId!)
        .filter((id, i, a) => a.indexOf(id) === i);

      // Telegram ~100 id batch
      for (let i = 0; i < ids.length; i += 80) {
        const dilim = ids.slice(i, i + 80);
        try {
          const msgs = await client.getMessages(entity, { ids: dilim });
          const liste = Array.isArray(msgs) ? msgs : [msgs];
          for (const msg of liste) {
            if (!msg || typeof msg !== "object" || !("id" in msg)) continue;
            const mid = Number((msg as { id: number }).id);
            const uid = fromIdCikar(msg as { fromId?: unknown });
            if (!uid || !Number.isFinite(mid)) continue;

            if (yaz) {
              await prisma.hamMesaj.updateMany({
                where: {
                  kaynakId: kid,
                  mesajId: mid,
                  gonderenUserId: null,
                },
                data: { gonderenUserId: uid },
              });
            }
            guncellenen += 1;
            if (guncellenen <= 20 || guncellenen % 100 === 0) {
              console.log(
                `[gramjs-ham] kaynak #${kid} msg=${mid} → ${uid}` +
                  (yaz ? "" : " (dry-run)")
              );
            }
          }
        } catch (e) {
          console.warn(
            `[gramjs-ham] batch #${kid}:`,
            e instanceof Error ? e.message : e
          );
        }
        await new Promise((r) => setTimeout(r, 400));
      }
    }
  } finally {
    await client.disconnect().catch(() => null);
  }

  return guncellenen;
}

async function gramjsIlanDoldur(): Promise<number> {
  const apiId = Number(process.env.TELEGRAM_API_ID);
  const apiHash = process.env.TELEGRAM_API_HASH || "";
  const oturum = process.env.TELEGRAM_SESSION || "";
  if (!Number.isInteger(apiId) || apiId <= 0 || !apiHash || !oturum.trim()) {
    console.warn("[gramjs] TELEGRAM_API_ID/HASH/SESSION eksik — atlandı.");
    return 0;
  }

  const eksik = await prisma.yukIlani.findMany({
    where: {
      gonderenUserId: null,
      kaynakMesajId: { not: null },
      kaynakId: { not: null },
    },
    select: { id: true, kaynakId: true, kaynakMesajId: true },
    take: 800,
  });
  if (eksik.length === 0) {
    console.log("[gramjs] aday yok");
    return 0;
  }

  const kaynakIds = [...new Set(eksik.map((e) => e.kaynakId!).filter(Boolean))];
  const kaynaklar = await prisma.ilanKaynagi.findMany({
    where: { id: { in: kaynakIds }, tur: TELEGRAM_UYE },
    select: { id: true, hedef: true, kullaniciAdi: true },
  });
  const kaynakMap = new Map(kaynaklar.map((k) => [k.id, k]));

  const client = new TelegramClient(new StringSession(oturum), apiId, apiHash, {
    connectionRetries: 5,
  });
  await client.connect();

  let guncellenen = 0;
  const entityCache = new Map<
    number,
    Awaited<ReturnType<typeof client.getEntity>>
  >();

  try {
    for (const ilan of eksik) {
      const k = kaynakMap.get(ilan.kaynakId!);
      if (!k || ilan.kaynakMesajId == null) continue;

      let entity = entityCache.get(k.id);
      if (!entity) {
        try {
          entity = k.kullaniciAdi
            ? await client.getEntity(k.kullaniciAdi)
            : await client.getEntity(k.hedef);
          entityCache.set(k.id, entity);
        } catch (e) {
          console.warn(
            `[gramjs] entity yok kaynak #${k.id}:`,
            e instanceof Error ? e.message : e
          );
          continue;
        }
      }

      try {
        const msgs = await client.getMessages(entity, {
          ids: [ilan.kaynakMesajId],
        });
        const msg = Array.isArray(msgs) ? msgs[0] : null;
        if (!msg) continue;
        const uid = fromIdCikar(msg);
        if (!uid) continue;

        console.log(`[gramjs] ilan #${ilan.id} → ${uid}`);
        if (yaz) {
          await prisma.yukIlani.update({
            where: { id: ilan.id },
            data: { gonderenUserId: uid },
          });
          await prisma.hamMesaj.updateMany({
            where: {
              kaynakId: ilan.kaynakId!,
              mesajId: ilan.kaynakMesajId,
              gonderenUserId: null,
            },
            data: { gonderenUserId: uid },
          });
        }
        guncellenen += 1;
        await new Promise((r) => setTimeout(r, 300));
      } catch (e) {
        console.warn(
          `[gramjs] ilan #${ilan.id}:`,
          e instanceof Error ? e.message : e
        );
      }
    }
  } finally {
    await client.disconnect().catch(() => null);
  }

  return guncellenen;
}

async function main() {
  console.log(
    `gonderen-userid-doldur ${yaz ? "YAZ" : "DRY-RUN"}${gramjs ? " +gramjs" : ""}`
  );
  await istatistik();

  let nHam = 0;
  let n2 = 0;
  if (gramjs) {
    nHam = await gramjsHamMesajDoldur();
    console.log(`GramJS → HamMesaj uid: ${nHam}`);
  }

  const r1 = await hamMesajdanDoldur();
  console.log(
    `HamMesaj → YukIlani: ${r1.guncellenen} (mesajId=${r1.mesajId}, metin=${r1.metin})`
  );

  if (gramjs) {
    n2 = await gramjsIlanDoldur();
    console.log(`GramJS → YukIlani: ${n2}`);
  } else {
    console.log("GramJS atlandı — HamMesaj'da uid azsa: --yaz --gramjs");
  }

  const toplam = r1.guncellenen + n2;
  console.log("--- sonuç ---");
  console.log(`HamMesaj'a uid (GramJS): ${nHam}`);
  console.log(
    `YukIlani'ye uid: ${toplam}` +
      (yaz ? " (yazıldı)" : " (dry-run — henüz yazılmadı)")
  );
  await istatistik();
  if (!yaz) {
    console.log(
      "Uygulamak: npm run tdm:gonderen-doldur -- --yaz\n" +
        "Uid'siz HamMesaj için: npm run tdm:gonderen-doldur -- --yaz --gramjs"
    );
  }
}

main()
  .catch((e) => {
    console.error(e);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
