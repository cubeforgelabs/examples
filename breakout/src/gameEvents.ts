// Module-level callbacks wired from App → game scripts.
// One instance per game session — safe because only one Game is mounted at a time.
export const gameEvents = {
  onBrickHit: null as ((brickId: number, score: number) => void) | null,
  onBallLost: null as (() => void) | null,
}
