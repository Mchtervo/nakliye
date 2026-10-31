import AracKmKarti from "@/components/AracKmKarti";
import BelgeKarti from "@/components/BelgeKarti";

export const dynamic = "force-dynamic";

export default function AracSayfasi() {
  return (
    <div className="mx-auto max-w-2xl space-y-4">
      <div className="reveal">
        <p className="sayfa-eyebrow">Araç</p>
        <h1 className="font-display text-3xl font-extrabold text-paper">Araç ve belgeler</h1>
      </div>
      <AracKmKarti />
      <BelgeKarti />
    </div>
  );
}
