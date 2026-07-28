export default function YuklerYukleniyor() {
  return (
    <div className="mx-auto max-w-lg space-y-4 px-1 py-2">
      <div className="h-3 w-20 animate-pulse rounded bg-white/10" />
      <div className="h-9 w-40 animate-pulse rounded-lg bg-white/10" />
      <div className="h-28 animate-pulse rounded-2xl bg-white/8" />
      <div className="space-y-3 pt-2">
        <div className="h-36 animate-pulse rounded-2xl bg-white/6" />
        <div className="h-36 animate-pulse rounded-2xl bg-white/6" />
      </div>
      <p className="pt-3 text-center text-sm font-bold text-amber">
        Yük aranıyor…
      </p>
    </div>
  );
}
