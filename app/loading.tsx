export default function Yukleniyor() {
  return (
    <div className="space-y-4 px-1 py-2">
      <div className="h-3 w-24 animate-pulse rounded bg-white/10" />
      <div className="h-9 w-48 animate-pulse rounded-lg bg-white/10" />
      <div className="grid grid-cols-2 gap-2.5 pt-2">
        <div className="h-24 animate-pulse rounded-2xl bg-white/8" />
        <div className="h-24 animate-pulse rounded-2xl bg-white/8" />
        <div className="h-24 animate-pulse rounded-2xl bg-white/8" />
        <div className="h-24 animate-pulse rounded-2xl bg-white/8" />
      </div>
      <div className="mt-4 space-y-3">
        <div className="h-28 animate-pulse rounded-2xl bg-white/6" />
        <div className="h-28 animate-pulse rounded-2xl bg-white/6" />
      </div>
      <p className="pt-2 text-center text-xs font-semibold text-fog">
        Açılıyor…
      </p>
    </div>
  );
}
