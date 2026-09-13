import Link from "next/link";
import { TEAM_FORMATS, TeamFormat } from "@/lib/config";

/**
 * Toggle between the 8-man and 11-man competitions. `hrefFor` builds the target
 * URL for each format so the same control works on the home and rankings pages.
 */
export function FormatTabs({
  active,
  hrefFor,
}: {
  active: TeamFormat;
  hrefFor: (format: TeamFormat) => string;
}) {
  return (
    <div className="inline-flex rounded-lg border border-neutral-800 bg-neutral-900 p-0.5">
      {TEAM_FORMATS.map((f) => (
        <Link
          key={f.value}
          href={hrefFor(f.value)}
          className={`rounded-md px-3 py-1 text-sm font-semibold transition-colors ${
            active === f.value
              ? "bg-emerald-600 text-white"
              : "text-neutral-400 hover:text-neutral-200"
          }`}
        >
          {f.label}
        </Link>
      ))}
    </div>
  );
}
