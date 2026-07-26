import Link from "next/link";
import GiderForm from "@/components/GiderForm";
import { aiKullanilabilir } from "@/lib/ai/istemci";
import { bugunTarihStr } from "@/lib/tarih";

export default function YeniGiderSayfasi() {
  return (
    <div className="mx-auto max-w-lg space-y-4">
      <div className="reveal">
        <p className="text-[11px] font-bold uppercase tracking-[0.18em] text-amber">
          Harcama
        </p>
        <h1 className="font-display text-3xl font-extrabold text-paper">Yeni Gider</h1>
      </div>
      <div className="kart-paper p-4 sm:p-6 reveal reveal-d1">
        <GiderForm
          bugunTarih={bugunTarihStr()}
          aiOcr={aiKullanilabilir()}
        />
      </div>
      <Link
        href="/giderler"
        className="block text-center text-sm font-medium text-fog transition-colors hover:text-amber"
      >
        ← Giderlere dön
      </Link>
    </div>
  );
}
