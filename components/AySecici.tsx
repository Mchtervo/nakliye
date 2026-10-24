import Link from "next/link";
import { ayEtiketi, ayParametresi } from "@/lib/kdv";

export default function AySecici({
  yol,
  yil,
  ay,
}: {
  yol: string;
  yil: number;
  ay: number;
}) {
  const onceki = new Date(yil, ay - 2, 1);
  const sonraki = new Date(yil, ay, 1);
  const ayHref = (d: Date) =>
    `${yol}?ay=${ayParametresi(d.getFullYear(), d.getMonth() + 1)}`;

  return (
    <div className="flex items-center gap-1 rounded-xl border border-white/10 bg-asphalt-2 p-1">
      <Link
        href={ayHref(onceki)}
        className="rounded-lg px-3 py-1.5 text-sm font-semibold text-fog hover:bg-white/5 hover:text-paper"
      >
        ←
      </Link>
      <span className="min-w-[9rem] text-center text-sm font-bold capitalize text-paper">
        {ayEtiketi(yil, ay)}
      </span>
      <Link
        href={ayHref(sonraki)}
        className="rounded-lg px-3 py-1.5 text-sm font-semibold text-fog hover:bg-white/5 hover:text-paper"
      >
        →
      </Link>
    </div>
  );
}
