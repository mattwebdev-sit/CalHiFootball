import { notFound } from "next/navigation";
import type { Metadata } from "next";
import { CURRENT_SEASON, formatLabel } from "@/lib/config";
import {
  getLatestScoredWeek,
  getLeaguePage,
  getScoreboard,
  getWeeks,
} from "@/lib/queries";
import { RankingsTable } from "@/components/RankingsTable";
import { Scoreboard } from "@/components/Scoreboard";
import { Breadcrumbs } from "@/components/Breadcrumbs";
import type { TeamFormat } from "@/lib/config";

export const dynamic = "force-dynamic";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>;
}): Promise<Metadata> {
  const { slug } = await params;
  const league = await getLeaguePage(slug, CURRENT_SEASON);
  if (!league) return { title: "League not found" };
  return {
    title: `${league.name}`,
    description: `${league.name} (${league.sectionName}) ${CURRENT_SEASON} standings and CalHi power ratings.`,
  };
}

export default async function LeaguePageView({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const league = await getLeaguePage(slug, CURRENT_SEASON);
  if (!league) notFound();

  const format = league.format as TeamFormat;
  const weeks = await getWeeks(CURRENT_SEASON, format);
  const week = (await getLatestScoredWeek(CURRENT_SEASON, format)) ?? weeks.at(-1);
  const games = week
    ? await getScoreboard(CURRENT_SEASON, week, format, undefined, slug)
    : [];

  return (
    <div className="space-y-6">
      <div className="space-y-2">
        <Breadcrumbs
          items={[
            { label: "California", href: `/rankings?format=${format}` },
            {
              label: league.sectionName,
              href: `/rankings?format=${format}&section=${league.sectionCode}`,
            },
            { label: league.name },
          ]}
        />
        <div>
          <h1 className="text-2xl font-black tracking-tight text-white">
            {league.name}
          </h1>
          <p className="mt-1 text-sm text-neutral-400">
            {league.sectionName} &middot; {formatLabel(league.format)} &middot;{" "}
            {league.teams.length} ranked {league.teams.length === 1 ? "team" : "teams"}
          </p>
        </div>
      </div>

      <section>
        <h2 className="mb-3 text-lg font-bold text-white">Standings</h2>
        <RankingsTable teams={league.teams} />
      </section>

      {games.length > 0 ? (
        <section>
          <h2 className="mb-3 text-lg font-bold text-white">
            Week {week} Scoreboard
          </h2>
          <Scoreboard games={games} />
        </section>
      ) : null}
    </div>
  );
}
