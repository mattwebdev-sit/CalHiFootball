import type { Metadata } from "next";
import { CURRENT_SEASON, formatLabel, normalizeFormat } from "@/lib/config";
import { getLeaguesBySection } from "@/lib/queries";
import { FormatTabs } from "@/components/FormatTabs";
import { LeaguesBrowser } from "@/components/LeaguesBrowser";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Leagues",
  description:
    "Browse California high school football leagues and conferences by CIF section, for both 8-man and 11-man competition.",
};

export default async function LeaguesPage({
  searchParams,
}: {
  searchParams: Promise<{ format?: string }>;
}) {
  const { format: formatParam } = await searchParams;
  const format = normalizeFormat(formatParam);
  const sections = await getLeaguesBySection(CURRENT_SEASON, format);

  return (
    <div className="space-y-5">
      <div>
        <h1 className="text-2xl font-black tracking-tight text-white">
          {formatLabel(format)} Leagues
        </h1>
        <p className="mt-1 text-sm text-neutral-400">
          California high school football leagues by CIF section. Teams not listed
          in a league roster are grouped as Independent.
        </p>
      </div>

      <FormatTabs active={format} hrefFor={(f) => `/leagues?format=${f}`} />

      {sections.length === 0 ? (
        <div className="card p-6 text-sm text-neutral-400">
          No leagues found for this format yet.
        </div>
      ) : (
        <LeaguesBrowser sections={sections} format={format} />
      )}
    </div>
  );
}
