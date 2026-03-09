// Simple event bus for roguelike game events (React ↔ game state communication)
export const gameEvents: {
  onDescend:  (() => void) | null
  onDeath:    (() => void) | null
  onMove:     ((dx: number, dy: number) => void) | null
} = {
  onDescend: null,
  onDeath:   null,
  onMove:    null,
}
