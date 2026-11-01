import { aktifBaglam } from "@/lib/baglam";
import { anaPrisma, uyeIstemcisi } from "@/lib/prismaAna";
import { uyeSemasiHazirla } from "@/lib/uyeSema";

/**
 * Uygulamanın veritabanı istemcisi. Yönetici ve sistem işleri ana şemada;
 * üye (veya üye görünümündeki yönetici) isteklerinde HER model işlemi üyenin
 * kendi şemasına gider. Böylece unutulmuş bir sorgu bile yöneticinin
 * verisini üyeye gösteremez. Üye hesapları (Uye) üyeye hiç açılmaz.
 */
export const prisma = anaPrisma.$extends({
  name: "uyeSemasi",
  query: {
    $allModels: {
      async $allOperations({ model, operation, args, query }) {
        const b = await aktifBaglam();
        if (b.uyeId === null) return query(args);
        if (model === "Uye") throw new Error("Bu bilgi üyelere kapalı.");
        await uyeSemasiHazirla(b.uyeId);
        const istemci = uyeIstemcisi(b.uyeId) as unknown as Record<string, Record<string, (a: unknown) => Promise<unknown>>>;
        const ad = model.charAt(0).toLowerCase() + model.slice(1);
        return istemci[ad][operation](args);
      },
    },
  },
});
