import { notFound } from "next/navigation";
import Link from "next/link";
import type { Metadata } from "next";
import { CURRENT_SEASON, formatLabel } from "@/lib/config";
import { getTeamPage } from "@/lib/queries";
import {
  formatGameDate,
  formatRating,
  formatRecord,
  formatSigned,
  gameDisplayStatus,
  ordinal,
} from "@/lib/format";
import { TeamLink } from "@/components/TeamLink";

export const dynamic = "force-dynamic";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>;
}): Promise<Metadata> {
  const { slug } = await params;
  const team = await getTeamPage(slug, CURRENT_SEASON);
  if (!team) return { title: "Team not found" };
  const rankText = team.rank ? ` — No. ${team.rank} in California` : "";
  return {
    title: `${team.name}${team.city ? ` (${team.city})` : ""}`,
    description: `${team.name} ${CURRENT_SEASON} CalHi rating, record, and schedule${rankText}.`,
  };
}

export default async function TeamPageView({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const team = await getTeamPage(slug, CURRENT_SEASON);
  if (!team) notFound();

  return (
    <div className="space-y-6">
      <div className="card p-6">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <div className="flex flex-wrap items-center gap-2">
              <h1 className="text-2xl font-black tracking-tight text-white">
                {team.name}
                {team.mascot ? (
                  <span className="ml-2 text-base font-medium text-neutral-400">
                    {team.mascot}
                  </span>
                ) : null}
              </h1>
              <Link
                href={`/rankings?format=${team.format}`}
                className="rounded-full bg-neutral-800 px-2.5 py-0.5 text-xs font-semibold text-neutral-300 hover:bg-neutral-700"
              >
                {formatLabel(team.format)}
              </Link>
              {team.leagueSlug ? (
                <Link
                  href={`/leagues/${team.leagueSlug}`}
                  className="rounded-full bg-emerald-900/50 px-2.5 py-0.5 text-xs font-semibold text-emerald-300 hover:bg-emerald-900"
                >
                  {team.leagueName}
                </Link>
              ) : null}
            </div>
            <p className="mt-1 text-sm text-neutral-400">
              {[team.city, team.sectionName].filter(Boolean).join(" · ")}
              {team.isOutOfState ? " · Out of state (unranked)" : ""}
            </p>
          </div>
          <div className="grid w-full grid-cols-3 gap-x-6 gap-y-4 text-left sm:flex sm:w-auto sm:gap-6 sm:text-right">
            <Stat label="Record" value={formatRecord(team.wins, team.losses, team.ties)} />
            <Stat
              label="CalHi Rating"
              value={team.rating !== null ? formatRating(team.rating) : "—"}
              accent
            />
            <Stat
              label={`CA Rank (${formatLabel(team.format)})`}
              value={team.rank ? ordinal(team.rank) : "—"}
            />
            <Stat
              label={`${team.sectionCode} Rank`}
              value={team.sectionRank ? ordinal(team.sectionRank) : "—"}
            />
            {team.leagueSlug ? (
              <Stat
                label="League Rank"
                value={team.leagueRank ? ordinal(team.leagueRank) : "—"}
              />
            ) : null}
            <Stat
              label="SOS"
              value={team.sos !== null ? formatSigned(team.sos) : "—"}
            />
          </div>
        </div>
      </div>

      <section>
        <h2 className="mb-3 text-lg font-bold text-white">
          {CURRENT_SEASON} Schedule &amp; Results
        </h2>
        <div className="card overflow-x-auto">
          <table className="w-full border-collapse">
            <thead className="bg-neutral-900 text-left text-xs uppercase tracking-wide text-neutral-400">
              <tr>
                <th className="table-cell">Date</th>
                <th className="table-cell w-8" />
                <th className="table-cell">Opponent</th>
                <th className="table-cell text-center">Result</th>
                <th className="table-cell text-right">Opp Rating</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-neutral-800">
              {team.games.map((g) => (
                <tr key={g.id} className="hover:bg-white/5">
                  <td className="table-cell whitespace-nowrap text-neutral-400">
                    {formatGameDate(g.date)}
                  </td>
                  <td className="table-cell text-xs text-neutral-500">
                    {g.isHome ? "vs" : "@"}
                  </td>
                  <td className="table-cell">
                    <TeamLink
                      slug={g.opponent.slug}
                      name={g.opponent.name}
                      rank={g.opponent.rank}
                      className="hover:text-emerald-300"
                    />
                  </td>
                  <td className="table-cell text-center tabular-nums">
                    {g.result ? (
                      <span className="inline-flex items-center gap-1.5">
                        <span
                          className={
                            g.result === "W"
                              ? "font-semibold text-emerald-400"
                              : g.result === "L"
                              ? "font-semibold text-red-400"
                              : "text-neutral-300"
                          }
                        >
                          {g.result} {g.teamScore}-{g.oppScore}
                        </span>
                        {g.qualityLoss ? (
                          <span
                            title="This loss raised the team's rating — a close game against a strong opponent."
                            className="rounded bg-amber-900/50 px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-amber-300 ring-1 ring-amber-700/50"
                          >
                            Quality Loss
                          </span>
                        ) : null}
                      </span>
                    ) : (
                      (() => {
                        const badge = gameDisplayStatus(g.status, g.date);
                        return (
                          <span
                            className={
                              badge.tone === "missing"
                                ? "rounded bg-red-900/60 px-1.5 py-0.5 text-xs font-semibold text-red-300"
                                : "text-xs text-neutral-500"
                            }
                          >
                            {badge.label}
                          </span>
                        );
                      })()
                    )}
                  </td>
                  <td className="table-cell text-right tabular-nums text-neutral-400">
                    {g.opponent.rating !== null ? formatRating(g.opponent.rating) : "—"}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
}

function Stat({
  label,
  value,
  accent = false,
}: {
  label: string;
  value: string;
  accent?: boolean;
}) {
  return (
    <div>
      <div className="text-xs uppercase tracking-wide text-neutral-500">{label}</div>
      <div
        className={`text-xl font-bold tabular-nums ${
          accent ? "text-emerald-300" : "text-white"
        }`}
      >
        {value}
      </div>
    </div>
  );
}
