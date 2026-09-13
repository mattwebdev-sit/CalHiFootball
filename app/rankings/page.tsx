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

const PAGE_SIZE = 100;

export default async function RankingsPage({
  searchParams,
}: {
  searchParams: Promise<{
    section?: string;
    format?: string;
    league?: string;
    page?: string;
  }>;
}) {
  const { section, format: formatParam, league, page: pageParam } = await searchParams;
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

  // Paginate so we only render ~100 rows per request instead of 1,000+.
  const totalPages = Math.max(1, Math.ceil(teams.length / PAGE_SIZE));
  const currentPage = Math.min(
    Math.max(1, Number(pageParam) || 1),
    totalPages
  );
  const start = (currentPage - 1) * PAGE_SIZE;
  const pageTeams = teams.slice(start, start + PAGE_SIZE);
  const pageHref = (p: number) => {
    const sp = new URLSearchParams({ format });
    if (section) sp.set("section", section);
    if (league) sp.set("league", league);
    if (p > 1) sp.set("page", String(p));
    return `/rankings?${sp.toString()}`;
  };

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
        {teams.length > PAGE_SIZE ? (
          <p className="mt-1 text-xs text-neutral-500">
            Showing {start + 1}&ndash;{Math.min(start + PAGE_SIZE, teams.length)} of{" "}
            {teams.length}.
          </p>
        ) : null}
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

      <RankingsTable teams={pageTeams} />

      {totalPages > 1 ? (
        <Pagination
          currentPage={currentPage}
          totalPages={totalPages}
          hrefFor={pageHref}
        />
      ) : null}
    </div>
  );
}

function Pagination({
  currentPage,
  totalPages,
  hrefFor,
}: {
  currentPage: number;
  totalPages: number;
  hrefFor: (page: number) => string;
}) {
  // Compact window of page numbers around the current page.
  const pages: number[] = [];
  const from = Math.max(1, currentPage - 2);
  const to = Math.min(totalPages, currentPage + 2);
  for (let p = from; p <= to; p++) pages.push(p);

  const btn =
    "rounded px-3 py-1.5 text-sm font-medium tabular-nums bg-neutral-800 text-neutral-300 hover:bg-neutral-700";
  const active = "rounded px-3 py-1.5 text-sm font-bold tabular-nums bg-emerald-600 text-white";
  const disabled = "rounded px-3 py-1.5 text-sm font-medium text-neutral-600";

  return (
    <nav
      aria-label="Rankings pagination"
      className="flex flex-wrap items-center justify-center gap-1 pt-2"
    >
      {currentPage > 1 ? (
        <Link href={hrefFor(currentPage - 1)} className={btn}>
          &larr; Prev
        </Link>
      ) : (
        <span className={disabled}>&larr; Prev</span>
      )}

      {from > 1 ? (
        <>
          <Link href={hrefFor(1)} className={btn}>
            1
          </Link>
          {from > 2 ? <span className="px-1 text-neutral-600">&hellip;</span> : null}
        </>
      ) : null}

      {pages.map((p) => (
        <Link key={p} href={hrefFor(p)} className={p === currentPage ? active : btn}>
          {p}
        </Link>
      ))}

      {to < totalPages ? (
        <>
          {to < totalPages - 1 ? (
            <span className="px-1 text-neutral-600">&hellip;</span>
          ) : null}
          <Link href={hrefFor(totalPages)} className={btn}>
            {totalPages}
          </Link>
        </>
      ) : null}

      {currentPage < totalPages ? (
        <Link href={hrefFor(currentPage + 1)} className={btn}>
          Next &rarr;
        </Link>
      ) : (
        <span className={disabled}>Next &rarr;</span>
      )}
    </nav>
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
