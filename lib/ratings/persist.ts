import { prisma } from "@/lib/db";
import { computeRatings, rankTeams } from "./engine";
import { GameResult, RatingConfig, TeamRating } from "./types";

export interface RecomputeResult {
  season: number;
  teamsRated: number;
  gamesUsed: number;
  rankedTeams: number;
}

/**
 * Recompute CalHi ratings for a season from all final games and persist a
 * RatingSnapshot per team. California teams receive a statewide rank; out-of-
 * state opponents are rated (so schedule strength is real) but left unranked.
 */
export async function recomputeSeason(
  season: number,
  configOverrides: Partial<RatingConfig> = {}
): Promise<RecomputeResult> {
  const teams = await prisma.team.findMany({
    select: {
      id: true,
      isOutOfState: true,
      format: true,
      section: { select: { isCa: true } },
    },
  });

  const finalGames = await prisma.game.findMany({
    where: {
      season,
      status: "final",
      homeScore: { not: null },
      awayScore: { not: null },
    },
    select: {
      homeTeamId: true,
      awayTeamId: true,
      homeScore: true,
      awayScore: true,
    },
  });

  const formatByTeam = new Map(teams.map((t) => [t.id, t.format]));

  // 8-man and 11-man are entirely separate competitions: rate and rank each
  // pool independently so their ratings share no scale and ranks restart at 1.
  const ratings = new Map<string, TeamRating>();
  const rankByTeam = new Map<string, number>();
  let rankedTotal = 0;
  let gamesUsed = 0;

  for (const format of ["eleven", "eight"] as const) {
    const formatTeamIds = teams.filter((t) => t.format === format).map((t) => t.id);
    if (formatTeamIds.length === 0) continue;

    const results: GameResult[] = finalGames
      .filter(
        (g) =>
          formatByTeam.get(g.homeTeamId) === format &&
          formatByTeam.get(g.awayTeamId) === format
      )
      .map((g) => ({
        homeId: g.homeTeamId,
        awayId: g.awayTeamId,
        homeScore: g.homeScore as number,
        awayScore: g.awayScore as number,
      }));
    gamesUsed += results.length;

    const formatRatings = computeRatings(results, formatTeamIds, configOverrides);
    for (const [id, r] of formatRatings) ratings.set(id, r);

    // A team is ranked only if it is a California team (not out-of-state and in
    // a California CIF section). Ranks are per-format.
    const eligible = new Set(
      teams
        .filter((t) => t.format === format && !t.isOutOfState && t.section.isCa)
        .map((t) => t.id)
    );
    const ranked = rankTeams(formatRatings, eligible);
    ranked.forEach((r, i) => rankByTeam.set(r.teamId, i + 1));
    rankedTotal += ranked.length;
  }

  await prisma.$transaction(
    [...ratings.values()].map((r) =>
      prisma.ratingSnapshot.upsert({
        where: { teamId_season: { teamId: r.teamId, season } },
        update: {
          rating: r.rating,
          rank: rankByTeam.get(r.teamId) ?? null,
          sos: r.sos,
          wins: r.wins,
          losses: r.losses,
          ties: r.ties,
          computedAt: new Date(),
        },
        create: {
          teamId: r.teamId,
          season,
          rating: r.rating,
          rank: rankByTeam.get(r.teamId) ?? null,
          sos: r.sos,
          wins: r.wins,
          losses: r.losses,
          ties: r.ties,
        },
      })
    )
  );

  return {
    season,
    teamsRated: ratings.size,
    gamesUsed,
    rankedTeams: rankedTotal,
  };
}
