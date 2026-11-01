"use client";

import { useState, useTransition } from "react";
import { ilanKaldir, sikayetSonuclandir, uyeAktifDegistir, uyeOturumlariniKapat, uyePanelineGir, uyeSifreSifirla } from "@/app/uye-actions";
import AltPanel from "@/components/ana/AltPanel";
import { Uyari } from "@/components/uyelik/Alanlar";

/** Üye ayrıntısındaki yönetici işlemleri; her biri onay ister, sonuç gerçekten bitince gösterilir. */
export function UyeIslemleri({ uyeId, aktif, ad }: { uyeId: number; aktif: boolean; ad: string }) {
  const [bekliyor, baslat] = useTransition();
  const [mesaj, setMesaj] = useState<{ ton: "tamam" | "hata"; metin: string } | null>(null);
  const [sifrePanel, setSifrePanel] = useState(false);
  const [sifre, setSifre] = useState("");

  const calistir = (soru: string, is: () => Promise<void>, basari: string) => {
    if (!confirm(soru)) return;
    setMesaj(null);
    baslat(async () => {
      try {
        await is();
        setMesaj({ ton: "tamam", metin: basari });
      } catch (e) {
        setMesaj({ ton: "hata", metin: e instanceof Error ? e.message : "İşlem yapılamadı." });
      }
    });
  };

  return (
    <div className="space-y-2.5">
      <form action={uyePanelineGir.bind(null, uyeId)}>
        <button type="submit" disabled={!aktif} className="ana-ana-dugme w-full !min-h-[3.2rem]">
          Üyenin paneline gir
        </button>
      </form>
      <div className="grid grid-cols-2 gap-2.5">
        <button type="button" disabled={bekliyor} onClick={() => setSifrePanel(true)} className="kk-cerceve-dugme">
          Şifre sıfırla
        </button>
        <button
          type="button"
          disabled={bekliyor}
          onClick={() => calistir(`${ad} hesabının tüm cihazlardaki oturumları kapansın mı?`, () => uyeOturumlariniKapat(uyeId), "Oturumlar kapatıldı.")}
          className="kk-cerceve-dugme"
        >
          Oturumları kapat
        </button>
      </div>
      <button
        type="button"
        disabled={bekliyor}
        onClick={() =>
          calistir(
            aktif ? `${ad} hesabı kapatılsın mı? Giriş yapamaz, kayıtları silinmez.` : `${ad} hesabı yeniden açılsın mı?`,
            () => uyeAktifDegistir(uyeId),
            aktif ? "Hesap kapatıldı." : "Hesap açıldı."
          )
        }
        className={`w-full py-2.5 text-[14px] font-bold ${aktif ? "text-[#dc2626]" : "text-[#16a34a]"}`}
      >
        {bekliyor ? "İşleniyor…" : aktif ? "Hesabı kapat" : "Hesabı aç"}
      </button>
      {mesaj && <Uyari ton={mesaj.ton}>{mesaj.metin}</Uyari>}

      <AltPanel acik={sifrePanel} etiket="Şifre sıfırla" kapat={() => setSifrePanel(false)} kilitli={bekliyor}>
        <form
          className="space-y-3 px-5 pb-6 pt-1"
          onSubmit={(e) => {
            e.preventDefault();
            if (sifre.length < 6) return setMesaj({ ton: "hata", metin: "Şifre en az 6 karakter olmalı." });
            baslat(async () => {
              try {
                await uyeSifreSifirla(uyeId, sifre);
                setSifre("");
                setSifrePanel(false);
                setMesaj({ ton: "tamam", metin: "Yeni şifre kaydedildi; üyenin eski oturumları kapandı. Şifreyi üyeye sen ilet." });
              } catch (err) {
                setMesaj({ ton: "hata", metin: err instanceof Error ? err.message : "Şifre kaydedilemedi." });
              }
            });
          }}
        >
          <h2 className="text-[1.3rem] font-extrabold">{ad} · yeni şifre</h2>
          <input value={sifre} onChange={(e) => setSifre(e.target.value)} autoComplete="off" className="ana-alan" placeholder="En az 6 karakter" />
          <button type="submit" disabled={bekliyor} className="ana-ana-dugme w-full">
            {bekliyor ? "Kaydediliyor…" : "Şifreyi kaydet"}
          </button>
        </form>
      </AltPanel>
    </div>
  );
}

/** Şikâyet: ilanı kaldır (herkesin listesinden) ya da yok say. */
export function SikayetIslem({ id }: { id: number }) {
  const [bekliyor, baslat] = useTransition();
  const [bitti, setBitti] = useState<string | null>(null);
  if (bitti) return <p className="text-[12.5px] font-bold text-[#16a34a]">{bitti}</p>;
  const yap = (islem: "KALDIR" | "YOKSAY") => {
    if (!confirm(islem === "KALDIR" ? "İlan tüm listelerden kaldırılsın mı?" : "Şikâyet yok sayılsın mı?")) return;
    baslat(async () => {
      await sikayetSonuclandir(id, islem);
      setBitti(islem === "KALDIR" ? "İlan kaldırıldı" : "Yok sayıldı");
    });
  };
  return (
    <div className="flex gap-2">
      <button type="button" disabled={bekliyor} onClick={() => yap("KALDIR")} className="ana-hap !text-[#dc2626]">
        İlanı kaldır
      </button>
      <button type="button" disabled={bekliyor} onClick={() => yap("YOKSAY")} className="ana-hap">
        Yok say
      </button>
    </div>
  );
}

/** Şüpheli ilanı herkesin listesinden kaldır. */
export function IlanKaldir({ id }: { id: number }) {
  const [bekliyor, baslat] = useTransition();
  const [bitti, setBitti] = useState(false);
  if (bitti) return <p className="text-[12.5px] font-bold text-[#16a34a]">Kaldırıldı</p>;
  return (
    <button
      type="button"
      disabled={bekliyor}
      onClick={() =>
        confirm("İlan tüm listelerden kaldırılsın mı?") &&
        baslat(async () => {
          await ilanKaldir(id);
          setBitti(true);
        })
      }
      className="ana-hap !text-[#dc2626]"
    >
      {bekliyor ? "…" : "Kaldır"}
    </button>
  );
}
