import { prisma } from "@/lib/db";
import { classifyTeams } from "@/lib/ingest/classify";
import { recomputeSeason } from "@/lib/ratings/persist";
import { CURRENT_SEASON } from "@/lib/config";

const season = Number(process.argv[2] ?? process.env.SEASON ?? CURRENT_SEASON);
const refresh = process.argv.includes("--refresh");

async function main() {
  console.log("Classifying teams' CIF section + format from SBLive section orgs...");
  const result = await classifyTeams({ refresh });
  console.log(
    `Matched ${result.teamsMatched} teams from ${result.slugsKnown} known slugs; ` +
      `${result.eightManTeams} 8-man, ${result.elevenManTeams} 11-man.`
  );
  console.log(
    `Leagues: ${result.leaguesUpserted} upserted, ${result.teamsWithLeague} teams assigned to a league, ` +
      `${result.sectionsFilled} UNK sections resolved from league.`
  );
  console.log(
    "By section: " +
      Object.entries(result.bySection)
        .sort()
        .map(([code, n]) => `${code}=${n}`)
        .join(", ")
  );

  console.log(`Recomputing ${season} ratings per format...`);
  const r = await recomputeSeason(season);
  console.log(
    `Done. Rated ${r.teamsRated} teams from ${r.gamesUsed} games; ` +
      `${r.rankedTeams} California teams ranked.`
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
