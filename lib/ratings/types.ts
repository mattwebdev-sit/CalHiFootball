export interface GameResult {
  homeId: string;
  awayId: string;
  homeScore: number;
  awayScore: number;
  /** Neutral-site game (no home-field adjustment applied). */
  neutral?: boolean;
}

export interface RatingConfig {
  /** Margin of victory beyond this (in points) is ignored (diminishing returns). */
  movCap: number;
  /**
   * Minimum credit a win receives, in points. Guarantees a win always helps a
   * team's rating even after neutralizing home-field, and that a 1-point win is
   * treated as clearly better than a 1-point loss.
   */
  winFloor: number;
  /** Points subtracted from the home team's margin to neutralize home-field. */
  homeField: number;
  /** When false, margin of victory is ignored: every win counts the same. */
  useMargins: boolean;
  /** Fixed margin credited to each win when useMargins is false. */
  winMargin: number;
  /** Maximum solver iterations. */
  maxIterations: number;
  /** Convergence tolerance: stop when the largest rating change is below this. */
  tolerance: number;
}

export const DEFAULT_CONFIG: RatingConfig = {
  movCap: 24,
  winFloor: 1,
  homeField: 2,
  useMargins: true,
  winMargin: 15,
  maxIterations: 500,
  tolerance: 1e-6,
};

export interface TeamRating {
  teamId: string;
  rating: number;
  wins: number;
  losses: number;
  ties: number;
  gamesPlayed: number;
  /** Average rating of opponents faced. */
  sos: number;
}
