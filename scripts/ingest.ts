import { readFile } from "node:fs/promises";
import { prisma } from "@/lib/db";
import { csvToRawGames } from "@/lib/ingest/csv";
import { upsertGames, seasonForDate } from "@/lib/ingest/upsert";
import { fetchCaliforniaScores } from "@/lib/ingest/scorebooklive";
import { classifyTeams } from "@/lib/ingest/classify";
import { recomputeSeason } from "@/lib/ratings/persist";
import { RawGame } from "@/lib/ingest/types";

function usage(): never {
  console.log(
    [
      "Usage:",
      "  npm run ingest -- csv <path> [source]",
      "  npm run ingest -- sbl <YYYY-MM-DD> [level]        (one day, all CA)",
      "  npm run ingest -- sbl-range <start> <end> [level] (inclusive date range)",
      "",
      "Live scores come from the SBLive/CIF public API, scoped to California.",
      "level defaults to VARSITY.",
      "Add --refresh to bypass the cached raw payloads and re-fetch (picks up",
      "newly-finalized scores for dates already ingested).",
    ].join("\n")
  );
  process.exit(1);
}

/** Inclusive list of ISO dates between start and end (YYYY-MM-DD). */
function dateRange(start: string, end: string): string[] {
  const out: string[] = [];
  const cur = new Date(`${start}T12:00:00Z`);
  const stop = new Date(`${end}T12:00:00Z`);
  while (cur <= stop) {
    out.push(cur.toISOString().slice(0, 10));
    cur.setUTCDate(cur.getUTCDate() + 1);
  }
  return out;
}

async function main() {
  const [command, ...rest] = process.argv.slice(2);
  if (!command) usage();

  const refresh = rest.includes("--refresh");
  const args = rest.filter((a) => !a.startsWith("--"));

  let rawGames: RawGame[] = [];
  let source = "manual";

  if (command === "csv") {
    const [pathArg, sourceArg] = args;
    if (!pathArg) usage();
    source = sourceArg ?? "csv";
    const content = await readFile(pathArg, "utf8");
    rawGames = csvToRawGames(content);
  } else if (command === "sbl") {
    const [isoDate, level] = args;
    if (!isoDate) usage();
    source = "sbl";
    console.log(`Fetching CA scores for ${isoDate}${refresh ? " (refresh)" : ""}...`);
    rawGames = await fetchCaliforniaScores(isoDate, { level, refresh });
  } else if (command === "sbl-range") {
    const [start, end, level] = args;
    if (!start || !end) usage();
    source = "sbl";
    for (const d of dateRange(start, end)) {
      console.log(`Fetching CA scores for ${d}${refresh ? " (refresh)" : ""}...`);
      const dayGames = await fetchCaliforniaScores(d, { level, refresh });
      console.log(`  ${dayGames.length} games`);
      rawGames.push(...dayGames);
    }
  } else {
    usage();
  }

  if (rawGames.length === 0) {
    console.log("No games found to ingest.");
    return;
  }

  console.log(`Writing ${rawGames.length} games to the database...`);
  const summary = await upsertGames(rawGames, source, (done, total) => {
    if (done % 500 === 0 || done === total) {
      console.log(`  wrote ${done}/${total} games`);
    }
  });
  console.log(
    `Ingested from ${summary.source}: ${summary.gamesUpserted} games ` +
      `(${summary.finals} final, ${summary.scheduled} scheduled), ` +
      `${summary.teamsCreated} new teams.`
  );

  // Refresh CIF section + 8-man/11-man classification from SBLive section orgs
  // so any newly created teams land in the correct section and competition
  // before ratings are computed.
  const c = await classifyTeams();
  console.log(
    `Classified: ${c.teamsMatched} teams matched (${c.eightManTeams} 8-man, ${c.elevenManTeams} 11-man).`
  );

  const seasons = new Set(
    rawGames.map((g) =>
      seasonForDate(
        /^\d{4}-\d{2}-\d{2}$/.test(g.date)
          ? new Date(`${g.date}T19:00:00-07:00`)
          : new Date(g.date)
      )
    )
  );
  for (const season of seasons) {
    const r = await recomputeSeason(season);
    console.log(`Recomputed ${season}: ${r.rankedTeams} CA teams ranked.`);
  }
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
