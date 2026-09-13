import { RawTeam } from "./types";

/**
 * Known aliases mapping a normalized key to a canonical team slug. This resolves
 * the common "Centennial (Corona)" vs "Corona Centennial" style mismatches
 * between different public sources. Extend this map as new aliases are found.
 */
export const TEAM_ALIASES: Record<string, string> = {
  coronacentennial: "centennial-corona",
  "centennial|corona": "centennial-corona",
  "st. john bosco": "st-john-bosco-bellflower",
  sjb: "st-john-bosco-bellflower",
  materdei: "mater-dei-santa-ana",
  "junipero serra|san mateo": "serra-san-mateo",
  "serra|san mateo": "serra-san-mateo",
  delasalle: "de-la-salle-concord",
  kahuku: "kahuku-kahuku",
};

function stripDiacritics(input: string): string {
  return input.normalize("NFKD").replace(/[\u0300-\u036f]/g, "");
}

/** Lowercased, punctuation-free, single-spaced form for fuzzy matching. */
export function canonicalKey(name: string): string {
  return stripDiacritics(name)
    .toLowerCase()
    .replace(/&/g, " and ")
    .replace(/[^a-z0-9]+/g, " ")
    .trim()
    .replace(/\s+/g, " ");
}

/** URL-safe slug from a school name and (optional) city. */
export function slugify(name: string, city?: string): string {
  const base = [name, city].filter(Boolean).join(" ");
  return stripDiacritics(base)
    .toLowerCase()
    .replace(/&/g, " and ")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

/**
 * Parse a raw team label into name + city. Handles the common "Name (City, ST)"
 * and "Name (City)" formats that public scoreboards use.
 */
export function parseTeamLabel(label: string): { name: string; city?: string } {
  const match = label.match(/^(.*?)\s*\(([^)]+)\)\s*$/);
  if (match) {
    const name = match[1].trim();
    const city = match[2].trim();
    return { name, city };
  }
  return { name: label.trim() };
}

/**
 * Resolve the canonical slug for a raw team, consulting the alias table. Falls
 * back to a deterministic slug derived from name + city.
 */
export function resolveSlug(team: RawTeam): string {
  const key = canonicalKey(team.name);
  const cityKey = team.city ? `${key}|${canonicalKey(team.city)}` : "";

  if (cityKey && TEAM_ALIASES[cityKey]) return TEAM_ALIASES[cityKey];
  if (TEAM_ALIASES[key]) return TEAM_ALIASES[key];
  // Alias keys may also be stored with raw name text.
  const rawKey = team.name.toLowerCase().trim();
  if (TEAM_ALIASES[rawKey]) return TEAM_ALIASES[rawKey];

  return slugify(team.name, team.city);
}
