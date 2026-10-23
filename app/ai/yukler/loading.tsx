export default function YuklerYukleniyor() {
  return (
    <div className="mx-auto max-w-lg space-y-4 py-2" role="status" aria-label="Yük aranıyor">
      <div className="iskelet h-3 w-20" />
      <div className="iskelet h-9 w-40" />
      <div className="iskelet h-28 !rounded-[1.1rem]" />
      <div className="space-y-3 pt-2">
        <div className="iskelet h-36 !rounded-[1.1rem]" />
        <div className="iskelet h-36 !rounded-[1.1rem]" />
      </div>
      <p className="pt-3 text-center text-[15px] text-fog">Yük aranıyor…</p>
    </div>
  );
}
