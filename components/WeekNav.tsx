import Link from "next/link";
import { FilterSelect } from "./FilterSelect";

export function WeekNav({
  weeks,
  activeWeek,
  basePath = "/",
  params = {},
}: {
  weeks: number[];
  activeWeek: number;
  basePath?: string;
  /** Extra query params to preserve, e.g. { format, section }. */
  params?: Record<string, string>;
}) {
  const hrefFor = (w: number) => {
    const sp = new URLSearchParams({ week: String(w), ...params });
    return `${basePath}?${sp.toString()}`;
  };
  return (
    <>
      <div className="hidden flex-wrap items-center gap-1 sm:flex">
        {weeks.map((w) => (
          <Link
            key={w}
            href={hrefFor(w)}
            className={`rounded px-2.5 py-1 text-sm font-medium ${
              w === activeWeek
                ? "bg-emerald-600 text-white"
                : "bg-neutral-800 text-neutral-300 hover:bg-neutral-700"
            }`}
          >
            Wk {w}
          </Link>
        ))}
      </div>
      <FilterSelect
        label="Week"
        value={hrefFor(activeWeek)}
        options={weeks.map((w) => ({ label: `Week ${w}`, value: hrefFor(w) }))}
      />
    </>
  );
}
