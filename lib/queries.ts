import { cache } from "react";
import { prisma } from "@/lib/db";
import { DEFAULT_FORMAT, TeamFormat } from "@/lib/config";
import { effectiveMargin } from "@/lib/ratings/engine";
import { DEFAULT_CONFIG } from "@/lib/ratings/types";

/**
 * A loss only counts as a "quality loss" if it was competitive — within two
 * touchdowns. This keeps blowouts against elite teams (which can still nudge a
 * weak team's rating up via the capped margin) from being labeled "quality".
 */
const QUALITY_LOSS_MAX_MARGIN = 14;

export interface RankedTeam {
  rank: number;
  /** Rank within the team's own CIF section (and format). */
  sectionRank: number;
  slug: string;
  name: string;
  city: string | null;
  sectionCode: string;
  /** League/conference slug, or null for Independent/Unaffiliated teams. */
  leagueSlug: string | null;
  leagueName: string | null;
  rating: number;
  sos: number;
  wins: number;
  losses: number;
  ties: number;
}

export async function getRankings(
  season: number,
  opts: { section?: string; format?: TeamFormat; league?: string } = {}
): Promise<RankedTeam[]> {
  const format = opts.format ?? DEFAULT_FORMAT;
  // Fetch the whole format pool (ordered by statewide rank, i.e. rating) so we
  // can assign each team its section rank, then optionally filter.
  const snapshots = await prisma.ratingSnapshot.findMany({
    where: { season, rank: { not: null }, team: { format } },
    orderBy: { rank: "asc" },
    include: { team: { include: { section: true, league: true } } },
  });

  const sectionCounter = new Map<string, number>();
  const ranked = snapshots.map((s) => {
    const sectionCode = s.team.section.code;
    const sectionRank = (sectionCounter.get(sectionCode) ?? 0) + 1;
    sectionCounter.set(sectionCode, sectionRank);
    return {
      rank: s.rank as number,
      sectionRank,
      slug: s.team.slug,
      name: s.team.name,
      city: s.team.city,
      sectionCode,
      leagueSlug: s.team.league?.slug ?? null,
      leagueName: s.team.league?.name ?? null,
      rating: s.rating,
      sos: s.sos,
      wins: s.wins,
      losses: s.losses,
      ties: s.ties,
    };
  });

  let out = ranked;
  if (opts.section) out = out.filter((t) => t.sectionCode === opts.section);
  if (opts.league) {
    out =
      opts.league === "independent"
        ? out.filter((t) => t.leagueSlug === null)
        : out.filter((t) => t.leagueSlug === opts.league);
  }
  return out;
}

export async function getSectionsWithRankedTeams(
  season: number,
  format: TeamFormat = DEFAULT_FORMAT
) {
  const sections = await prisma.section.findMany({
    where: {
      isCa: true,
      teams: { some: { format, ratings: { some: { season, rank: { not: null } } } } },
    },
    orderBy: { code: "asc" },
    select: { code: true, name: true },
  });
  return sections;
}

export async function getScoreboardSections(
  season: number,
  format: TeamFormat = DEFAULT_FORMAT
) {
  const sections = await prisma.section.findMany({
    where: {
      isCa: true,
      teams: {
        some: {
          format,
          OR: [
            { homeGames: { some: { season } } },
            { awayGames: { some: { season } } },
          ],
        },
      },
    },
    orderBy: { code: "asc" },
    select: { code: true, name: true },
  });
  return sections;
}

export interface LeagueSummary {
  slug: string;
  name: string;
  teamCount: number;
}

export interface SectionLeagues {
  code: string;
  name: string;
  leagues: LeagueSummary[];
  /** Ranked teams in this section (and format) with no league. */
  independentCount: number;
}

/**
 * Leagues grouped by CIF section for the given format, plus a per-section count
 * of Independent (leagueless) ranked teams. Powers the /leagues browse index
 * and the league chips on the rankings page.
 */
export async function getLeaguesBySection(
  season: number,
  format: TeamFormat = DEFAULT_FORMAT
): Promise<SectionLeagues[]> {
  const leagues = await prisma.league.findMany({
    where: {
      format,
      teams: { some: { ratings: { some: { season, rank: { not: null } } } } },
    },
    orderBy: { name: "asc" },
    include: {
      section: { select: { code: true, name: true } },
      _count: { select: { teams: true } },
    },
  });

  // Independent (no league) ranked teams, tallied per section.
  const indep = await prisma.team.findMany({
    where: {
      format,
      leagueId: null,
      isOutOfState: false,
      section: { isCa: true },
      ratings: { some: { season, rank: { not: null } } },
    },
    select: { section: { select: { code: true, name: true } } },
  });

  const bySection = new Map<string, SectionLeagues>();
  const ensure = (code: string, name: string) => {
    let entry = bySection.get(code);
    if (!entry) {
      entry = { code, name, leagues: [], independentCount: 0 };
      bySection.set(code, entry);
    }
    return entry;
  };

  for (const l of leagues) {
    ensure(l.section.code, l.section.name).leagues.push({
      slug: l.slug,
      name: l.name,
      teamCount: l._count.teams,
    });
  }
  for (const t of indep) {
    ensure(t.section.code, t.section.name).independentCount += 1;
  }

  return [...bySection.values()].sort((a, b) => a.code.localeCompare(b.code));
}

export interface LeaguePage {
  slug: string;
  name: string;
  sectionCode: string;
  sectionName: string;
  format: string;
  teams: RankedTeam[];
}

/** A league's ranked teams (statewide + section rank) for its page. */
export const getLeaguePage = cache(async function getLeaguePage(
  slug: string,
  season: number
): Promise<LeaguePage | null> {
  const league = await prisma.league.findUnique({
    where: { slug },
    include: { section: true },
  });
  if (!league) return null;

  const teams = await getRankings(season, {
    format: league.format as TeamFormat,
    league: slug,
  });

  return {
    slug: league.slug,
    name: league.name,
    sectionCode: league.section.code,
    sectionName: league.section.name,
    format: league.format,
    teams,
  };
});

export async function getAllLeagueSlugs(): Promise<string[]> {
  const leagues = await prisma.league.findMany({ select: { slug: true } });
  return leagues.map((l) => l.slug);
}

export interface ScoreboardGame {
  id: string;
  date: Date;
  week: number | null;
  status: string;
  homeScore: number | null;
  awayScore: number | null;
  home: { slug: string; name: string; rank: number | null };
  away: { slug: string; name: string; rank: number | null };
}

async function rankLookup(season: number): Promise<Map<string, number>> {
  const snaps = await prisma.ratingSnapshot.findMany({
    where: { season, rank: { not: null } },
    select: { teamId: true, rank: true },
  });
  const map = new Map<string, number>();
  for (const s of snaps) map.set(s.teamId, s.rank as number);
  return map;
}

export async function getWeeks(
  season: number,
  format: TeamFormat = DEFAULT_FORMAT
): Promise<number[]> {
  const rows = await prisma.game.findMany({
    where: { season, week: { not: null }, homeTeam: { format } },
    distinct: ["week"],
    orderBy: { week: "asc" },
    select: { week: true },
  });
  return rows.map((r) => r.week as number);
}

export async function getLatestScoredWeek(
  season: number,
  format: TeamFormat = DEFAULT_FORMAT
): Promise<number | null> {
  const row = await prisma.game.findFirst({
    where: { season, status: "final", week: { not: null }, homeTeam: { format } },
    orderBy: { week: "desc" },
    select: { week: true },
  });
  return row?.week ?? null;
}

export async function getScoreboard(
  season: number,
  week: number,
  format: TeamFormat = DEFAULT_FORMAT,
  section?: string,
  league?: string
): Promise<ScoreboardGame[]> {
  const ranks = await rankLookup(season);
  const games = await prisma.game.findMany({
    where: {
      season,
      week,
      homeTeam: { format },
      // A game belongs to a section/league if either team plays in it.
      ...(section
        ? {
            OR: [
              { homeTeam: { section: { code: section } } },
              { awayTeam: { section: { code: section } } },
            ],
          }
        : {}),
      ...(league
        ? {
            OR: [
              { homeTeam: { league: { slug: league } } },
              { awayTeam: { league: { slug: league } } },
            ],
          }
        : {}),
    },
    orderBy: [{ date: "asc" }, { createdAt: "asc" }],
    include: { homeTeam: true, awayTeam: true },
  });

  return games.map((g) => ({
    id: g.id,
    date: g.date,
    week: g.week,
    status: g.status,
    homeScore: g.homeScore,
    awayScore: g.awayScore,
    home: {
      slug: g.homeTeam.slug,
      name: g.homeTeam.name,
      rank: ranks.get(g.homeTeamId) ?? null,
    },
    away: {
      slug: g.awayTeam.slug,
      name: g.awayTeam.name,
      rank: ranks.get(g.awayTeamId) ?? null,
    },
  }));
}

export interface TeamGame {
  id: string;
  date: Date;
  week: number | null;
  status: string;
  isHome: boolean;
  teamScore: number | null;
  oppScore: number | null;
  result: "W" | "L" | "T" | null;
  /**
   * A "quality loss": a loss whose contribution to the team's rating
   * (opponentRating + capped margin) is higher than the team's own rating, i.e.
   * the game actually raised the rating despite being a loss.
   */
  qualityLoss: boolean;
  opponent: {
    slug: string;
    name: string;
    city: string | null;
    rank: number | null;
    rating: number | null;
  };
}

export interface TeamPage {
  slug: string;
  name: string;
  city: string | null;
  mascot: string | null;
  sectionName: string;
  sectionCode: string;
  leagueName: string | null;
  leagueSlug: string | null;
  isOutOfState: boolean;
  format: string;
  rating: number | null;
  rank: number | null;
  sectionRank: number | null;
  leagueRank: number | null;
  sos: number | null;
  wins: number;
  losses: number;
  ties: number;
  games: TeamGame[];
}

export const getTeamPage = cache(async function getTeamPage(
  slug: string,
  season: number
): Promise<TeamPage | null> {
  const team = await prisma.team.findUnique({
    where: { slug },
    include: {
      section: true,
      league: true,
      ratings: { where: { season } },
    },
  });
  if (!team) return null;

  const snap = team.ratings[0];

  // Everything below only depends on `team`, so fire it all off in parallel
  // (one combined snapshot scan for both rank + rating, the games, and the two
  // rank counts) instead of the previous 5 sequential round-trips.
  const [snapshots, games, sectionRankCount, leagueRankCount] = await Promise.all([
    prisma.ratingSnapshot.findMany({
      where: { season },
      select: { teamId: true, rank: true, rating: true },
    }),
    prisma.game.findMany({
      where: {
        season,
        OR: [{ homeTeamId: team.id }, { awayTeamId: team.id }],
      },
      orderBy: [{ date: "asc" }],
      include: {
        homeTeam: { include: { section: true } },
        awayTeam: { include: { section: true } },
      },
    }),
    snap?.rank != null
      ? prisma.ratingSnapshot.count({
          where: {
            season,
            rank: { not: null, lte: snap.rank },
            team: { format: team.format, sectionId: team.sectionId },
          },
        })
      : Promise.resolve<number | null>(null),
    snap?.rank != null && team.leagueId
      ? prisma.ratingSnapshot.count({
          where: {
            season,
            rank: { not: null, lte: snap.rank },
            team: { format: team.format, leagueId: team.leagueId },
          },
        })
      : Promise.resolve<number | null>(null),
  ]);

  const ranks = new Map<string, number>();
  const ratingByTeam = new Map<string, number>();
  for (const s of snapshots) {
    if (s.rank != null) ranks.set(s.teamId, s.rank);
    ratingByTeam.set(s.teamId, s.rating);
  }

  const teamRating = snap?.rating ?? null;

  const teamGames: TeamGame[] = games.map((g) => {
    const isHome = g.homeTeamId === team.id;
    const opp = isHome ? g.awayTeam : g.homeTeam;
    const teamScore = isHome ? g.homeScore : g.awayScore;
    const oppScore = isHome ? g.awayScore : g.homeScore;

    let result: "W" | "L" | "T" | null = null;
    if (g.status === "final" && teamScore !== null && oppScore !== null) {
      result = teamScore > oppScore ? "W" : teamScore < oppScore ? "L" : "T";
    }

    // Mirror the rating engine: neutralize home field, cap/floor the margin,
    // then compare this game's contribution to the team's own rating.
    let qualityLoss = false;
    const oppRating = ratingByTeam.get(opp.id) ?? null;
    if (
      result === "L" &&
      teamRating !== null &&
      oppRating !== null &&
      teamScore !== null &&
      oppScore !== null
    ) {
      const rawMargin = teamScore - oppScore;
      const neutralized = isHome
        ? rawMargin - DEFAULT_CONFIG.homeField
        : rawMargin + DEFAULT_CONFIG.homeField;
      const contribution =
        oppRating + effectiveMargin(neutralized, false, true, DEFAULT_CONFIG);
      qualityLoss =
        contribution > teamRating && oppScore - teamScore <= QUALITY_LOSS_MAX_MARGIN;
    }

    return {
      id: g.id,
      date: g.date,
      week: g.week,
      status: g.status,
      isHome,
      teamScore,
      oppScore,
      result,
      qualityLoss,
      opponent: {
        slug: opp.slug,
        name: opp.name,
        city: opp.city,
        rank: ranks.get(opp.id) ?? null,
        rating: ratingByTeam.get(opp.id) ?? null,
      },
    };
  });

  // Section/league rank = position within the team's section/league+format,
  // ordered by rating (i.e. how many ranked peers have an equal-or-better
  // statewide rank). Computed in parallel above.
  return {
    slug: team.slug,
    name: team.name,
    city: team.city,
    mascot: team.mascot,
    sectionName: team.section.name,
    sectionCode: team.section.code,
    leagueName: team.league?.name ?? null,
    leagueSlug: team.league?.slug ?? null,
    isOutOfState: team.isOutOfState,
    format: team.format,
    rating: snap?.rating ?? null,
    rank: snap?.rank ?? null,
    sectionRank: sectionRankCount,
    leagueRank: leagueRankCount,
    sos: snap?.sos ?? null,
    wins: snap?.wins ?? 0,
    losses: snap?.losses ?? 0,
    ties: snap?.ties ?? 0,
    games: teamGames,
  };
});

export async function getAllTeamSlugs(): Promise<string[]> {
  const teams = await prisma.team.findMany({ select: { slug: true } });
  return teams.map((t) => t.slug);
}
