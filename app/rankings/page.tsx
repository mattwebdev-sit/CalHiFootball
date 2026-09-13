import Link from "next/link";
import type { Metadata } from "next";
import { CURRENT_SEASON, formatLabel, normalizeFormat } from "@/lib/config";
import {
  getLeaguesBySection,
  getRankings,
  getSectionsWithRankedTeams,
} from "@/lib/queries";
import { RankingsTable } from "@/components/RankingsTable";
import { FormatTabs } from "@/components/FormatTabs";
import { FilterSelect } from "@/components/FilterSelect";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "California Rankings",
  description:
    "Full statewide CalHi power ratings for California high school football, split by 8-man and 11-man competition and filterable by CIF section and league.",
};

export default async function RankingsPage({
  searchParams,
}: {
  searchParams: Promise<{ section?: string; format?: string; league?: string }>;
}) {
  const { section, format: formatParam, league } = await searchParams;
  const format = normalizeFormat(formatParam);
  const [teams, sections, sectionLeagues] = await Promise.all([
    getRankings(CURRENT_SEASON, { section, format, league }),
    getSectionsWithRankedTeams(CURRENT_SEASON, format),
    // Leagues only matter once a section is chosen.
    section
      ? getLeaguesBySection(CURRENT_SEASON, format)
      : Promise.resolve([]),
  ]);

  const activeSectionLeagues = section
    ? sectionLeagues.find((s) => s.code === section)
    : undefined;

  const sectionOptions = [
    { label: "All CA sections", value: `/rankings?format=${format}` },
    ...sections.map((s) => ({
      label: s.name,
      value: `/rankings?format=${format}&section=${s.code}`,
    })),
  ];
  const sectionValue = section
    ? `/rankings?format=${format}&section=${section}`
    : `/rankings?format=${format}`;

  const leagueBase = `/rankings?format=${format}&section=${section}`;
  const leagueOptions = activeSectionLeagues
    ? [
        { label: "All leagues", value: leagueBase },
        ...activeSectionLeagues.leagues.map((l) => ({
          label: l.name,
          value: `${leagueBase}&league=${l.slug}`,
        })),
        ...(activeSectionLeagues.independentCount > 0
          ? [{ label: "Independent", value: `${leagueBase}&league=independent` }]
          : []),
      ]
    : [];
  const leagueValue = league ? `${leagueBase}&league=${league}` : leagueBase;

  return (
    <div className="space-y-5">
      <div>
        <h1 className="text-2xl font-black tracking-tight text-white">
          {CURRENT_SEASON} California {formatLabel(format)} Rankings
        </h1>
        <p className="mt-1 text-sm text-neutral-400">
          {teams.length} teams ranked by CalHi power rating. 8-man and 11-man are
          ranked as separate competitions. The rank shown is the statewide rank
          within the selected format, even when filtered by section or league.
        </p>
      </div>

      <FormatTabs active={format} hrefFor={(f) => `/rankings?format=${f}`} />

      <div className="hidden flex-wrap items-center gap-1 sm:flex">
        <FilterChip
          label="All CA"
          href={`/rankings?format=${format}`}
          active={!section}
        />
        {sections.map((s) => (
          <FilterChip
            key={s.code}
            label={s.code}
            title={s.name}
            href={`/rankings?format=${format}&section=${s.code}`}
            active={section === s.code}
          />
        ))}
      </div>
      <FilterSelect label="Section" value={sectionValue} options={sectionOptions} />

      {activeSectionLeagues &&
      (activeSectionLeagues.leagues.length > 0 ||
        activeSectionLeagues.independentCount > 0) ? (
        <>
          <div className="hidden flex-wrap items-center gap-1 sm:flex">
            <FilterChip
              label="All leagues"
              href={`/rankings?format=${format}&section=${section}`}
              active={!league}
            />
            {activeSectionLeagues.leagues.map((l) => (
              <FilterChip
                key={l.slug}
                label={l.name}
                href={`/rankings?format=${format}&section=${section}&league=${l.slug}`}
                active={league === l.slug}
              />
            ))}
            {activeSectionLeagues.independentCount > 0 ? (
              <FilterChip
                label="Independent"
                href={`/rankings?format=${format}&section=${section}&league=independent`}
                active={league === "independent"}
              />
            ) : null}
          </div>
          <FilterSelect label="League" value={leagueValue} options={leagueOptions} />
        </>
      ) : null}

      <RankingsTable teams={teams} />
    </div>
  );
}

function FilterChip({
  label,
  href,
  active,
  title,
}: {
  label: string;
  href: string;
  active: boolean;
  title?: string;
}) {
  return (
    <Link
      href={href}
      title={title}
      className={`rounded px-2.5 py-1 text-sm font-medium ${
        active
          ? "bg-emerald-600 text-white"
          : "bg-neutral-800 text-neutral-300 hover:bg-neutral-700"
      }`}
    >
      {label}
    </Link>
  );
}
