export function formatRating(value: number): string {
  return value.toFixed(1);
}

export function formatSigned(value: number): string {
  const rounded = value.toFixed(1);
  return value > 0 ? `+${rounded}` : rounded;
}

export function formatRecord(wins: number, losses: number, ties = 0): string {
  return ties > 0 ? `${wins}-${losses}-${ties}` : `${wins}-${losses}`;
}

export function formatGameDate(date: Date): string {
  return new Intl.DateTimeFormat("en-US", {
    weekday: "short",
    month: "short",
    day: "numeric",
    timeZone: "America/Los_Angeles",
  }).format(date);
}

export type GameTone = "final" | "upcoming" | "missing" | "other";

/**
 * Display label + tone for a game's status. A "scheduled" game whose kickoff is
 * already in the past has no business showing as "Upcoming" — it's a missing
 * result and should be flagged so someone can add the score.
 */
export function gameDisplayStatus(
  status: string,
  date: Date,
  now: Date = new Date()
): { label: string; tone: GameTone } {
  if (status === "final") return { label: "Final", tone: "final" };
  if (status === "forfeit") return { label: "Forfeit", tone: "final" };
  if (status === "scheduled") {
    return date.getTime() < now.getTime()
      ? { label: "Missing Score", tone: "missing" }
      : { label: "Upcoming", tone: "upcoming" };
  }
  return { label: status.charAt(0).toUpperCase() + status.slice(1), tone: "other" };
}

export function ordinal(n: number): string {
  const s = ["th", "st", "nd", "rd"];
  const v = n % 100;
  return n + (s[(v - 20) % 10] ?? s[v] ?? s[0]);
}
