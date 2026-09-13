import { prisma } from "@/lib/db";
import { fetchCaliforniaScores } from "@/lib/ingest/scorebooklive";
import { resolveSlug } from "@/lib/ingest/normalize";
import { ensureSection } from "@/lib/ingest/upsert";
import { classifyTeams } from "@/lib/ingest/classify";
import { recomputeSeason } from "@/lib/ratings/persist";
import { CURRENT_SEASON } from "@/lib/config";

const season = Number(process.argv[2] ?? process.env.SEASON ?? CURRENT_SEASON);

/** Calendar date (YYYY-MM-DD) of a Date in the Pacific time zone. */
function pacificDate(d: Date): string {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "America/Los_Angeles",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(d);
}

function chunk<T>(items: T[], size: number): T[][] {
  const out: T[][] = [];
  for (let i = 0; i < items.length; i += size) out.push(items.slice(i, i + size));
  return out;
}

/**
 * Assign a CIF section to still-UNK California teams from the modal section of
 * their opponents. Runs a couple of passes so a team whose neighbors were just
 * resolved can also be resolved. Returns the number of teams updated.
 */
async function inferSectionsFromOpponents(season: number): Promise<number> {
  const sections = await prisma.section.findMany({ select: { id: true, code: true } });
  const idByCode = new Map(sections.map((s) => [s.code, s.id]));
  const codeById = new Map(sections.map((s) => [s.id, s.code]));

  const teams = await prisma.team.findMany({
    select: { id: true, sectionId: true, isOutOfState: true },
  });
  const codeOf = new Map<string, string>();
  for (const t of teams) codeOf.set(t.id, codeById.get(t.sectionId) ?? "UNK");
  const isOos = new Map(teams.map((t) => [t.id, t.isOutOfState]));

  const games = await prisma.game.findMany({
    where: { season },
    select: { homeTeamId: true, awayTeamId: true },
  });
  const opponents = new Map<string, string[]>();
  for (const g of games) {
    (opponents.get(g.homeTeamId) ?? opponents.set(g.homeTeamId, []).get(g.homeTeamId)!).push(g.awayTeamId);
    (opponents.get(g.awayTeamId) ?? opponents.set(g.awayTeamId, []).get(g.awayTeamId)!).push(g.homeTeamId);
  }

  const assigned = new Map<string, string>(); // teamId -> code
  for (let pass = 0; pass < 3; pass++) {
    let changed = false;
    for (const t of teams) {
      if (isOos.get(t.id)) continue;
      if (codeOf.get(t.id) !== "UNK") continue;
      if (assigned.has(t.id)) continue;

      const tally = new Map<string, number>();
      for (const oppId of opponents.get(t.id) ?? []) {
        const code = assigned.get(oppId) ?? codeOf.get(oppId);
        if (!code || code === "UNK" || code === "OOS") continue;
        tally.set(code, (tally.get(code) ?? 0) + 1);
      }
      if (tally.size === 0) continue;
      const best = [...tally].sort((a, b) => b[1] - a[1])[0][0];
      assigned.set(t.id, best);
      changed = true;
    }
    if (!changed) break;
  }

  // Apply grouped by target section.
  const byCode = new Map<string, string[]>();
  for (const [teamId, code] of assigned) {
    (byCode.get(code) ?? byCode.set(code, []).get(code)!).push(teamId);
  }
  let updated = 0;
  for (const [code, ids] of byCode) {
    const sectionId = idByCode.get(code)!;
    for (const batch of chunk(ids, 300)) {
      const res = await prisma.team.updateMany({
        where: { id: { in: batch } },
        data: { sectionId },
      });
      updated += res.count;
    }
  }
  return updated;
}

async function main() {
  // Every date we have games for (cached, so refetch is instant).
  const games = await prisma.game.findMany({
    where: { season },
    select: { date: true },
  });
  const dates = [...new Set(games.map((g) => pacificDate(g.date)))].sort();
  console.log(`Re-deriving team home states across ${dates.length} game dates...`);

  // slug -> out-of-state? (a team is OOS if it's flagged OOS in any appearance)
  const oosBySlug = new Map<string, boolean>();
  for (const date of dates) {
    const dayGames = await fetchCaliforniaScores(date, {});
    for (const g of dayGames) {
      for (const raw of [g.home, g.away]) {
        const slug = resolveSlug(raw);
        const prev = oosBySlug.get(slug) ?? false;
        oosBySlug.set(slug, prev || Boolean(raw.isOutOfState));
      }
    }
  }

  const oosSlugs = [...oosBySlug].filter(([, oos]) => oos).map(([s]) => s);
  const caSlugs = [...oosBySlug].filter(([, oos]) => !oos).map(([s]) => s);
  console.log(`Found ${oosSlugs.length} out-of-state and ${caSlugs.length} California teams.`);

  const oosSectionId = await ensureSection("OOS", false);

  let oosUpdated = 0;
  for (const batch of chunk(oosSlugs, 300)) {
    const res = await prisma.team.updateMany({
      where: { slug: { in: batch } },
      data: { isOutOfState: true, sectionId: oosSectionId },
    });
    oosUpdated += res.count;
  }
  for (const batch of chunk(caSlugs, 300)) {
    await prisma.team.updateMany({
      where: { slug: { in: batch } },
      data: { isOutOfState: false },
    });
  }
  console.log(`Marked ${oosUpdated} teams out-of-state (moved to OOS section, unranked).`);

  // Re-derive CIF sections + 8-man/11-man for the California teams.
  console.log("Reclassifying CIF section + format...");
  const c = await classifyTeams();
  console.log(
    `By section: ` +
      Object.entries(c.bySection)
        .sort()
        .map(([code, n]) => `${code}=${n}`)
        .join(", ")
  );

  // Infer a section for the remaining California teams SBLive doesn't roster,
  // using the most common section among their opponents (CA schools almost
  // always play within their own section).
  const inferred = await inferSectionsFromOpponents(season);
  console.log(`Inferred sections for ${inferred} unrostered California teams.`);

  console.log(`Recomputing ${season} ratings...`);
  const r = await recomputeSeason(season);
  console.log(`Done. ${r.rankedTeams} California teams ranked across both formats.`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
