export default function Yukleniyor() {
  return (
    <div className="space-y-4 py-2" role="status" aria-label="Açılıyor">
      <div className="iskelet h-3 w-24" />
      <div className="iskelet h-9 w-48" />
      <div className="grid grid-cols-2 gap-2.5 pt-2">
        <div className="iskelet h-24 !rounded-[1.1rem]" />
        <div className="iskelet h-24 !rounded-[1.1rem]" />
        <div className="iskelet h-24 !rounded-[1.1rem]" />
        <div className="iskelet h-24 !rounded-[1.1rem]" />
      </div>
      <div className="mt-4 space-y-3">
        <div className="iskelet h-28 !rounded-[1.1rem]" />
        <div className="iskelet h-28 !rounded-[1.1rem]" />
      </div>
    </div>
  );
}
