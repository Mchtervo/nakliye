"use client";

import { useState, useTransition } from "react";
import {
  aiButceKesiminiAc,
  aiTestOnMesaj,
  type AiSonuc,
} from "@/app/ai-actions";
import type { AiMaliyetOzeti } from "@/lib/ai/maliyetOzeti";

export default function AiMaliyetPaneli({ ozet }: { ozet: AiMaliyetOzeti }) {
  const [bekliyor, baslat] = useTransition();
  const [sonuc, setSonuc] = useState<AiSonuc>(null);

  return (
    <div className="space-y-3 border-t border-white/8 pt-3">
      <div>
        <h3 className="font-display text-base font-bold text-paper">
          AI maliyet & koruma
        </h3>
        <p className="text-sm text-fog">
          Her OpenAI çağrısı loglanır. Ölçemediğin şeyi yönetemezsin.
        </p>
      </div>

      <div className="grid grid-cols-2 gap-2 text-sm">
        <div className="rounded-xl border border-white/10 bg-white/4 px-3 py-2">
          <div className="text-[11px] font-bold uppercase tracking-wider text-fog">
            Bugün
          </div>
          <div className="font-display text-lg font-bold text-paper">
            {ozet.bugunYazi}
          </div>
          <div className="text-xs text-fog">
            limit {ozet.limitYazi} · kalan {ozet.kalanYazi}
          </div>
        </div>
        <div className="rounded-xl border border-white/10 bg-white/4 px-3 py-2">
          <div className="text-[11px] font-bold uppercase tracking-wider text-fog">
            Çağrı (bugün)
          </div>
          <div className="font-display text-lg font-bold text-paper">
            {ozet.gunluk.cagri}
          </div>
          <div className="text-xs text-fog">
            {ozet.gunluk.basarili} başarılı · in {ozet.gunluk.girdiToken} / out{" "}
            {ozet.gunluk.ciktiToken}
            {ozet.gunluk.reasoningToken > 0
              ? ` · reason ${ozet.gunluk.reasoningToken}`
              : ""}
          </div>
        </div>
      </div>

      <div className="flex flex-wrap gap-2 text-[11px] font-bold uppercase tracking-wider">
        <span
          className={`rounded-full border px-2.5 py-1 ${
            ozet.killSwitch
              ? "border-ok/35 bg-ok/12 text-ok"
              : "border-warn/40 bg-warn/15 text-warn"
          }`}
        >
          AI_KAPALI {ozet.killSwitch ? "açık" : "kapalı"}
        </span>
        <span
          className={`rounded-full border px-2.5 py-1 ${
            ozet.butceKesildi
              ? "border-warn/40 bg-warn/15 text-warn"
              : "border-white/15 bg-white/5 text-fog"
          }`}
        >
          bütçe {ozet.butceKesildi ? "KESİLDİ" : "normal"}
        </span>
        <span className="rounded-full border border-white/15 bg-white/5 px-2.5 py-1 text-fog">
          max_out {ozet.maxCikti} · timeout {Math.round(ozet.zamanAsimiMs / 1000)}s
        </span>
      </div>

      {ozet.saatlik.length > 0 && (
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="text-fog">
              <tr>
                <th className="py-1 pr-2 font-semibold">Saat</th>
                <th className="py-1 pr-2 font-semibold">Çağrı</th>
                <th className="py-1 pr-2 font-semibold">Token</th>
                <th className="py-1 font-semibold">Maliyet</th>
              </tr>
            </thead>
            <tbody>
              {ozet.saatlik.map((s) => (
                <tr key={s.etiket} className="border-t border-white/6 text-paper">
                  <td className="py-1.5 pr-2">{s.etiket}</td>
                  <td className="py-1.5 pr-2">{s.cagri}</td>
                  <td className="py-1.5 pr-2 text-fog">
                    {s.girdiToken}/{s.ciktiToken}
                    {s.reasoningToken > 0 ? ` r${s.reasoningToken}` : ""}
                  </td>
                  <td className="py-1.5 font-semibold">{s.maliyetYazi}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {ozet.sonCagrilar.length > 0 ? (
        <div className="overflow-x-auto">
          <div className="mb-1 text-[11px] font-bold uppercase tracking-wider text-fog">
            Son çağrılar
          </div>
          <table className="w-full text-left text-xs">
            <thead className="text-fog">
              <tr>
                <th className="py-1 pr-2 font-semibold">Zaman</th>
                <th className="py-1 pr-2 font-semibold">Dosya</th>
                <th className="py-1 pr-2 font-semibold">Token</th>
                <th className="py-1 font-semibold">$</th>
              </tr>
            </thead>
            <tbody>
              {ozet.sonCagrilar.map((c, i) => (
                <tr
                  key={`${c.zamanYazi}-${i}`}
                  className="border-t border-white/6 text-paper"
                >
                  <td className="py-1.5 pr-2 whitespace-nowrap">{c.zamanYazi}</td>
                  <td className="py-1.5 pr-2">
                    {c.kaynak}
                    {!c.basarili ? " · hata" : ""}
                  </td>
                  <td className="py-1.5 pr-2 text-fog">
                    {c.girdiToken}/{c.ciktiToken}
                    {c.reasoningToken > 0 ? ` r${c.reasoningToken}` : ""}
                  </td>
                  <td className="py-1.5 font-semibold">{c.maliyetYazi}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : (
        <p className="text-xs text-fog">
          Henüz AiCagri kaydı yok — kill switch açıkken cron çağrı yapmaz.
        </p>
      )}

      <div className="flex flex-wrap gap-2">
        <button
          type="button"
          disabled={bekliyor}
          onClick={() => {
            if (
              !window.confirm(
                "10 mesaj işlenecek ve duracak. AI_KAPALI cron'ları etkilemez. Devam?"
              )
            ) {
              return;
            }
            baslat(async () => {
              setSonuc(null);
              setSonuc(await aiTestOnMesaj());
            });
          }}
          className="btn btn-ghost !px-3 !py-2 text-xs sm:text-sm disabled:opacity-60"
        >
          {bekliyor ? "Test çalışıyor..." : "Test: 10 mesaj işle ve dur"}
        </button>

        {ozet.butceKesildi && (
          <button
            type="button"
            disabled={bekliyor}
            onClick={() => {
              if (!window.confirm("Bütçe kesmesini kaldırmak istediğine emin misin?")) {
                return;
              }
              baslat(async () => {
                setSonuc(await aiButceKesiminiAc());
              });
            }}
            className="btn btn-ghost !px-3 !py-2 text-xs sm:text-sm disabled:opacity-60"
          >
            Bütçe kesmesini aç
          </button>
        )}
      </div>

      {sonuc && "bilgi" in sonuc && (
        <pre className="whitespace-pre-wrap rounded-xl border border-ok/25 bg-ok/10 px-3 py-2.5 text-xs text-paper">
          {sonuc.bilgi}
        </pre>
      )}
      {sonuc && "hata" in sonuc && (
        <pre className="whitespace-pre-wrap rounded-xl border border-warn/30 bg-warn/10 px-3 py-2.5 text-xs text-paper">
          {sonuc.hata}
        </pre>
      )}
    </div>
  );
}
