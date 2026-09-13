import { prisma } from "@/lib/db";
import { recomputeSeason } from "@/lib/ratings/persist";

/**
 * Remove the demo seed data while preserving all real (ingested) data.
 *
 * Strategy:
 *   1. Delete every game whose source is "seed".
 *   2. Delete any team that now has zero games. Real teams are always created
 *      from a game, so the only teams left game-less are seed-only teams.
 *   3. Delete the orphaned teams' rating snapshots, then the teams.
 *   4. Recompute ratings for every season that still has games.
 */
async function main() {
  const deletedGames = await prisma.game.deleteMany({ where: { source: "seed" } });
  console.log(`Deleted ${deletedGames.count} seed games.`);

  const orphans = await prisma.team.findMany({
    where: { homeGames: { none: {} }, awayGames: { none: {} } },
    select: { id: true, name: true },
  });

  if (orphans.length > 0) {
    const ids = orphans.map((t) => t.id);
    await prisma.ratingSnapshot.deleteMany({ where: { teamId: { in: ids } } });
    await prisma.team.deleteMany({ where: { id: { in: ids } } });
    console.log(`Deleted ${orphans.length} seed-only teams (no remaining games).`);
  } else {
    console.log("No orphaned teams to delete.");
  }

  // Drop rating snapshots that no longer correspond to any game data is handled
  // by recompute (it upserts survivors); recompute per remaining season.
  const seasons = await prisma.game.findMany({
    distinct: ["season"],
    select: { season: true },
  });

  for (const { season } of seasons) {
    const r = await recomputeSeason(season);
    console.log(`Recomputed ${season}: ${r.rankedTeams} CA teams ranked, ${r.gamesUsed} games.`);
  }

  const remaining = await prisma.game.count();
  const teams = await prisma.team.count();
  console.log(`Done. ${remaining} games and ${teams} teams remain.`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
