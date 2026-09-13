import { ScoreboardGame } from "@/lib/queries";
import { formatGameDate, gameDisplayStatus, GameTone } from "@/lib/format";
import { TeamLink } from "./TeamLink";

const TONE_CLASSES: Record<GameTone, string> = {
  final: "font-semibold text-neutral-400",
  upcoming: "rounded bg-emerald-900/50 px-1.5 py-0.5 text-emerald-300",
  missing: "rounded bg-red-900/60 px-1.5 py-0.5 font-semibold text-red-300",
  other: "rounded bg-neutral-800 px-1.5 py-0.5 text-neutral-300",
};

function Side({
  team,
  score,
  isWinner,
  isFinal,
}: {
  team: ScoreboardGame["home"];
  score: number | null;
  isWinner: boolean;
  isFinal: boolean;
}) {
  return (
    <div
      className={`flex items-center justify-between gap-2 ${
        isFinal && isWinner ? "font-bold text-white" : "text-neutral-300"
      }`}
    >
      <TeamLink slug={team.slug} name={team.name} rank={team.rank} />
      <span className="tabular-nums">{score ?? ""}</span>
    </div>
  );
}

export function Scoreboard({ games }: { games: ScoreboardGame[] }) {
  if (games.length === 0) {
    return (
      <div className="card p-6 text-sm text-neutral-400">
        No games for this week yet.
      </div>
    );
  }

  return (
    <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
      {games.map((g) => {
        const isFinal = g.status === "final";
        const homeWon = isFinal && (g.homeScore ?? 0) > (g.awayScore ?? 0);
        const awayWon = isFinal && (g.awayScore ?? 0) > (g.homeScore ?? 0);
        const badge = gameDisplayStatus(g.status, g.date);
        return (
          <div key={g.id} className="card p-3">
            <div className="mb-2 flex items-center justify-between text-xs text-neutral-500">
              <span>{formatGameDate(g.date)}</span>
              <span className={TONE_CLASSES[badge.tone]}>{badge.label}</span>
            </div>
            <div className="space-y-1">
              <Side team={g.away} score={g.awayScore} isWinner={awayWon} isFinal={isFinal} />
              <Side team={g.home} score={g.homeScore} isWinner={homeWon} isFinal={isFinal} />
            </div>
          </div>
        );
      })}
    </div>
  );
}
