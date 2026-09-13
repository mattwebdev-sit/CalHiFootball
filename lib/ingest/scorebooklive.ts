import { politeFetch } from "./fetcher";
import { RawGame, RawTeam } from "./types";
import { slugify } from "./normalize";

/**
 * California high school football scores are sourced from the SBLive (Scorebook
 * Live) public GraphQL API at api.scorebooklive.com/v2/graphql. This is the same
 * backend that powers the official CIF section scoreboards (e.g. CIF Southern
 * Section at scores.cifss.org). We query directly by state so a single request
 * flow covers every California section SBLive has data for.
 *
 * We deliberately never ingest from MaxPreps or hsratings.
 */
const GRAPHQL_URL = "https://api.scorebooklive.com/v2/graphql";

/**
 * Scoreboard query. `contests` is a cursor-paginated connection; we request the
 * fields we need including `locationText` (city) and `mascot`, which the public
 * scoreboards omit but the API exposes.
 */
const SCORES_QUERY = `query CalHiScores($date: ISO8601Date!, $genderSport: [GenderSportEnum!]!, $level: [LevelEnum!]!, $state: [StateEnum!], $after: String) {
  contests(date: $date, genderSport: $genderSport, level: $level, state: $state, orderBy: SCOREBOARD, withoutPlaceholderTeams: true, after: $after) {
    pageInfo { hasNextPage endCursor }
    nodes {
      id
      date
      status
      longStatusText
      divisionText
      webPath
      contestParticipants {
        location
        result
        score
        participant {
          __typename
          ... on Team { id name image locationText mascot abbrev }
        }
      }
    }
  }
}`;

/** Map SBLive contest status to our internal game status. */
const STATUS_MAP: Record<string, string> = {
  COMPLETED: "final",
  FINAL: "final",
  FORFEIT: "forfeit",
  CANCELED: "canceled",
  CANCELLED: "canceled",
  POSTPONED: "postponed",
  DELAYED: "scheduled",
  LIVE: "scheduled",
  IN_PROGRESS: "scheduled",
  UPCOMING: "scheduled",
  SCHEDULED: "scheduled",
};

interface SblTeam {
  __typename: string;
  id?: string;
  name?: string;
  image?: string;
  locationText?: string;
  mascot?: string;
  abbrev?: string;
}

interface SblParticipant {
  location?: string; // "HOME" | "AWAY" | null
  result?: string; // "WIN" | "LOSS" | "TIE" | null
  score?: number | null;
  participant?: SblTeam;
}

interface SblContest {
  id: string;
  date: string;
  status: string;
  longStatusText?: string;
  divisionText?: string;
  webPath?: string;
  contestParticipants: SblParticipant[];
}

interface SblResponse {
  data?: {
    contests?: {
      pageInfo: { hasNextPage: boolean; endCursor: string | null };
      nodes: SblContest[];
    };
  };
  errors?: Array<{ message: string }>;
}

/** Strip a trailing US state abbreviation, e.g. "Bellflower, CA" -> "Bellflower". */
function cityFromLocation(locationText?: string): string | undefined {
  if (!locationText) return undefined;
  return locationText.replace(/,\s*[A-Z]{2}$/, "").trim() || undefined;
}

/** Extract the trailing 2-letter US state, e.g. "Peoria, AZ" -> "AZ". */
export function stateFromLocation(locationText?: string): string | undefined {
  const m = locationText?.match(/,\s*([A-Z]{2})\s*$/);
  return m ? m[1] : undefined;
}

function toRawTeam(p: SblParticipant): RawTeam | null {
  const t = p.participant;
  if (!t || t.__typename !== "Team" || !t.name) return null;
  // The state feed still returns out-of-state opponents of California teams;
  // their locationText carries the real state (e.g. "Peoria, AZ").
  const state = stateFromLocation(t.locationText);
  const isOutOfState = state !== undefined && state !== "CA";
  return {
    name: t.name.trim(),
    city: cityFromLocation(t.locationText),
    mascot: t.mascot?.trim() || undefined,
    isOutOfState,
    sectionCode: isOutOfState ? "OOS" : undefined,
  };
}

/** Convert one SBLive contest into a RawGame, or null if it can't be resolved. */
export function contestToRawGame(node: SblContest): RawGame | null {
  const home = node.contestParticipants.find((p) => p.location === "HOME");
  const away = node.contestParticipants.find((p) => p.location === "AWAY");
  if (!home || !away) return null;

  const homeTeam = toRawTeam(home);
  const awayTeam = toRawTeam(away);
  if (!homeTeam || !awayTeam) return null;

  const status = STATUS_MAP[node.status?.toUpperCase()] ?? "scheduled";
  const isFinal = status === "final" || status === "forfeit";

  return {
    date: node.date,
    home: homeTeam,
    away: awayTeam,
    homeScore: isFinal ? home.score ?? null : null,
    awayScore: isFinal ? away.score ?? null : null,
    status,
    sourceId: node.id,
  };
}

/**
 * SBLive section-level organizations for California football, one per CIF
 * section and format. These are the same buckets SI/CIF scoreboards use (e.g.
 * si.com ".../29953-southern-section/..." and ".../29941-southern-section-8-man/...").
 * A team's CIF section and 8-man/11-man format are both derived from which of
 * these it belongs to.
 */
export interface SectionOrg {
  id: number;
  /** Internal CIF section code used across the app. */
  code: string;
  format: "eleven" | "eight";
}

export const SECTION_ORGS: SectionOrg[] = [
  { id: 29953, code: "SS", format: "eleven" }, // Southern Section
  { id: 29960, code: "SJS", format: "eleven" }, // Sac-Joaquin Section
  { id: 29944, code: "LACS", format: "eleven" }, // Los Angeles Section
  { id: 29943, code: "SDS", format: "eleven" }, // San Diego Section
  { id: 29949, code: "CS", format: "eleven" }, // Central Section
  { id: 29955, code: "CCS", format: "eleven" }, // Central Coast Section
  { id: 29951, code: "NCS", format: "eleven" }, // North Coast Section
  { id: 29947, code: "NS", format: "eleven" }, // Northern Section
  { id: 29958, code: "OS", format: "eleven" }, // Oakland Section
  { id: 29959, code: "SFS", format: "eleven" }, // San Francisco City Section
  { id: 29941, code: "SS", format: "eight" }, // Southern Section - 8 Man
  { id: 29961, code: "SJS", format: "eight" }, // Sac-Joaquin Section - 8 Man
  { id: 29946, code: "LACS", format: "eight" }, // Los Angeles Section - 8 Man
  { id: 29945, code: "SDS", format: "eight" }, // San Diego Section - 8 Man
  { id: 29950, code: "CS", format: "eight" }, // Central Section - 8 Man
  { id: 29956, code: "CCS", format: "eight" }, // Central Coast Section - 8 Man
  { id: 29952, code: "NCS", format: "eight" }, // North Coast Section - 8 Man
  { id: 29948, code: "NS", format: "eight" }, // Northern Section - 8 Man
];

const ORG_TEAMS_QUERY = `query CalHiOrgTeams($id: Int!) {
  organization(id: $id) {
    id
    name
    teams { id name locationText }
  }
}`;

interface OrgTeamsResponse {
  data?: {
    organization?: {
      id: string;
      name: string;
      teams: Array<{ id: string; name?: string; locationText?: string }>;
    };
  };
  errors?: Array<{ message: string }>;
}

export interface TeamClassification {
  sectionCode: string;
  format: "eleven" | "eight";
}

/**
 * Authoritative CIF overrides, keyed by canonical team slug, that take
 * precedence over SBLive's section-org rosters. SBLive occasionally lags
 * official section/league membership — a school may still be listed under a
 * neighboring section, or under 11-man after it has dropped to 8-man. Add
 * verified corrections here.
 *
 * Central Section rosters (2026), per the Central Section's official lists.
 */
export const CLASSIFICATION_OVERRIDES: Record<string, TeamClassification> = {
  // Central Section 11-man corrections: SBLive lists these under the CS 8-man
  // org, but the section's official 11-man roster has them as 11-man.
  "fresno-christian-fresno": { sectionCode: "CS", format: "eleven" },
  "sierra-tollhouse": { sectionCode: "CS", format: "eleven" },

  // Central Section 8-man roster.
  "alpaugh-alpaugh": { sectionCode: "CS", format: "eight" },
  "coast-union-cambria": { sectionCode: "CS", format: "eight" },
  "coastal-christian-arroyo-grande": { sectionCode: "CS", format: "eight" },
  "cuyama-valley-new-cuyama": { sectionCode: "CS", format: "eight" },
  "desert-edwards": { sectionCode: "CS", format: "eight" },
  "frazier-mountain-lebec": { sectionCode: "CS", format: "eight" },
  "immanuel-christian-ridgecrest": { sectionCode: "CS", format: "eight" },
  "kings-christian-lemoore": { sectionCode: "CS", format: "eight" },
  "laton-laton": { sectionCode: "CS", format: "eight" },
  "legacy-christian-academy-bakersfield": { sectionCode: "CS", format: "eight" },
  "lone-pine-lone-pine": { sectionCode: "CS", format: "eight" },
  "mammoth-mammoth-lakes": { sectionCode: "CS", format: "eight" },
  "maricopa-maricopa": { sectionCode: "CS", format: "eight" },
  "mojave-mojave": { sectionCode: "CS", format: "eight" },
  "orcutt-academy-orcutt": { sectionCode: "CS", format: "eight" },
  "san-luis-obispo-classical-academy-san-luis-obispo": {
    sectionCode: "CS",
    format: "eight",
  },
  "trona-trona": { sectionCode: "CS", format: "eight" },
  "valley-christian-academy-sm-santa-maria": { sectionCode: "CS", format: "eight" },
};

/** Fetch an organization's team roster as canonical slugs (name + city). */
async function fetchOrgTeamSlugsById(
  id: number,
  refresh: boolean,
  cacheKey = `sbl-org-${id}.json`
): Promise<string[]> {
  const raw = await politeFetch(GRAPHQL_URL, {
    method: "POST",
    body: JSON.stringify({ query: ORG_TEAMS_QUERY, variables: { id } }),
    headers: { "Content-Type": "application/json" },
    cacheKey,
    refresh,
    throttleMs: 500,
  });

  const parsed = JSON.parse(raw) as OrgTeamsResponse;
  if (parsed.errors?.length) {
    throw new Error(
      `SBLive GraphQL error (org ${id}): ${parsed.errors
        .map((e) => e.message)
        .join("; ")}`
    );
  }

  const slugs: string[] = [];
  for (const t of parsed.data?.organization?.teams ?? []) {
    if (!t.name) continue;
    slugs.push(slugify(t.name.trim(), cityFromLocation(t.locationText)));
  }
  return slugs;
}

function fetchOrgTeamSlugs(org: SectionOrg, refresh: boolean): Promise<string[]> {
  return fetchOrgTeamSlugsById(org.id, refresh);
}

/**
 * Build a map of canonical team slug -> {sectionCode, format} from the SBLive
 * section organizations. Slugs are computed the same way ingest builds them
 * (name + city) so they line up with teams already in the DB.
 *
 * Precedence: a team's CIF section comes from whichever section org lists it.
 * For format, membership in an 8-man section org is authoritative (matching how
 * SI/CIF list 8-man) and wins over the regular org — CIF section orgs list every
 * school in the section regardless of format, so appearing there is not evidence
 * of playing 11-man.
 */
export async function fetchTeamClassifications(
  options: { refresh?: boolean } = {}
): Promise<Map<string, TeamClassification>> {
  const { refresh = false } = options;
  const map = new Map<string, TeamClassification>();

  // Pass 1: regular orgs set section + a default 11-man format.
  for (const org of SECTION_ORGS.filter((o) => o.format === "eleven")) {
    for (const slug of await fetchOrgTeamSlugs(org, refresh)) {
      map.set(slug, { sectionCode: org.code, format: "eleven" });
    }
  }

  // Pass 2: 8-man orgs win — a team listed in an 8-man section org is 8-man.
  for (const org of SECTION_ORGS.filter((o) => o.format === "eight")) {
    for (const slug of await fetchOrgTeamSlugs(org, refresh)) {
      map.set(slug, { sectionCode: org.code, format: "eight" });
    }
  }

  // Pass 3: authoritative CIF overrides win over SBLive org rosters.
  for (const [slug, cls] of Object.entries(CLASSIFICATION_OVERRIDES)) {
    map.set(slug, cls);
  }

  return map;
}

/**
 * A league/conference, as exposed by SBLive's LEAGUE organizations. Section and
 * format are intentionally not carried here — they are derived by the caller
 * from the members' existing classification, which is far more reliable than
 * SBLive's (legacy, duplicated) league->section parent chain.
 */
export interface LeagueDef {
  /** SBLive org slug, globally unique, e.g. "31503-central-yosemite-conference". */
  slug: string;
  name: string;
  /** Canonical slugs of the league's member teams (name + city). */
  teamSlugs: string[];
}

const STATE_ORGS_QUERY = `query CalHiStateOrgs($state: StateEnum!, $genderSport: GenderSportEnum!) {
  stateGenderSportOrganizations(state: $state, genderSport: $genderSport) {
    id
    name
    organizationTypeKey
    slug
  }
}`;

interface StateOrg {
  id: string;
  name?: string;
  organizationTypeKey?: string;
  slug?: string;
}

interface StateOrgsResponse {
  data?: { stateGenderSportOrganizations?: StateOrg[] };
  errors?: Array<{ message: string }>;
}

/**
 * Fetch every California football league and its team roster. SBLive exposes
 * ~265 LEAGUE organizations via `stateGenderSportOrganizations`; each league's
 * roster is then fetched individually (the inline `teams` resolver times out
 * when requested for all orgs at once). Rosters are cached under data/raw so
 * only the first run (or a `refresh`) hits the network for all of them.
 */
export async function fetchLeagues(
  options: { refresh?: boolean } = {}
): Promise<LeagueDef[]> {
  const { refresh = false } = options;

  const raw = await politeFetch(GRAPHQL_URL, {
    method: "POST",
    body: JSON.stringify({
      query: STATE_ORGS_QUERY,
      variables: { state: "CALIFORNIA", genderSport: "FOOTBALL" },
    }),
    headers: { "Content-Type": "application/json" },
    cacheKey: `sbl-ca-orgs.json`,
    refresh,
    throttleMs: 500,
  });
  const parsed = JSON.parse(raw) as StateOrgsResponse;
  if (parsed.errors?.length) {
    throw new Error(
      `SBLive GraphQL error (state orgs): ${parsed.errors
        .map((e) => e.message)
        .join("; ")}`
    );
  }

  const leagueOrgs = (parsed.data?.stateGenderSportOrganizations ?? []).filter(
    (o) => o.organizationTypeKey === "LEAGUE" && o.slug && o.name
  );

  const leagues: LeagueDef[] = [];
  for (const org of leagueOrgs) {
    const teamSlugs = await fetchOrgTeamSlugsById(
      Number(org.id),
      refresh,
      `sbl-league-${org.id}.json`
    );
    if (teamSlugs.length === 0) continue;
    leagues.push({ slug: org.slug!, name: org.name!.trim(), teamSlugs });
  }

  return leagues;
}

export interface FetchScoresOptions {
  /** Competition level; SBLive uses VARSITY / JV / FRESHMAN. */
  level?: string;
  /** Ignore cached raw payloads and refetch. */
  refresh?: boolean;
  /** Safety cap on pagination. */
  maxPages?: number;
}

/**
 * Fetch all California varsity football games for a single date from SBLive,
 * following cursor pagination. Returns normalized RawGame[].
 */
export async function fetchCaliforniaScores(
  isoDate: string,
  options: FetchScoresOptions = {}
): Promise<RawGame[]> {
  const { level = "VARSITY", refresh = false, maxPages = 50 } = options;

  const games: RawGame[] = [];
  let after: string | null = null;
  let page = 0;

  do {
    const body = JSON.stringify({
      query: SCORES_QUERY,
      variables: {
        date: isoDate,
        genderSport: ["FOOTBALL"],
        level: [level],
        state: ["CALIFORNIA"],
        after,
      },
    });

    const raw = await politeFetch(GRAPHQL_URL, {
      method: "POST",
      body,
      headers: { "Content-Type": "application/json" },
      cacheKey: `sbl-ca-${isoDate}-p${page}.json`,
      refresh,
      throttleMs: 800,
    });

    const parsed = JSON.parse(raw) as SblResponse;
    if (parsed.errors?.length) {
      throw new Error(
        `SBLive GraphQL error: ${parsed.errors.map((e) => e.message).join("; ")}`
      );
    }

    const contests = parsed.data?.contests;
    if (!contests) break;

    for (const node of contests.nodes) {
      const game = contestToRawGame(node);
      if (game) games.push(game);
    }

    after = contests.pageInfo.hasNextPage ? contests.pageInfo.endCursor : null;
    page += 1;
  } while (after && page < maxPages);

  return games;
}
