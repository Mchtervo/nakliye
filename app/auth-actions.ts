"use server";

import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { OTURUM_COOKIE, oturumTokeniOlustur, uygulamaSifresi } from "@/lib/auth";
import { sifreDogrula, sifreHashle } from "@/lib/sifre";
import type { FormSonuc } from "@/app/actions";
import { revalidatePath } from "next/cache";

async function kayitliSifre(): Promise<string> {
  const ayar = await prisma.ayar.findUnique({ where: { anahtar: "uygulama_sifre" } });
  return ayar?.deger || uygulamaSifresi();
}

export async function girisYap(
  _onceki: FormSonuc,
  formData: FormData
): Promise<FormSonuc> {
  const sifre = String(formData.get("sifre") || "");
  const next = String(formData.get("next") || "/");
  const kayitli = await kayitliSifre();

  const ok = sifreDogrula(sifre, kayitli);
  if (!ok) return { hata: "Şifre hatalı." };

  const jar = await cookies();
  jar.set(OTURUM_COOKIE, await oturumTokeniOlustur(), {
    httpOnly: true,
    sameSite: "lax",
    path: "/",
    maxAge: 60 * 60 * 24 * 30,
    secure: process.env.NODE_ENV === "production",
  });

  redirect(next.startsWith("/") ? next : "/");
}

export async function cikisYap(): Promise<void> {
  const jar = await cookies();
  jar.delete(OTURUM_COOKIE);
  redirect("/giris");
}

export async function sifreDegistir(
  _onceki: FormSonuc,
  formData: FormData
): Promise<FormSonuc> {
  const mevcut = String(formData.get("mevcut") || "");
  const yeni = String(formData.get("yeni") || "");
  const yeni2 = String(formData.get("yeni2") || "");

  if (yeni.length < 4) return { hata: "Yeni şifre en az 4 karakter olmalı." };
  if (yeni !== yeni2) return { hata: "Yeni şifreler eşleşmiyor." };

  const kayitli = await kayitliSifre();
  if (!sifreDogrula(mevcut, kayitli)) return { hata: "Mevcut şifre hatalı." };

  await prisma.ayar.upsert({
    where: { anahtar: "uygulama_sifre" },
    create: { anahtar: "uygulama_sifre", deger: sifreHashle(yeni) },
    update: { deger: sifreHashle(yeni) },
  });

  revalidatePath("/ayarlar");
  return null;
}
