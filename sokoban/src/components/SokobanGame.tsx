import { Entity, Transform, Sprite, Script } from '@cubeforge/react'
import type { EntityId, ECSWorld } from '@cubeforge/react'
import type { InputManager } from '@cubeforge/react'

// ─── Constants ────────────────────────────────────────────────────────────────
export const CELL = 48

const COLORS = {
  wall:        '#1a1f33',
  floor:       '#151825',
  target:      '#2a3a2a',
  box:         '#e6a23c',
  boxOnTarget: '#67c23a',
  player:      '#4fc3f7',
} as const

// ─── Tile types ──────────────────────────────────────────────────────────────
type Tile = 'W' | '.' | 'T'

export interface LevelDef {
  width:  number
  height: number
  grid:   Tile[]
  boxes:  { x: number; y: number }[]
  player: { x: number; y: number }
}

// ─── Procedural level generator (reverse-play — always solvable) ─────────────
//
// 1. Build a room with border walls + random internal walls (connectivity-checked)
// 2. Place N target tiles on valid floor (not in corners)
// 3. Put boxes on targets = solved state
// 4. Place player on an open tile
// 5. Simulate reverse moves: player walks around and "pulls" boxes (the reverse
//    of a push). After enough reverse moves the boxes are displaced from targets.
// 6. Because we started from a solved state and only made legal reverse moves,
//    the puzzle is ALWAYS solvable — the forward solution is the reverse path.

const DIRS = [
  { dx: 0, dy: -1 },
  { dx: 0, dy:  1 },
  { dx: -1, dy: 0 },
  { dx:  1, dy: 0 },
]

function createRng(seed: number) {
  let s = seed | 0
  return () => {
    s = (s * 1664525 + 1013904223) | 0
    return ((s >>> 0) / 4294967296)
  }
}

function getLevelParams(level: number) {
  if (level <= 2)  return { width: 5,  height: 5,  boxes: 1, walls: 0, pulls: 15 }
  if (level <= 4)  return { width: 6,  height: 5,  boxes: 1, walls: 1, pulls: 20 }
  if (level <= 6)  return { width: 6,  height: 6,  boxes: 2, walls: 2, pulls: 35 }
  if (level <= 9)  return { width: 7,  height: 6,  boxes: 2, walls: 3, pulls: 50 }
  if (level <= 12) return { width: 7,  height: 7,  boxes: 3, walls: 4, pulls: 70 }
  if (level <= 16) return { width: 8,  height: 7,  boxes: 3, walls: 5, pulls: 90 }
  if (level <= 20) return { width: 8,  height: 8,  boxes: 4, walls: 6, pulls: 110 }
  const t = Math.min(Math.floor((level - 20) / 5), 4)
  return { width: 9 + t, height: 8 + t, boxes: 4 + t, walls: 6 + t * 2, pulls: 130 + t * 30 }
}

function isConnected(grid: Tile[], w: number, h: number): boolean {
  let start = -1
  for (let i = 0; i < grid.length; i++) { if (grid[i] !== 'W') { start = i; break } }
  if (start === -1) return false

  const visited = new Set<number>([start])
  const stack = [start]

  while (stack.length > 0) {
    const idx = stack.pop()!
    const cx = idx % w, cy = (idx - cx) / w
    for (const { dx, dy } of DIRS) {
      const nx = cx + dx, ny = cy + dy
      if (nx < 0 || nx >= w || ny < 0 || ny >= h) continue
      const ni = ny * w + nx
      if (grid[ni] !== 'W' && !visited.has(ni)) { visited.add(ni); stack.push(ni) }
    }
  }

  let floors = 0
  for (const t of grid) if (t !== 'W') floors++
  return visited.size === floors
}

/** Check a cell is NOT in a corner (wall on two perpendicular sides) */
function isNotCorner(grid: Tile[], x: number, y: number, w: number): boolean {
  const l = grid[y * w + (x - 1)] === 'W'
  const r = grid[y * w + (x + 1)] === 'W'
  const u = grid[(y - 1) * w + x] === 'W'
  const d = grid[(y + 1) * w + x] === 'W'
  return !(l && u) && !(l && d) && !(r && u) && !(r && d)
}

// Level cache so canvasSize + createState return consistent results for same level
const levelCache = new Map<number, LevelDef>()

export function generateLevel(levelNum: number): LevelDef {
  if (levelCache.has(levelNum)) return levelCache.get(levelNum)!
  const def = generateLevelUncached(levelNum)
  levelCache.set(levelNum, def)
  return def
}

function generateLevelUncached(levelNum: number): LevelDef {
  const { width: w, height: h, boxes: numBoxes, walls: numWalls, pulls } = getLevelParams(levelNum)

  for (let attempt = 0; attempt < 80; attempt++) {
    const seed = levelNum * 10000 + attempt * 137 + 42
    const rand = createRng(seed)

    // Build grid with border walls
    const grid: Tile[] = []
    for (let r = 0; r < h; r++) {
      for (let c = 0; c < w; c++) {
        grid.push(r === 0 || r === h - 1 || c === 0 || c === w - 1 ? 'W' : '.')
      }
    }

    // Place internal walls (maintain connectivity)
    let placed = 0, tries = 0
    while (placed < numWalls && tries < numWalls * 30) {
      tries++
      const wx = 2 + Math.floor(rand() * (w - 4))
      const wy = 2 + Math.floor(rand() * (h - 4))
      const i = wy * w + wx
      if (grid[i] !== '.') continue
      grid[i] = 'W'
      if (!isConnected(grid, w, h)) { grid[i] = '.'; continue }
      placed++
    }

    // Collect interior floors not in corners
    const floors: { x: number; y: number }[] = []
    for (let r = 1; r < h - 1; r++)
      for (let c = 1; c < w - 1; c++)
        if (grid[r * w + c] === '.') floors.push({ x: c, y: r })

    if (floors.length < numBoxes + 2) continue

    // Shuffle
    for (let i = floors.length - 1; i > 0; i--) {
      const j = Math.floor(rand() * (i + 1))
      ;[floors[i], floors[j]] = [floors[j], floors[i]]
    }

    // Pick target positions (avoid corners)
    const targets = floors.filter(f => isNotCorner(grid, f.x, f.y, w)).slice(0, numBoxes)
    if (targets.length < numBoxes) continue

    // Mark targets
    for (const t of targets) grid[t.y * w + t.x] = 'T'

    // Boxes start on targets (solved state)
    const boxes = targets.map(t => ({ x: t.x, y: t.y }))

    // Pick player position (not on a box)
    const playerCandidates = floors.filter(
      f => grid[f.y * w + f.x] === '.' && !boxes.some(b => b.x === f.x && b.y === f.y)
    )
    if (playerCandidates.length === 0) continue
    let player = playerCandidates[Math.floor(rand() * playerCandidates.length)]

    // ── Reverse-play: walk + pull ──────────────────────────────────────────
    let moved = 0, stuck = 0
    while (moved < pulls && stuck < pulls * 4) {
      stuck++
      const dir = DIRS[Math.floor(rand() * 4)]
      const nx = player.x + dir.dx
      const ny = player.y + dir.dy

      if (nx < 0 || nx >= w || ny < 0 || ny >= h) continue
      if (grid[ny * w + nx] === 'W') continue
      if (boxes.some(b => b.x === nx && b.y === ny)) continue

      // Is there a box behind us (opposite direction) we can pull?
      const bx = player.x - dir.dx
      const by = player.y - dir.dy
      const pullIdx = boxes.findIndex(b => b.x === bx && b.y === by)

      if (pullIdx >= 0 && rand() > 0.35) {
        // Pull: box slides into player's old spot
        boxes[pullIdx].x = player.x
        boxes[pullIdx].y = player.y
      }

      player = { x: nx, y: ny }
      moved++
    }

    // Reject if still solved (all boxes on targets)
    if (boxes.every(b => grid[b.y * w + b.x] === 'T')) continue

    // Reject if at least one box is stuck in a corner (not on a target)
    const hasDeadBox = boxes.some(b => {
      if (grid[b.y * w + b.x] === 'T') return false // on target = fine
      return !isNotCorner(grid, b.x, b.y, w)
    })
    if (hasDeadBox) continue

    const level: LevelDef = { width: w, height: h, grid, boxes, player }
    return level
  }

  // Fallback: trivial 1-box puzzle
  const g: Tile[] = [
    'W','W','W','W','W',
    'W','.','.','T','W',
    'W','.','.','.','W',
    'W','.','.','.','W',
    'W','W','W','W','W',
  ]
  return { width: 5, height: 5, grid: g, boxes: [{ x: 2, y: 2 }], player: { x: 1, y: 3 } }
}

// ─── Game state ──────────────────────────────────────────────────────────────
export interface SokobanState {
  level:     number
  cols:      number
  rows:      number
  grid:      Tile[]
  boxes:     { x: number; y: number }[]
  player:    { x: number; y: number }
  moves:     number
  complete:  boolean
}

export type SokobanEvents = {
  onStateChange: ((state: SokobanState) => void) | null
}

export const sokobanEvents: SokobanEvents = { onStateChange: null }

function createState(levelIdx: number): SokobanState {
  const def = generateLevel(levelIdx + 1)
  return {
    level:    levelIdx,
    cols:     def.width,
    rows:     def.height,
    grid:     [...def.grid],
    boxes:    def.boxes.map(b => ({ ...b })),
    player:   { ...def.player },
    moves:    0,
    complete: false,
  }
}

// ─── Canvas dimensions helper ────────────────────────────────────────────────
export function canvasSize(levelIdx: number) {
  const def = generateLevel(levelIdx + 1)
  return { w: def.width * CELL, h: def.height * CELL }
}

// ─── Manager entity (Script-driven logic) ────────────────────────────────────
const stateMap = new Map<EntityId, SokobanState>()
let currentLevel = 0
let pendingRestart = false
let pendingNextLevel = false

export function setLevel(idx: number) {
  currentLevel = idx
  pendingRestart = true
}

export function restartLevel() {
  pendingRestart = true
}

export function nextLevel() {
  pendingNextLevel = true
}

let keyLock: Record<string, boolean> = {}

function managerInit(id: EntityId) {
  const state = createState(currentLevel)
  stateMap.set(id, state)
  keyLock = {}
  sokobanEvents.onStateChange?.(state)
}

function managerUpdate(id: EntityId, world: ECSWorld, input: InputManager, _dt: number) {
  if (!world.hasEntity(id)) return
  const state = stateMap.get(id)
  if (!state) return

  if (pendingRestart) {
    pendingRestart = false
    const fresh = createState(currentLevel)
    stateMap.set(id, fresh)
    keyLock = {}
    sokobanEvents.onStateChange?.(fresh)
    return
  }
  if (pendingNextLevel) {
    pendingNextLevel = false
    currentLevel++
    const fresh = createState(currentLevel)
    stateMap.set(id, fresh)
    keyLock = {}
    sokobanEvents.onStateChange?.(fresh)
    return
  }

  if (state.complete) return

  // R to restart
  if (input.isDown('KeyR')) {
    if (!keyLock['KeyR']) { keyLock['KeyR'] = true; pendingRestart = true }
  } else { keyLock['KeyR'] = false }

  const dirs: { key: string; dx: number; dy: number }[] = [
    { key: 'ArrowUp',    dx:  0, dy: -1 },
    { key: 'ArrowDown',  dx:  0, dy:  1 },
    { key: 'ArrowLeft',  dx: -1, dy:  0 },
    { key: 'ArrowRight', dx:  1, dy:  0 },
  ]

  for (const { key, dx, dy } of dirs) {
    if (input.isDown(key)) {
      if (keyLock[key]) continue
      keyLock[key] = true

      const nx = state.player.x + dx
      const ny = state.player.y + dy

      if (!inBounds(nx, ny, state) || tileAt(nx, ny, state) === 'W') continue

      const boxIdx = state.boxes.findIndex(b => b.x === nx && b.y === ny)
      if (boxIdx >= 0) {
        const bx = nx + dx, by = ny + dy
        if (!inBounds(bx, by, state) || tileAt(bx, by, state) === 'W') continue
        if (state.boxes.some(b => b.x === bx && b.y === by)) continue
        state.boxes[boxIdx].x = bx
        state.boxes[boxIdx].y = by
      }

      state.player.x = nx
      state.player.y = ny
      state.moves++

      if (state.boxes.every(b => state.grid[b.y * state.cols + b.x] === 'T')) {
        state.complete = true
      }

      sokobanEvents.onStateChange?.(state)
    } else {
      keyLock[key] = false
    }
  }
}

function inBounds(x: number, y: number, s: SokobanState): boolean {
  return x >= 0 && x < s.cols && y >= 0 && y < s.rows
}

function tileAt(x: number, y: number, s: SokobanState): Tile {
  return s.grid[y * s.cols + x]
}

// ─── Exported components ─────────────────────────────────────────────────────

export function SokobanManager() {
  return (
    <Entity id="sokoban-manager">
      <Transform x={0} y={0} />
      <Script init={managerInit} update={managerUpdate} />
    </Entity>
  )
}

export function GridTiles({ state }: { state: SokobanState }) {
  const tiles: JSX.Element[] = []
  for (let r = 0; r < state.rows; r++) {
    for (let c = 0; c < state.cols; c++) {
      const t = state.grid[r * state.cols + c]
      let color = COLORS.floor
      if (t === 'W') color = COLORS.wall
      else if (t === 'T') color = COLORS.target

      tiles.push(
        <Entity key={`tile-${r}-${c}`}>
          <Transform x={c * CELL + CELL / 2} y={r * CELL + CELL / 2} />
          <Sprite width={CELL} height={CELL} color={color} zIndex={0} />
        </Entity>
      )
    }
  }
  return <>{tiles}</>
}

export function TargetMarkers({ state }: { state: SokobanState }) {
  const markers: JSX.Element[] = []
  for (let r = 0; r < state.rows; r++) {
    for (let c = 0; c < state.cols; c++) {
      if (state.grid[r * state.cols + c] === 'T') {
        markers.push(
          <Entity key={`target-${r}-${c}`}>
            <Transform x={c * CELL + CELL / 2} y={r * CELL + CELL / 2} />
            <Sprite width={16} height={16} color="#3d5c3d" zIndex={1} />
          </Entity>
        )
      }
    }
  }
  return <>{markers}</>
}

export function Boxes({ state }: { state: SokobanState }) {
  return (
    <>
      {state.boxes.map((b, i) => {
        const onTarget = state.grid[b.y * state.cols + b.x] === 'T'
        return (
          <Entity key={`box-${i}`}>
            <Transform x={b.x * CELL + CELL / 2} y={b.y * CELL + CELL / 2} />
            <Sprite
              width={CELL - 6}
              height={CELL - 6}
              color={onTarget ? COLORS.boxOnTarget : COLORS.box}
              zIndex={5}
            />
          </Entity>
        )
      })}
    </>
  )
}

export function PlayerEntity({ state }: { state: SokobanState }) {
  return (
    <Entity id="sokoban-player" tags={['player']}>
      <Transform
        x={state.player.x * CELL + CELL / 2}
        y={state.player.y * CELL + CELL / 2}
      />
      <Sprite width={CELL - 10} height={CELL - 10} color={COLORS.player} zIndex={10} />
    </Entity>
  )
}
