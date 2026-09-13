export const CURRENT_SEASON = Number(process.env.CURRENT_SEASON ?? 2026);

/** The two football formats we rank as separate competitions. */
export type TeamFormat = "eleven" | "eight";

export const TEAM_FORMATS: { value: TeamFormat; label: string }[] = [
  { value: "eleven", label: "11-Man" },
  { value: "eight", label: "8-Man" },
];

export const DEFAULT_FORMAT: TeamFormat = "eleven";

/** Coerce an arbitrary query-string value to a valid TeamFormat. */
export function normalizeFormat(value?: string | null): TeamFormat {
  return value === "eight" ? "eight" : "eleven";
}

export function formatLabel(value: string): string {
  return value === "eight" ? "8-Man" : "11-Man";
}
