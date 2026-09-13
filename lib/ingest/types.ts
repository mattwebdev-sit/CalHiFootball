export interface RawTeam {
  name: string;
  city?: string;
  mascot?: string;
  /** Section code hint from the source (e.g. "SS"); used when creating a team. */
  sectionCode?: string;
  isOutOfState?: boolean;
}

export interface RawGame {
  date: string; // ISO date (YYYY-MM-DD) or full ISO datetime
  week?: number;
  home: RawTeam;
  away: RawTeam;
  homeScore: number | null;
  awayScore: number | null;
  /** "final" | "scheduled" | "forfeit" | "canceled" | "postponed" */
  status?: string;
  /** Stable id from the source for idempotent upserts. */
  sourceId?: string;
}

export interface IngestSummary {
  source: string;
  gamesUpserted: number;
  teamsCreated: number;
  finals: number;
  scheduled: number;
}
