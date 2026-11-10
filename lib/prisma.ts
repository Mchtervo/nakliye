import { aktifBaglam } from "@/lib/baglam";
import { anaPrisma, uyeIstemcisi } from "@/lib/prismaAna";
import { uyeSemasiHazirla } from "@/lib/uyeSema";

/**
 * Uygulamanın veritabanı istemcisi. Yönetici ve sistem işleri ana şemada;
 * üye (veya üye görünümündeki yönetici) isteklerinde HER model işlemi üyenin
 * kendi şemasına gider. Böylece unutulmuş bir sorgu bile yöneticinin
 * verisini üyeye gösteremez. Üye hesapları (Uye) üyeye hiç açılmaz.
 */
/**
 * Supabase'e ara ara ulaşılamıyor (P1001) ya da havuz anlık doluyor (P2024).
 * İkisinde de sorgu veritabanına hiç gitmemiştir; kısa bekleyip yeniden denemek güvenli.
 */
const GECICI_HATALAR = new Set(["P1001", "P2024"]);
async function tekrarDene<T>(is: () => Promise<T>): Promise<T> {
  for (let deneme = 0; ; deneme++) {
    try {
      return await is();
    } catch (e) {
      const kod = (e as { code?: string; errorCode?: string })?.code ?? (e as { errorCode?: string })?.errorCode;
      const gecici = (kod && GECICI_HATALAR.has(kod)) || /Can't reach database server/.test(e instanceof Error ? e.message : "");
      if (!gecici || deneme >= 2) throw e;
      await new Promise((r) => setTimeout(r, deneme === 0 ? 400 : 1500));
    }
  }
}

export const prisma = anaPrisma.$extends({
  name: "uyeSemasi",
  query: {
    $allModels: {
      async $allOperations({ model, operation, args, query }) {
        const b = await aktifBaglam();
        if (b.uyeId === null) return tekrarDene(() => query(args));
        if (model === "Uye") throw new Error("Bu bilgi üyelere kapalı.");
        await uyeSemasiHazirla(b.uyeId);
        const istemci = uyeIstemcisi(b.uyeId) as unknown as Record<string, Record<string, (a: unknown) => Promise<unknown>>>;
        const ad = model.charAt(0).toLowerCase() + model.slice(1);
        return tekrarDene(() => istemci[ad][operation](args));
      },
    },
  },
});
