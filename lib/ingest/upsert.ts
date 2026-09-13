import { prisma } from "@/lib/db";
import { RawGame, RawTeam, IngestSummary } from "./types";
import { resolveSlug } from "./normalize";

/** Football season for a date: Aug-Dec belongs to that calendar year. */
export function seasonForDate(date: Date): number {
  const month = date.getUTCMonth(); // 0-based
  return month >= 6 ? date.getUTCFullYear() : date.getUTCFullYear() - 1;
}

/**
 * Monday of Week 1 for each season. Used to derive a week number from a game
 * date when the source doesn't provide one (SBLive is date-based). These are
 * chosen to align with the seed data's explicit weeks.
 */
const SEASON_START: Record<number, string> = {
  2026: "2026-08-17",
};

/** Derive a 1-based week number from a game date, or null if out of season. */
export function weekForDate(date: Date, season: number): number | null {
  const startStr = SEASON_START[season];
  if (!startStr) return null;
  const start = new Date(`${startStr}T00:00:00-07:00`);
  const diffDays = Math.floor((date.getTime() - start.getTime()) / 86_400_000);
  if (diffDays < 0) return null;
  return Math.min(20, Math.floor(diffDays / 7) + 1);
}

function toDate(input: string): Date {
  // Accept plain YYYY-MM-DD (treated as 7pm Pacific) or a full ISO string.
  if (/^\d{4}-\d{2}-\d{2}$/.test(input)) {
    return new Date(`${input}T19:00:00-07:00`);
  }
  return new Date(input);
}

const sectionCache = new Map<string, string>();

export async function ensureSection(code: string, isCa: boolean): Promise<string> {
  const cached = sectionCache.get(code);
  if (cached) return cached;

  const names: Record<string, string> = {
    SS: "CIF Southern Section",
    SDS: "CIF San Diego Section",
    CCS: "CIF Central Coast Section",
    NCS: "CIF North Coast Section",
    SJS: "CIF Sac-Joaquin Section",
    CS: "CIF Central Section",
    LACS: "CIF Los Angeles City Section",
    SFS: "CIF San Francisco Section",
    OS: "CIF Oakland Section",
    NS: "CIF Northern Section",
    OOS: "Out of State",
    UNK: "Unknown Section",
  };

  const row = await prisma.section.upsert({
    where: { code },
    update: {},
    create: { code, name: names[code] ?? code, isCa },
  });
  sectionCache.set(code, row.id);
  return row.id;
}

interface ResolvedTeam {
  slug: string;
  name: string;
  city?: string;
  mascot?: string;
  isOutOfState: boolean;
  sectionCode: string;
}

function resolveTeamAttrs(raw: RawTeam): ResolvedTeam {
  // The OOS section always implies an out-of-state (unranked) team.
  const isOutOfState = (raw.isOutOfState ?? false) || raw.sectionCode === "OOS";
  const sectionCode = raw.sectionCode ?? (isOutOfState ? "OOS" : "UNK");
  return {
    slug: resolveSlug(raw),
    name: raw.name,
    city: raw.city,
    mascot: raw.mascot,
    isOutOfState,
    sectionCode,
  };
}

function chunk<T>(items: T[], size: number): T[][] {
  const out: T[][] = [];
  for (let i = 0; i < items.length; i += size) out.push(items.slice(i, i + size));
  return out;
}

/**
 * Upsert raw games into the database, resolving/creating teams as needed. Games
 * are keyed by (season, date, home, away) so re-running a source is idempotent.
 *
 * Writes are batched for performance: teams are resolved in bulk (one lookup,
 * chunked createMany for new ones) and games are written in chunked
 * transactions, which keeps the number of fsyncs small even for a full season.
 */
export async function upsertGames(
  rawGames: RawGame[],
  source: string,
  onProgress?: (done: number, total: number) => void
): Promise<IngestSummary> {
  // 1. Dedupe every team referenced across all games by canonical slug.
  const teamBySlug = new Map<string, ResolvedTeam>();
  for (const g of rawGames) {
    for (const raw of [g.home, g.away]) {
      const r = resolveTeamAttrs(raw);
      if (!teamBySlug.has(r.slug)) teamBySlug.set(r.slug, r);
    }
  }

  // 2. Ensure all needed sections exist (few in number, cached).
  const sectionIdByCode = new Map<string, string>();
  for (const code of new Set([...teamBySlug.values()].map((t) => t.sectionCode))) {
    sectionIdByCode.set(code, await ensureSection(code, code !== "OOS"));
  }

  // 3. Look up existing teams in bulk, then create the missing ones in batches.
  const slugs = [...teamBySlug.keys()];
  const idBySlug = new Map<string, string>();
  for (const batch of chunk(slugs, 400)) {
    const rows = await prisma.team.findMany({
      where: { slug: { in: batch } },
      select: { id: true, slug: true },
    });
    for (const r of rows) idBySlug.set(r.slug, r.id);
  }

  const missing = [...teamBySlug.values()].filter((t) => !idBySlug.has(t.slug));
  for (const batch of chunk(missing, 200)) {
    await prisma.team.createMany({
      data: batch.map((t) => ({
        slug: t.slug,
        name: t.name,
        city: t.city ?? null,
        mascot: t.mascot ?? null,
        sectionId: sectionIdByCode.get(t.sectionCode)!,
        isOutOfState: t.isOutOfState,
      })),
    });
  }
  if (missing.length > 0) {
    for (const batch of chunk(missing.map((m) => m.slug), 400)) {
      const rows = await prisma.team.findMany({
        where: { slug: { in: batch } },
        select: { id: true, slug: true },
      });
      for (const r of rows) idBySlug.set(r.slug, r.id);
    }
  }

  // 4. Build game upsert operations.
  let finals = 0;
  let scheduled = 0;
  const ops: ReturnType<typeof prisma.game.upsert>[] = [];
  for (const g of rawGames) {
    const date = toDate(g.date);
    const season = seasonForDate(date);
    const homeId = idBySlug.get(resolveSlug(g.home));
    const awayId = idBySlug.get(resolveSlug(g.away));
    if (!homeId || !awayId || homeId === awayId) continue;

    const hasScores = g.homeScore !== null && g.awayScore !== null;
    const status = g.status ?? (hasScores ? "final" : "scheduled");
    if (status === "final") finals += 1;
    else scheduled += 1;

    const week = g.week ?? weekForDate(date, season) ?? undefined;

    ops.push(
      prisma.game.upsert({
        where: {
          season_date_homeTeamId_awayTeamId: {
            season,
            date,
            homeTeamId: homeId,
            awayTeamId: awayId,
          },
        },
        update: {
          week,
          homeScore: g.homeScore,
          awayScore: g.awayScore,
          status,
          source,
          sourceId: g.sourceId ?? undefined,
        },
        create: {
          season,
          week: week ?? null,
          date,
          homeTeamId: homeId,
          awayTeamId: awayId,
          homeScore: g.homeScore,
          awayScore: g.awayScore,
          status,
          source,
          sourceId: g.sourceId ?? null,
        },
      })
    );
  }

  // 5. Write games in chunked transactions (few fsyncs).
  let done = 0;
  for (const batch of chunk(ops, 100)) {
    await prisma.$transaction(batch);
    done += batch.length;
    onProgress?.(done, ops.length);
  }

  return {
    source,
    gamesUpserted: ops.length,
    teamsCreated: missing.length,
    finals,
    scheduled,
  };
}
