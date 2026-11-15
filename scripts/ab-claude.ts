/**
 * Mevcut ilan modeli (gpt-5.4-nano) ile Claude Haiku 5.5 karşılaştırması.
 * Son 24 saatin gerçek grup mesajlarından örnek alır, ikisine de okutur.
 * YukIlani'ye YAZMAZ (yalnız bellek); AiCagri'ye maliyet logu düşer.
 *
 *   npm run ts -- scripts/ab-claude.ts [adet=40]
 */
import { anaPrisma } from "@/lib/prismaAna";
import { prisma } from "@/lib/prisma";
import { modelIleCozumle, skorHesapla, tabloYaz, type AbMesaj } from "@/lib/ai/abKarsilastir";
import type { CozulmusIlan } from "@/lib/ai/ilanCozumle";

const A = "gpt-5.4-nano";
const B = "claude:claude-haiku-5-5";
const ADET = Math.max(5, Math.min(80, Number(process.argv[2]) || 40));

async function ornekSec(): Promise<AbMesaj[]> {
  const havuz = await anaPrisma.hamMesaj.findMany({
    where: { createdAt: { gte: new Date(Date.now() - 24 * 3600e3) }, kaynak: { tur: "WHATSAPP_GRUP" } },
    orderBy: { id: "desc" },
    take: 3000,
    select: { id: true, metin: true, metinHash: true },
  });
  const gorulen = new Set<string>();
  const aday = havuz.filter((m) => {
    if (m.metin.length < 40 || m.metin.length > 2500) return false;
    if (!/0?\s*5\d{2}\s*\d{3}\s*\d{2}\s*\d{2}/.test(m.metin.replace(/[^\d\s]/g, " "))) return false; // telefonu olan
    if (/herisburda|haulika|chatlink/i.test(m.metin)) return false; // bilinen reklam
    const k = m.metinHash || m.metin.slice(0, 80);
    if (gorulen.has(k)) return false;
    gorulen.add(k);
    return true;
  });
  // Gün boyuna eşit aralıkla yay
  const adim = Math.max(1, Math.floor(aday.length / ADET));
  return aday.filter((_, i) => i % adim === 0).slice(0, ADET).map((m) => ({ id: m.id, metin: m.metin }));
}

const rota = (i: CozulmusIlan) => `${i.cikisIl || i.nereden || "?"}→${i.varisIl || i.nereye || "?"}${i.aracTipiKod ? ` [${i.aracTipiKod}]` : ""}`;

async function main() {
  if (!process.env.ANTHROPIC_API_KEY || !process.env.OPENAI_API_KEY) throw new Error("ANTHROPIC_API_KEY ve OPENAI_API_KEY gerekli.");
  const mesajlar = await ornekSec();
  console.log(`[ab-claude] ${mesajlar.length} mesaj (son 24 saat, telefonlu, tekrarsız)`);

  const a = await modelIleCozumle(mesajlar, A, "nano");
  const aSkor = await skorHesapla(mesajlar, a.ilanlar, A, "nano", a.bas);
  const b = await modelIleCozumle(mesajlar, B, "haiku");
  const bSkor = await skorHesapla(mesajlar, b.ilanlar, B, "haiku", b.bas);

  console.log("\n" + tabloYaz(aSkor, bSkor));

  console.log("\n=== Farklı sonuç veren mesajlar ===");
  let fark = 0;
  for (const m of mesajlar) {
    const x = (a.ilanlar.get(m.id) || []).map(rota).sort();
    const y = (b.ilanlar.get(m.id) || []).map(rota).sort();
    if (x.join("|") === y.join("|")) continue;
    fark += 1;
    console.log(`\n#${m.id}: ${m.metin.replace(/\s+/g, " ").slice(0, 230)}`);
    console.log(`  nano : ${x.join(", ") || "(ilan yok)"}`);
    console.log(`  haiku: ${y.join(", ") || "(ilan yok)"}`);
  }
  console.log(`\n[ab-claude] farklı: ${fark}/${mesajlar.length} | maliyet nano=$${(aSkor.maliyetMikro / 1e6).toFixed(4)} haiku=$${(bSkor.maliyetMikro / 1e6).toFixed(4)}`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
