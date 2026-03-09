export const rpgEvents = {
  onHpChange:    null as ((hp: number) => void) | null,
  onCoinCollect: null as ((coins: number) => void) | null,
  onGameOver:    null as (() => void) | null,
}
