"use server";

import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { GORUNUM_COOKIE, OTURUM_COOKIE, oturumTokeniOlustur, uyeTokeniOlustur, uygulamaSifresi } from "@/lib/auth";
import { aktifBaglam } from "@/lib/baglam";
import { anaPrisma } from "@/lib/prismaAna";
import { sifreDogrula, sifreHashle } from "@/lib/sifre";
import type { FormSonuc } from "@/app/actions";
import { revalidatePath } from "next/cache";

async function kayitliSifre(): Promise<string> {
  // Her zaman ana şemadan: tarayıcıda eski üye çerezi olsa da yönetici şifresi okunur
  const ayar = await anaPrisma.ayar.findUnique({ where: { anahtar: "uygulama_sifre" } });
  return ayar?.deger || uygulamaSifresi();
}

export async function girisYap(
  _onceki: FormSonuc,
  formData: FormData
): Promise<FormSonuc> {
  const sifre = String(formData.get("sifre") || "");
  const next = String(formData.get("next") || "/");
  const kullaniciAdi = String(formData.get("kullaniciAdi") || "").trim().toLocaleLowerCase("tr-TR");

  let token: string;
  if (kullaniciAdi) {
    // Üye girişi: kendi şemasıyla çalışır, yönetici verisini göremez
    const uye = await anaPrisma.uye.findUnique({ where: { kullaniciAdi } });
    if (!uye || !uye.aktif || !uye.sifreHash.includes(":") || !sifreDogrula(sifre, uye.sifreHash)) {
      await new Promise((r) => setTimeout(r, 1200));
      return { hata: "Kullanıcı adı veya şifre hatalı." };
    }
    await anaPrisma.uye.update({ where: { id: uye.id }, data: { sonGiris: new Date() } });
    token = await uyeTokeniOlustur(uye.id);
  } else {
    const ok = sifreDogrula(sifre, await kayitliSifre());
    if (!ok) {
      // Kaba kuvvet denemelerini yavaşlat (şifre en az 4 karakter olabiliyor)
      await new Promise((r) => setTimeout(r, 1200));
      return { hata: "Şifre hatalı." };
    }
    token = await oturumTokeniOlustur();
  }

  const jar = await cookies();
  jar.delete(GORUNUM_COOKIE);
  jar.set(OTURUM_COOKIE, token, {
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
  jar.delete(GORUNUM_COOKIE);
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

  // Üye kendi şifresini değiştirir (yöneticinin üye görünümünde kapalı)
  const b = await aktifBaglam();
  if (b.uyeId !== null) {
    if (b.yoneticiGoruyor) return { hata: "Üye görünümünde şifre değiştirilemez." };
    const uye = await anaPrisma.uye.findUnique({ where: { id: b.uyeId } });
    if (!uye || !sifreDogrula(mevcut, uye.sifreHash)) return { hata: "Mevcut şifre hatalı." };
    await anaPrisma.uye.update({ where: { id: uye.id }, data: { sifreHash: sifreHashle(yeni) } });
    revalidatePath("/profil");
    return null;
  }

  const kayitli = await kayitliSifre();
  if (!sifreDogrula(mevcut, kayitli)) return { hata: "Mevcut şifre hatalı." };

  await anaPrisma.ayar.upsert({
    where: { anahtar: "uygulama_sifre" },
    create: { anahtar: "uygulama_sifre", deger: sifreHashle(yeni) },
    update: { deger: sifreHashle(yeni) },
  });

  revalidatePath("/ayarlar");
  return null;
}
