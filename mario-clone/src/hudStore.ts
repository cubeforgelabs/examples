/**
 * Ref-based HUD store — state updates here do NOT trigger React re-renders
 * of the game tree. Only the HUD component subscribes via useSyncExternalStore.
 */

type Listener = () => void

interface HUDState {
  score: number
  lives: number
  coinsCollected: number
  hasMushroom: boolean
  hasFireFlower: boolean
  hasStar: boolean
}

const listeners = new Set<Listener>()

let state: HUDState = {
  score: 0,
  lives: 3,
  coinsCollected: 0,
  hasMushroom: false,
  hasFireFlower: false,
  hasStar: false,
}

function emit() { listeners.forEach(l => l()) }

export const hudStore = {
  getSnapshot(): HUDState { return state },

  subscribe(listener: Listener): () => void {
    listeners.add(listener)
    return () => listeners.delete(listener)
  },

  setScore(s: number) { state = { ...state, score: s }; emit() },
  addScore(pts: number) { state = { ...state, score: state.score + pts }; emit() },
  setLives(l: number) { state = { ...state, lives: l }; emit() },
  addLife() { state = { ...state, lives: Math.min(state.lives + 1, 9) }; emit() },
  loseLife(): number {
    const next = Math.max(0, state.lives - 1)
    state = { ...state, lives: next }; emit()
    return next
  },
  addCoin() { state = { ...state, coinsCollected: state.coinsCollected + 1 }; emit() },
  setMushroom(v: boolean) { state = { ...state, hasMushroom: v }; emit() },
  setFireFlower(v: boolean) { state = { ...state, hasFireFlower: v }; emit() },
  setStar(v: boolean) { state = { ...state, hasStar: v }; emit() },

  reset(lives = 3) {
    state = { score: 0, lives, coinsCollected: 0, hasMushroom: false, hasFireFlower: false, hasStar: false }
    emit()
  },
  resetLevel() {
    state = { ...state, coinsCollected: 0, hasMushroom: false, hasFireFlower: false, hasStar: false }
    emit()
  },
}
