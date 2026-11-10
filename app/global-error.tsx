"use client";

/** Kök düzen bile açılamazsa: açık zeminli, tek düğmeli sade sayfa. */
export default function KokHata({ reset }: { error: Error & { digest?: string }; reset: () => void }) {
  return (
    <html lang="tr">
      <body style={{ margin: 0, background: "#f3f5fc", color: "#111827", fontFamily: "system-ui, sans-serif" }}>
        <div style={{ minHeight: "100dvh", display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: 16, padding: 24, textAlign: "center" }}>
          <h1 style={{ fontSize: 22, margin: 0 }}>Uygulama açılamadı</h1>
          <p style={{ fontSize: 15, color: "#4b5375", margin: 0 }}>Bağlantı yavaş olabilir. Kayıtların duruyor.</p>
          <button
            type="button"
            onClick={() => (reset ? reset() : location.reload())}
            style={{ border: 0, borderRadius: 16, padding: "14px 28px", background: "#4f46e5", color: "#fff", fontSize: 16, fontWeight: 700 }}
          >
            Tekrar dene
          </button>
        </div>
      </body>
    </html>
  );
}
