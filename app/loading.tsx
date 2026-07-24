export default function Yukleniyor() {
  return (
    <div className="flex min-h-[50vh] flex-col items-center justify-center gap-4 px-4">
      <div
        className="h-10 w-10 animate-spin rounded-full border-2 border-amber/30 border-t-amber"
        aria-hidden
      />
      <p className="text-sm font-semibold text-fog">Sayfa açılıyor…</p>
    </div>
  );
}
