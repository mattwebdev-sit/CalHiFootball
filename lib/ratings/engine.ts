import { DEFAULT_CONFIG, GameResult, RatingConfig, TeamRating } from "./types";

function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value));
}

/**
 * Effective margin (from the perspective of the team we are evaluating) that a
 * single game contributes to the rating solver.
 *
 * The scoreboard result (win/loss/tie) is always respected via `winFloor`, but
 * the *size* of the margin is capped so that blowing out a weak opponent has
 * diminishing returns, mirroring the objective CalPreps-style philosophy.
 */
export function effectiveMargin(
  neutralizedMargin: number,
  didWin: boolean,
  didLose: boolean,
  config: RatingConfig
): number {
  if (!config.useMargins) {
    if (didWin) return config.winMargin;
    if (didLose) return -config.winMargin;
    return 0;
  }

  let m = clamp(neutralizedMargin, -config.movCap, config.movCap);

  // A win must always help, a loss must always hurt, regardless of how the
  // home-field neutralization shifted the raw margin.
  if (didWin) m = Math.max(m, config.winFloor);
  else if (didLose) m = Math.min(m, -config.winFloor);

  return m;
}

interface Contribution {
  opponentId: string;
  margin: number;
}

/**
 * Compute CalHi power ratings via an iterative solver.
 *
 * All teams start at 0 (no enrollment, league, or historical bias). On each
 * pass a team's rating is set to the average of `opponentRating + effMargin`
 * across its games, then all ratings are recentered to a mean of 0. This is a
 * Gauss-Seidel style fixed-point iteration that converges to a stable set of
 * ratings where the gap between two teams approximates the expected margin on a
 * neutral field.
 */
export function computeRatings(
  games: GameResult[],
  teamIds: string[],
  configOverrides: Partial<RatingConfig> = {}
): Map<string, TeamRating> {
  const config: RatingConfig = { ...DEFAULT_CONFIG, ...configOverrides };

  const allTeamIds = new Set<string>(teamIds);
  for (const g of games) {
    allTeamIds.add(g.homeId);
    allTeamIds.add(g.awayId);
  }

  const ratings = new Map<string, number>();
  const contributions = new Map<string, Contribution[]>();
  const record = new Map<string, { w: number; l: number; t: number }>();

  for (const id of allTeamIds) {
    ratings.set(id, 0);
    contributions.set(id, []);
    record.set(id, { w: 0, l: 0, t: 0 });
  }

  for (const g of games) {
    const rawMargin = g.homeScore - g.awayScore;
    const neutralized = g.neutral ? rawMargin : rawMargin - config.homeField;

    const homeWon = g.homeScore > g.awayScore;
    const awayWon = g.awayScore > g.homeScore;
    const tie = g.homeScore === g.awayScore;

    contributions.get(g.homeId)!.push({
      opponentId: g.awayId,
      margin: effectiveMargin(neutralized, homeWon, awayWon, config),
    });
    contributions.get(g.awayId)!.push({
      opponentId: g.homeId,
      margin: effectiveMargin(-neutralized, awayWon, homeWon, config),
    });

    const homeRec = record.get(g.homeId)!;
    const awayRec = record.get(g.awayId)!;
    if (tie) {
      homeRec.t += 1;
      awayRec.t += 1;
    } else if (homeWon) {
      homeRec.w += 1;
      awayRec.l += 1;
    } else {
      awayRec.w += 1;
      homeRec.l += 1;
    }
  }

  for (let iter = 0; iter < config.maxIterations; iter += 1) {
    const next = new Map<string, number>();
    let sum = 0;

    for (const id of allTeamIds) {
      const games = contributions.get(id)!;
      if (games.length === 0) {
        next.set(id, 0);
        continue;
      }
      let total = 0;
      for (const c of games) {
        total += ratings.get(c.opponentId)! + c.margin;
      }
      const value = total / games.length;
      next.set(id, value);
      sum += value;
    }

    // Recenter so the average rating is 0.
    const mean = sum / allTeamIds.size;
    let maxDelta = 0;
    for (const id of allTeamIds) {
      const centered = next.get(id)! - mean;
      maxDelta = Math.max(maxDelta, Math.abs(centered - ratings.get(id)!));
      ratings.set(id, centered);
    }

    if (maxDelta < config.tolerance) break;
  }

  const result = new Map<string, TeamRating>();
  for (const id of allTeamIds) {
    const games = contributions.get(id)!;
    const rec = record.get(id)!;
    const sos =
      games.length === 0
        ? 0
        : games.reduce((acc, c) => acc + ratings.get(c.opponentId)!, 0) /
          games.length;

    result.set(id, {
      teamId: id,
      rating: ratings.get(id)!,
      wins: rec.w,
      losses: rec.l,
      ties: rec.t,
      gamesPlayed: games.length,
      sos,
    });
  }

  return result;
}

/**
 * Rank rated teams (highest rating first), optionally restricted to a subset of
 * eligible team ids (e.g. California teams only). Teams with no games are
 * excluded from the ranked list.
 */
export function rankTeams(
  ratings: Map<string, TeamRating>,
  eligibleIds?: Set<string>
): TeamRating[] {
  return [...ratings.values()]
    .filter((r) => r.gamesPlayed > 0)
    .filter((r) => (eligibleIds ? eligibleIds.has(r.teamId) : true))
    .sort((a, b) => b.rating - a.rating);
}
