import { prisma } from "@/lib/db";
import { recomputeSeason } from "@/lib/ratings/persist";

const season = Number(process.argv[2] ?? process.env.SEASON ?? 2026);

async function main() {
  console.log(`Computing CalHi ratings for ${season}...`);
  const result = await recomputeSeason(season);
  console.log(
    `Done. Rated ${result.teamsRated} teams from ${result.gamesUsed} games; ` +
      `${result.rankedTeams} California teams ranked.`
  );
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
