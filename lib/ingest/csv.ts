import { RawGame } from "./types";
import { parseTeamLabel } from "./normalize";

/**
 * Minimal RFC-4180-ish CSV parser: handles quoted fields, escaped quotes ("")
 * and commas/newlines inside quotes. Good enough for hand-made and exported
 * score sheets without pulling in a dependency.
 */
export function parseCsv(content: string): string[][] {
  const rows: string[][] = [];
  let row: string[] = [];
  let field = "";
  let inQuotes = false;

  const text = content.replace(/\r\n/g, "\n").replace(/\r/g, "\n");

  for (let i = 0; i < text.length; i += 1) {
    const ch = text[i];
    if (inQuotes) {
      if (ch === '"') {
        if (text[i + 1] === '"') {
          field += '"';
          i += 1;
        } else {
          inQuotes = false;
        }
      } else {
        field += ch;
      }
    } else if (ch === '"') {
      inQuotes = true;
    } else if (ch === ",") {
      row.push(field);
      field = "";
    } else if (ch === "\n") {
      row.push(field);
      rows.push(row);
      row = [];
      field = "";
    } else {
      field += ch;
    }
  }
  if (field.length > 0 || row.length > 0) {
    row.push(field);
    rows.push(row);
  }
  return rows.filter((r) => r.some((c) => c.trim() !== ""));
}

function parseBool(value: string | undefined): boolean {
  if (!value) return false;
  return /^(1|true|yes|y)$/i.test(value.trim());
}

function num(value: string | undefined): number | null {
  if (value === undefined || value.trim() === "") return null;
  const n = Number(value);
  return Number.isFinite(n) ? n : null;
}

/**
 * Convert CSV text to RawGame[].
 *
 * Recognized headers (order-independent, case-insensitive):
 *   date, week, home, home_city, home_section, home_oos,
 *   away, away_city, away_section, away_oos,
 *   home_score, away_score, status, source_id
 *
 * `home`/`away` may embed a city as "Name (City)"; an explicit *_city column
 * takes precedence when present.
 */
export function csvToRawGames(content: string): RawGame[] {
  const rows = parseCsv(content);
  if (rows.length < 2) return [];

  const header = rows[0].map((h) => h.trim().toLowerCase());
  const idx = (name: string) => header.indexOf(name);

  const col = {
    date: idx("date"),
    week: idx("week"),
    home: idx("home"),
    homeCity: idx("home_city"),
    homeSection: idx("home_section"),
    homeOos: idx("home_oos"),
    away: idx("away"),
    awayCity: idx("away_city"),
    awaySection: idx("away_section"),
    awayOos: idx("away_oos"),
    homeScore: idx("home_score"),
    awayScore: idx("away_score"),
    status: idx("status"),
    sourceId: idx("source_id"),
  };

  if (col.date < 0 || col.home < 0 || col.away < 0) {
    throw new Error("CSV must include at least 'date', 'home' and 'away' columns");
  }

  const games: RawGame[] = [];
  for (const r of rows.slice(1)) {
    const get = (i: number) => (i >= 0 ? (r[i] ?? "").trim() : "");

    const homeLabel = parseTeamLabel(get(col.home));
    const awayLabel = parseTeamLabel(get(col.away));
    const weekVal = num(get(col.week));

    games.push({
      date: get(col.date),
      week: weekVal ?? undefined,
      home: {
        name: homeLabel.name,
        city: get(col.homeCity) || homeLabel.city,
        sectionCode: get(col.homeSection) || undefined,
        isOutOfState: parseBool(get(col.homeOos)),
      },
      away: {
        name: awayLabel.name,
        city: get(col.awayCity) || awayLabel.city,
        sectionCode: get(col.awaySection) || undefined,
        isOutOfState: parseBool(get(col.awayOos)),
      },
      homeScore: num(get(col.homeScore)),
      awayScore: num(get(col.awayScore)),
      status: get(col.status) || undefined,
      sourceId: get(col.sourceId) || undefined,
    });
  }

  return games;
}
