"use client";

import { useState } from "react";
import AltPanel from "@/components/ana/AltPanel";
import YeniUyeForm from "@/components/uye/YeniUyeForm";

/** Yönetici elle üye açar (kullanıcı adı + şifre); üye kurulumu ilk girişte yapar. */
export default function YeniUyePaneli() {
  const [acik, setAcik] = useState(false);
  return (
    <>
      <button type="button" onClick={() => setAcik(true)} className="ana-hap">
        + Yeni üye
      </button>
      <AltPanel acik={acik} etiket="Yeni üye" kapat={() => setAcik(false)}>
        <div className="space-y-3 px-5 pb-6 pt-1">
          <h2 className="text-[1.3rem] font-extrabold">Yeni üye</h2>
          <p className="text-[13px] text-[var(--a-ikincil)]">Üyeler normalde kendileri kaydolur; bu yol elle hesap açmak içindir.</p>
          <YeniUyeForm />
        </div>
      </AltPanel>
    </>
  );
}
