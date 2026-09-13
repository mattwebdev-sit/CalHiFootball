import Link from "next/link";
import { RankedTeam } from "@/lib/queries";
import { formatRating, formatRecord, formatSigned } from "@/lib/format";
import { TeamLink } from "./TeamLink";

export function RankingsTable({
  teams,
  compact = false,
}: {
  teams: RankedTeam[];
  compact?: boolean;
}) {
  if (teams.length === 0) {
    return (
      <div className="card p-6 text-sm text-neutral-400">
        No ranked teams yet. Add scores to generate ratings.
      </div>
    );
  }

  return (
    <div className="card overflow-hidden">
      {/* Mobile: stacked cards */}
      <ul className="divide-y divide-neutral-800 sm:hidden">
        {teams.map((t) => (
          <li key={t.slug} className="flex items-center gap-3 px-3 py-2.5">
            <span className="w-6 shrink-0 text-center font-semibold tabular-nums text-neutral-400">
              {t.rank}
            </span>
            <div className="min-w-0 flex-1">
              <TeamLink
                slug={t.slug}
                name={t.name}
                className="font-medium hover:text-emerald-300"
              />
              <div className="mt-0.5 flex flex-wrap items-center gap-x-2 text-xs text-neutral-500">
                {!compact ? (
                  <span className="text-neutral-400">
                    {t.sectionCode} #{t.sectionRank}
                  </span>
                ) : null}
                {!compact && t.leagueName && t.leagueSlug ? (
                  <Link
                    href={`/leagues/${t.leagueSlug}`}
                    prefetch={false}
                    className="hover:text-emerald-300"
                  >
                    {t.leagueName}
                  </Link>
                ) : !compact && t.city ? (
                  <span>{t.city}</span>
                ) : null}
              </div>
            </div>
            <div className="shrink-0 text-right">
              <div className="font-semibold tabular-nums text-emerald-300">
                {formatRating(t.rating)}
              </div>
              <div className="text-xs tabular-nums text-neutral-400">
                {formatRecord(t.wins, t.losses, t.ties)}
              </div>
            </div>
          </li>
        ))}
      </ul>

      {/* >=sm: full table */}
      <div className="hidden overflow-x-auto sm:block">
        <table className="w-full border-collapse">
          <thead className="bg-neutral-900 text-left text-xs uppercase tracking-wide text-neutral-400">
            <tr>
              <th className="table-cell w-10" title="Statewide rank">#</th>
              <th className="table-cell">Team</th>
              {!compact && (
                <th className="table-cell" title="Section rank">Section</th>
              )}
              <th className="table-cell text-center">Rec</th>
              <th className="table-cell text-right">Rating</th>
              {!compact && <th className="table-cell text-right">SOS</th>}
            </tr>
          </thead>
          <tbody className="divide-y divide-neutral-800">
            {teams.map((t) => (
              <tr key={t.slug} className="hover:bg-white/5">
                <td className="table-cell font-semibold text-neutral-400">{t.rank}</td>
                <td className="table-cell">
                  <TeamLink slug={t.slug} name={t.name} className="font-medium hover:text-emerald-300" />
                  {!compact && t.city ? (
                    <span className="ml-2 text-xs text-neutral-500">{t.city}</span>
                  ) : null}
                  {!compact && t.leagueName && t.leagueSlug ? (
                    <div className="text-xs text-neutral-600">
                      <Link
                        href={`/leagues/${t.leagueSlug}`}
                        prefetch={false}
                        className="hover:text-emerald-300"
                      >
                        {t.leagueName}
                      </Link>
                    </div>
                  ) : null}
                </td>
                {!compact && (
                  <td className="table-cell whitespace-nowrap text-xs text-neutral-400">
                    <span className="font-medium text-neutral-300">{t.sectionCode}</span>
                    <span className="ml-1 tabular-nums text-neutral-500">
                      #{t.sectionRank}
                    </span>
                  </td>
                )}
                <td className="table-cell text-center tabular-nums text-neutral-300">
                  {formatRecord(t.wins, t.losses, t.ties)}
                </td>
                <td className="table-cell text-right font-semibold tabular-nums text-emerald-300">
                  {formatRating(t.rating)}
                </td>
                {!compact && (
                  <td className="table-cell text-right tabular-nums text-neutral-400">
                    {formatSigned(t.sos)}
                  </td>
                )}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
