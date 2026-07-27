/**
 * Eski ilanlara gonderenUserId geriye dönük doldurma.
 *
 * 1) HamMesaj.gonderenUserId → YukIlani (kaynakId+mesajId veya hamMetin)
 * 2) Hâlâ boş + kaynakMesajId var → GramJS getMessages ile fromId
 *
 * Kullanım:
 *   npm run ts -- scripts/gonderen-userid-doldur.ts           # dry-run
 *   npm run ts -- scripts/gonderen-userid-doldur.ts --yaz     # yazar
 *   npm run ts -- scripts/gonderen-userid-doldur.ts --yaz --gramjs
 */
import { TelegramClient, utils } from "telegram";
import { StringSession } from "telegram/sessions/index.js";
import { prisma } from "@/lib/prisma";
import { TELEGRAM_UYE } from "@/lib/kaynaklar/telegramUye";

const yaz = process.argv.includes("--yaz");
const gramjs = process.argv.includes("--gramjs");

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

async function hamMesajdanDoldur(): Promise<number> {
  const eksik = await prisma.yukIlani.findMany({
    where: {
      gonderenUserId: null,
      OR: [
        { kaynakMesajId: { not: null } },
        { kaynakId: { not: null } },
      ],
    },
    select: {
      id: true,
      kaynakId: true,
      kaynakMesajId: true,
      hamMetin: true,
    },
    take: 2000,
  });

  let guncellenen = 0;
  for (const ilan of eksik) {
    let uid: string | null = null;

    if (ilan.kaynakId && ilan.kaynakMesajId != null) {
      const ham = await prisma.hamMesaj.findFirst({
        where: {
          kaynakId: ilan.kaynakId,
          mesajId: ilan.kaynakMesajId,
          gonderenUserId: { not: null },
        },
        select: { gonderenUserId: true },
      });
      uid = ham?.gonderenUserId || null;
    }

    if (!uid && ilan.hamMetin) {
      const ham = await prisma.hamMesaj.findFirst({
        where: {
          metin: ilan.hamMetin,
          gonderenUserId: { not: null },
          ...(ilan.kaynakId ? { kaynakId: ilan.kaynakId } : {}),
        },
        orderBy: { createdAt: "desc" },
        select: { gonderenUserId: true },
      });
      uid = ham?.gonderenUserId || null;
    }

    if (!uid) continue;
    console.log(`[ham] ilan #${ilan.id} → ${uid}`);
    if (yaz) {
      await prisma.yukIlani.update({
        where: { id: ilan.id },
        data: { gonderenUserId: uid },
      });
    }
    guncellenen += 1;
  }
  return guncellenen;
}

async function gramjsDoldur(): Promise<number> {
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
    select: {
      id: true,
      kaynakId: true,
      kaynakMesajId: true,
    },
    take: 400,
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

  const client = new TelegramClient(
    new StringSession(oturum),
    apiId,
    apiHash,
    { connectionRetries: 5 }
  );
  await client.connect();

  let guncellenen = 0;
  const entityCache = new Map<number, Awaited<ReturnType<typeof client.getEntity>>>();

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
        if (!msg) {
          console.log(`[gramjs] mesaj yok ilan #${ilan.id} mid=${ilan.kaynakMesajId}`);
          continue;
        }
        const uid = fromIdCikar(msg);
        if (!uid) {
          console.log(`[gramjs] fromId yok ilan #${ilan.id}`);
          continue;
        }
        console.log(`[gramjs] ilan #${ilan.id} → ${uid}`);
        if (yaz) {
          await prisma.yukIlani.update({
            where: { id: ilan.id },
            data: { gonderenUserId: uid },
          });
          // HamMesaj'ı da doldur (sonraki koşular için)
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
        await new Promise((r) => setTimeout(r, 350));
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

  const n1 = await hamMesajdanDoldur();
  console.log(`HamMesaj eşleşmesi: ${n1}`);

  let n2 = 0;
  if (gramjs) {
    n2 = await gramjsDoldur();
    console.log(`GramJS çekimi: ${n2}`);
  } else {
    console.log("GramJS atlandı (ekle: --gramjs)");
  }

  const kalan = await prisma.yukIlani.count({
    where: { gonderenUserId: null, kaynakMesajId: { not: null } },
  });
  console.log(`Kalan (kaynakMesajId var, userId yok): ${kalan}`);
  if (!yaz) console.log("Değişiklik yazılmadı. Uygulamak için: --yaz");
}

main()
  .catch((e) => {
    console.error(e);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
