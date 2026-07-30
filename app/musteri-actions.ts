"use server";

import { revalidatePath } from "next/cache";
import {
  musteriIsaretToggle,
  musteriNotEkle,
  telefonNormalize,
} from "@/lib/musteriHavuz";

export async function musteriNotKaydet(
  _prev: { ok?: boolean; hata?: string } | null,
  formData: FormData
): Promise<{ ok?: boolean; hata?: string }> {
  const tel = String(formData.get("telefon") || "");
  const metin = String(formData.get("metin") || "");
  const r = await musteriNotEkle(tel, metin);
  if (!r.ok) return { hata: r.hata || "Kayıt başarısız" };
  revalidatePath("/ai/musteriler");
  return { ok: true };
}

export async function musteriIsaretle(telefon: string): Promise<{
  ok: boolean;
  isaretli?: boolean;
  hata?: string;
}> {
  const tel = telefonNormalize(telefon);
  if (!tel) return { ok: false, hata: "Telefon geçersiz" };
  const r = await musteriIsaretToggle(tel);
  revalidatePath("/ai/musteriler");
  return { ok: true, isaretli: r.isaretli };
}
