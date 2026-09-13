import { describe, expect, it } from "vitest";
import { computeRatings, effectiveMargin, rankTeams } from "./engine";
import { DEFAULT_CONFIG, GameResult } from "./types";

/** Helper: build a 1-0 result (winner first) for win-only tests. */
function win(winner: string, loser: string): GameResult {
  return { homeId: winner, awayId: loser, homeScore: 1, awayScore: 0, neutral: true };
}

describe("effectiveMargin", () => {
  it("caps margin of victory (diminishing returns)", () => {
    expect(effectiveMargin(60, true, false, DEFAULT_CONFIG)).toBe(DEFAULT_CONFIG.movCap);
    expect(effectiveMargin(-60, false, true, DEFAULT_CONFIG)).toBe(-DEFAULT_CONFIG.movCap);
  });

  it("applies a win floor so a win always helps", () => {
    // A win whose neutralized margin fell below the floor still counts positively.
    expect(effectiveMargin(-1, true, false, DEFAULT_CONFIG)).toBe(DEFAULT_CONFIG.winFloor);
    expect(effectiveMargin(1, false, true, DEFAULT_CONFIG)).toBe(-DEFAULT_CONFIG.winFloor);
  });

  it("ignores margin entirely when useMargins is false", () => {
    const cfg = { ...DEFAULT_CONFIG, useMargins: false };
    expect(effectiveMargin(50, true, false, cfg)).toBe(cfg.winMargin);
    expect(effectiveMargin(3, true, false, cfg)).toBe(cfg.winMargin);
  });
});

describe("computeRatings - CalPreps no-margin example", () => {
  // Reproduces the canonical example from the Freeman/CalPreps writeup:
  //   A 3-0 (beat C,D,E)
  //   C 2-1 (beat D,E; lost A)
  //   E 1-2 (beat B; lost A,C)
  //   D 1-2 (beat F; lost A,C)
  //   B 2-1 (beat F,F; lost E)
  //   F 0-3 (lost B,B,D)
  // Expected order: A > C > E > D > B > F
  const games: GameResult[] = [
    win("A", "C"),
    win("A", "D"),
    win("A", "E"),
    win("C", "D"),
    win("C", "E"),
    win("E", "B"),
    win("D", "F"),
    win("B", "F"),
    win("B", "F"),
  ];

  const ratings = computeRatings(games, ["A", "B", "C", "D", "E", "F"], {
    useMargins: false,
  });
  const ranked = rankTeams(ratings);

  it("produces the expected overall order", () => {
    expect(ranked.map((r) => r.teamId)).toEqual(["A", "C", "E", "D", "B", "F"]);
  });

  it("ranks the 1-2 team (E) above the 2-1 team (B) due to schedule strength", () => {
    const rank = (id: string) => ranked.findIndex((r) => r.teamId === id);
    expect(rank("E")).toBeLessThan(rank("B"));
  });

  it("tracks win-loss records correctly", () => {
    expect(ratings.get("A")).toMatchObject({ wins: 3, losses: 0 });
    expect(ratings.get("B")).toMatchObject({ wins: 2, losses: 1 });
    expect(ratings.get("E")).toMatchObject({ wins: 1, losses: 2 });
    expect(ratings.get("F")).toMatchObject({ wins: 0, losses: 3 });
  });
});

describe("computeRatings - eligibility filtering", () => {
  it("excludes out-of-region teams from the ranked list but uses them for SOS", () => {
    const games: GameResult[] = [
      { homeId: "ca1", awayId: "oos1", homeScore: 35, awayScore: 7, neutral: true },
      { homeId: "ca1", awayId: "ca2", homeScore: 21, awayScore: 14, neutral: true },
    ];
    const ratings = computeRatings(games, ["ca1", "ca2", "oos1"]);
    const eligible = new Set(["ca1", "ca2"]);
    const ranked = rankTeams(ratings, eligible);

    expect(ranked.map((r) => r.teamId)).not.toContain("oos1");
    // ca1 faced oos1, so its SOS reflects that opponent's rating.
    expect(ratings.get("ca1")!.gamesPlayed).toBe(2);
  });
});
