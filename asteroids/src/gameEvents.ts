export const gameEvents: {
  onScore:   ((pts: number) => void) | null
  onDeath:   (() => void) | null
  onWave:    (() => void) | null
} = {
  onScore: null,
  onDeath: null,
  onWave:  null,
}
