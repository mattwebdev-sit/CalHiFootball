import Link from "next/link";
import { CURRENT_SEASON, formatLabel, normalizeFormat } from "@/lib/config";
import {
  getLatestScoredWeek,
  getRankings,
  getScoreboard,
  getScoreboardSections,
  getWeeks,
} from "@/lib/queries";
import { Scoreboard } from "@/components/Scoreboard";
import { RankingsTable } from "@/components/RankingsTable";
import { WeekNav } from "@/components/WeekNav";
import { FormatTabs } from "@/components/FormatTabs";
import { FilterSelect } from "@/components/FilterSelect";

export const dynamic = "force-dynamic";

export default async function HomePage({
  searchParams,
}: {
  searchParams: Promise<{ week?: string; format?: string; section?: string }>;
}) {
  const { week: weekParam, format: formatParam, section } = await searchParams;
  const format = normalizeFormat(formatParam);
  const weeks = await getWeeks(CURRENT_SEASON, format);
  const latest =
    (await getLatestScoredWeek(CURRENT_SEASON, format)) ?? weeks.at(-1) ?? 1;
  const requested = weekParam ? Number(weekParam) : latest;
  const activeWeek = weeks.includes(requested) ? requested : latest;

  const [games, topTeams, sections] = await Promise.all([
    getScoreboard(CURRENT_SEASON, activeWeek, format, section),
    getRankings(CURRENT_SEASON, { format }),
    getScoreboardSections(CURRENT_SEASON, format),
  ]);
  const top25 = topTeams.slice(0, 25);

  const weekParams: Record<string, string> = { format };
  if (section) weekParams.section = section;
  const scoreboardBase = (params: Record<string, string>) => {
    const sp = new URLSearchParams({ format, week: String(activeWeek), ...params });
    return `/?${sp.toString()}`;
  };

  const sectionOptions = [
    { label: "All CA sections", value: scoreboardBase({}) },
    ...sections.map((s) => ({
      label: s.name,
      value: scoreboardBase({ section: s.code }),
    })),
  ];
  const sectionValue = section ? scoreboardBase({ section }) : scoreboardBase({});

  return (
    <div className="space-y-8">
      <section className="card bg-gradient-to-br from-field/40 to-neutral-900 p-6">
        <h1 className="text-2xl font-black tracking-tight text-white sm:text-3xl">
          California High School Football, by the numbers
        </h1>
        <p className="mt-2 max-w-2xl text-sm text-neutral-300">
          CalHiFootball ranks every California team with an objective, results-only
          power rating. No polls, no bias &mdash; just who beat whom, and by how
          much. Ratings update as scores come in.
        </p>
      </section>

      <FormatTabs active={format} hrefFor={(f) => `/?format=${f}`} />

      <div className="grid grid-cols-1 gap-8 lg:grid-cols-3">
        <section className="lg:col-span-2">
          <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
            <h2 className="text-lg font-bold text-white">
              {formatLabel(format)} Scoreboard &mdash; {CURRENT_SEASON} Week{" "}
              {activeWeek}
            </h2>
            <WeekNav weeks={weeks} activeWeek={activeWeek} params={weekParams} />
          </div>

          <div className="mb-3 hidden flex-wrap items-center gap-1 sm:flex">
            <SectionChip label="All CA" href={scoreboardBase({})} active={!section} />
            {sections.map((s) => (
              <SectionChip
                key={s.code}
                label={s.code}
                title={s.name}
                href={scoreboardBase({ section: s.code })}
                active={section === s.code}
              />
            ))}
          </div>
          <div className="mb-3">
            <FilterSelect label="Section" value={sectionValue} options={sectionOptions} />
          </div>

          <Scoreboard games={games} />
        </section>

        <section>
          <div className="mb-3 flex items-center justify-between">
            <h2 className="text-lg font-bold text-white">
              {formatLabel(format)} Top 25
            </h2>
            <Link href={`/rankings?format=${format}`} className="link text-sm">
              Full rankings &rarr;
            </Link>
          </div>
          <RankingsTable teams={top25} compact />
        </section>
      </div>
    </div>
  );
}

function SectionChip({
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
