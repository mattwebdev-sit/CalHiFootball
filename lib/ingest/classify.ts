import { prisma } from "@/lib/db";
import { fetchLeagues, fetchTeamClassifications } from "./scorebooklive";
import { ensureSection } from "./upsert";

export interface ClassifyResult {
  slugsKnown: number;
  teamsMatched: number;
  eightManTeams: number;
  elevenManTeams: number;
  leaguesUpserted: number;
  teamsWithLeague: number;
  /** Teams whose UNK section was resolved from their league's section. */
  sectionsFilled: number;
  bySection: Record<string, number>;
}

function chunk<T>(items: T[], size: number): T[][] {
  const out: T[][] = [];
  for (let i = 0; i < items.length; i += size) out.push(items.slice(i, i + size));
  return out;
}

/**
 * Classify every team's CIF section and 8-man/11-man format using the
 * authoritative SBLive section organizations. Teams not found in any section
 * org keep their existing section (typically UNK) and default to 11-man.
 * Idempotent.
 */
export async function classifyTeams(
  options: { refresh?: boolean } = {}
): Promise<ClassifyResult> {
  const classifications = await fetchTeamClassifications(options);

  // Ensure every referenced CIF section exists.
  const codes = new Set([...classifications.values()].map((c) => c.sectionCode));
  const sectionIdByCode = new Map<string, string>();
  for (const code of codes) {
    sectionIdByCode.set(code, await ensureSection(code, true));
  }

  // Reset format so teams dropped from the 8-man orgs revert to 11-man.
  await prisma.team.updateMany({ data: { format: "eleven" } });

  // Group slugs by (section, format) and apply in a handful of bulk updates.
  const groups = new Map<string, string[]>();
  for (const [slug, c] of classifications) {
    const key = `${c.sectionCode}|${c.format}`;
    const list = groups.get(key) ?? [];
    list.push(slug);
    groups.set(key, list);
  }

  let teamsMatched = 0;
  for (const [key, slugs] of groups) {
    const [code, format] = key.split("|");
    const sectionId = sectionIdByCode.get(code)!;
    for (const batch of chunk(slugs, 300)) {
      const res = await prisma.team.updateMany({
        where: { slug: { in: batch } },
        data: { format, sectionId },
      });
      teamsMatched += res.count;
    }
  }

  const { leaguesUpserted, teamsWithLeague, sectionsFilled } =
    await classifyLeagues(options, sectionIdByCode);

  const eightManTeams = await prisma.team.count({ where: { format: "eight" } });
  const elevenManTeams = await prisma.team.count({ where: { format: "eleven" } });

  const sectionRows = await prisma.team.groupBy({
    by: ["sectionId"],
    _count: { _all: true },
  });
  const sections = await prisma.section.findMany({ select: { id: true, code: true } });
  const codeById = new Map(sections.map((s) => [s.id, s.code]));
  const bySection: Record<string, number> = {};
  for (const r of sectionRows) {
    bySection[codeById.get(r.sectionId) ?? "?"] = r._count._all;
  }

  return {
    slugsKnown: classifications.size,
    teamsMatched,
    eightManTeams,
    elevenManTeams,
    leaguesUpserted,
    teamsWithLeague,
    sectionsFilled,
    bySection,
  };
}

interface TeamAttrs {
  format: string;
  sectionCode: string;
  isOutOfState: boolean;
}

/** Pick the most frequent value; `prefer` biases ties toward that value. */
function majority(values: string[], prefer?: string): string | undefined {
  const counts = new Map<string, number>();
  for (const v of values) counts.set(v, (counts.get(v) ?? 0) + 1);
  let best: string | undefined;
  let bestN = -1;
  for (const [v, n] of counts) {
    if (n > bestN || (n === bestN && v === prefer)) {
      best = v;
      bestN = n;
    }
  }
  return best;
}

/**
 * Assign leagues from SBLive's ~265 California LEAGUE organizations. Each
 * league's CIF section and format are derived from the existing classification
 * of its member teams (robust, unlike SBLive's legacy league->section parent
 * chain). A team is only placed in a league whose format matches its own. As a
 * bonus, a team still sitting in UNK adopts its league's section, resolving many
 * previously "unknown" schools. Teams in no league roster stay Independent
 * (leagueId = null). Idempotent.
 */
async function classifyLeagues(
  options: { refresh?: boolean },
  sectionIdByCode: Map<string, string>
): Promise<{
  leaguesUpserted: number;
  teamsWithLeague: number;
  sectionsFilled: number;
}> {
  const leagues = await fetchLeagues(options);

  // Load classification attrs for every league member in a few chunked reads.
  const allSlugs = [...new Set(leagues.flatMap((l) => l.teamSlugs))];
  const attrBySlug = new Map<string, TeamAttrs>();
  for (const batch of chunk(allSlugs, 300)) {
    const rows = await prisma.team.findMany({
      where: { slug: { in: batch } },
      select: {
        slug: true,
        format: true,
        isOutOfState: true,
        section: { select: { code: true } },
      },
    });
    for (const r of rows) {
      attrBySlug.set(r.slug, {
        format: r.format,
        sectionCode: r.section.code,
        isOutOfState: r.isOutOfState,
      });
    }
  }

  // Reset so teams dropped from a league revert to Independent.
  await prisma.team.updateMany({ data: { leagueId: null } });

  let teamsWithLeague = 0;
  let sectionsFilled = 0;
  let leaguesUpserted = 0;

  for (const league of leagues) {
    // Members present in our DB and not out-of-state.
    const members = league.teamSlugs
      .map((s) => ({ slug: s, attr: attrBySlug.get(s) }))
      .filter((m): m is { slug: string; attr: TeamAttrs } =>
        Boolean(m.attr && !m.attr!.isOutOfState)
      );
    if (members.length === 0) continue;

    const format =
      majority(members.map((m) => m.attr.format), "eleven") ?? "eleven";
    const realSections = members
      .map((m) => m.attr.sectionCode)
      .filter((c) => c !== "UNK");
    const sectionCode = majority(realSections) ?? "UNK";

    let sectionId = sectionIdByCode.get(sectionCode);
    if (!sectionId) {
      sectionId = await ensureSection(sectionCode, sectionCode !== "OOS");
      sectionIdByCode.set(sectionCode, sectionId);
    }

    const row = await prisma.league.upsert({
      where: { slug: league.slug },
      update: { name: league.name, sectionId, format },
      create: { slug: league.slug, name: league.name, sectionId, format },
    });
    leaguesUpserted += 1;

    // Assign only same-format members to the league.
    const assignSlugs = members
      .filter((m) => m.attr.format === format)
      .map((m) => m.slug);
    for (const batch of chunk(assignSlugs, 300)) {
      const res = await prisma.team.updateMany({
        where: { slug: { in: batch } },
        data: { leagueId: row.id },
      });
      teamsWithLeague += res.count;
    }

    // Resolve UNK members' section from the league's (real) section.
    if (sectionCode !== "UNK" && sectionCode !== "OOS") {
      const unkSlugs = members
        .filter((m) => m.attr.format === format && m.attr.sectionCode === "UNK")
        .map((m) => m.slug);
      for (const batch of chunk(unkSlugs, 300)) {
        const res = await prisma.team.updateMany({
          where: { slug: { in: batch } },
          data: { sectionId },
        });
        sectionsFilled += res.count;
      }
    }
  }

  return { leaguesUpserted, teamsWithLeague, sectionsFilled };
}
