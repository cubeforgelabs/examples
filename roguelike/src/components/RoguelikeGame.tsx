import { Entity, Transform, Sprite } from '@cubeforge/react'
import { gameEvents } from '../gameEvents'

// ─── Constants ────────────────────────────────────────────────────────────────
export const W          = 640
export const H          = 640
export const GRID       = 20
export const CELL       = 32
export const FOG_RADIUS = 5

// ─── Tile types ───────────────────────────────────────────────────────────────
export const WALL   = 0
export const FLOOR  = 1
export const STAIRS = 2
export const POTION = 3

// ─── Types ────────────────────────────────────────────────────────────────────
export interface EnemyData {
  x: number
  y: number
  hp: number
}

export interface GameState {
  grid: number[][]
  playerX: number
  playerY: number
  enemies: EnemyData[]
  floor: number
  hp: number
  maxHp: number
  atk: number
  kills: number
  gameOver: boolean
  message: string
  visible: boolean[][]
  explored: boolean[][]
}

// ─── Dungeon generation ───────────────────────────────────────────────────────
interface Room {
  x: number
  y: number
  w: number
  h: number
}

function createEmptyGrid(): number[][] {
  const grid: number[][] = []
  for (let y = 0; y < GRID; y++) {
    grid[y] = []
    for (let x = 0; x < GRID; x++) {
      grid[y][x] = WALL
    }
  }
  return grid
}

function roomsOverlap(a: Room, b: Room): boolean {
  return !(a.x + a.w + 1 < b.x || b.x + b.w + 1 < a.x ||
           a.y + a.h + 1 < b.y || b.y + b.h + 1 < a.y)
}

function generateDungeon(): { grid: number[][]; rooms: Room[] } {
  const grid = createEmptyGrid()
  const rooms: Room[] = []
  const numRooms = 3 + Math.floor(Math.random() * 3)

  for (let attempt = 0; attempt < 100 && rooms.length < numRooms; attempt++) {
    const w = 3 + Math.floor(Math.random() * 4)
    const h = 3 + Math.floor(Math.random() * 4)
    const x = 1 + Math.floor(Math.random() * (GRID - w - 2))
    const y = 1 + Math.floor(Math.random() * (GRID - h - 2))
    const room: Room = { x, y, w, h }

    let overlaps = false
    for (const other of rooms) {
      if (roomsOverlap(room, other)) { overlaps = true; break }
    }
    if (overlaps) continue

    for (let ry = y; ry < y + h; ry++) {
      for (let rx = x; rx < x + w; rx++) {
        grid[ry][rx] = FLOOR
      }
    }
    rooms.push(room)
  }

  // Connect rooms with corridors
  for (let i = 1; i < rooms.length; i++) {
    const prev = rooms[i - 1]
    const curr = rooms[i]
    const cx1 = Math.floor(prev.x + prev.w / 2)
    const cy1 = Math.floor(prev.y + prev.h / 2)
    const cx2 = Math.floor(curr.x + curr.w / 2)
    const cy2 = Math.floor(curr.y + curr.h / 2)

    let x = cx1
    while (x !== cx2) {
      if (x >= 0 && x < GRID && cy1 >= 0 && cy1 < GRID) grid[cy1][x] = FLOOR
      x += cx2 > cx1 ? 1 : -1
    }
    let y = cy1
    while (y !== cy2) {
      if (cx2 >= 0 && cx2 < GRID && y >= 0 && y < GRID) grid[y][cx2] = FLOOR
      y += cy2 > cy1 ? 1 : -1
    }
    if (cx2 >= 0 && cx2 < GRID && cy2 >= 0 && cy2 < GRID) grid[cy2][cx2] = FLOOR
  }

  return { grid, rooms }
}

function randomFloorTile(
  grid: number[][],
  occupied: Set<string>,
): [number, number] {
  const tiles: Array<[number, number]> = []
  for (let y = 0; y < GRID; y++) {
    for (let x = 0; x < GRID; x++) {
      if (grid[y][x] === FLOOR && !occupied.has(`${x},${y}`)) tiles.push([x, y])
    }
  }
  return tiles[Math.floor(Math.random() * tiles.length)]
}

// ─── Visibility ───────────────────────────────────────────────────────────────
function computeVisibility(grid: number[][], px: number, py: number): boolean[][] {
  const vis: boolean[][] = []
  for (let y = 0; y < GRID; y++) {
    vis[y] = []
    for (let x = 0; x < GRID; x++) {
      vis[y][x] = false
    }
  }

  for (let y = 0; y < GRID; y++) {
    for (let x = 0; x < GRID; x++) {
      const dx = x - px
      const dy = y - py
      const dist = Math.sqrt(dx * dx + dy * dy)
      if (dist > FOG_RADIUS) continue

      const steps = Math.max(Math.abs(dx), Math.abs(dy))
      if (steps === 0) { vis[y][x] = true; continue }

      let blocked = false
      for (let s = 1; s <= steps; s++) {
        const cx = Math.round(px + (dx * s) / steps)
        const cy = Math.round(py + (dy * s) / steps)
        if (cx < 0 || cx >= GRID || cy < 0 || cy >= GRID) { blocked = true; break }
        if (grid[cy][cx] === WALL && (cx !== x || cy !== y)) { blocked = true; break }
      }
      if (!blocked) vis[y][x] = true
    }
  }
  return vis
}

// ─── Generate a full floor ────────────────────────────────────────────────────
export function generateFloor(floor: number): GameState {
  const { grid, rooms } = generateDungeon()
  const occupied = new Set<string>()

  const firstRoom = rooms[0]
  const playerX = Math.floor(firstRoom.x + firstRoom.w / 2)
  const playerY = Math.floor(firstRoom.y + firstRoom.h / 2)
  occupied.add(`${playerX},${playerY}`)

  // Place stairs — prefer last room center, fallback to random floor tile
  const lastRoom = rooms[rooms.length - 1]
  let stairsX = Math.floor(lastRoom.x + lastRoom.w / 2)
  let stairsY = Math.floor(lastRoom.y + lastRoom.h / 2)
  if (occupied.has(`${stairsX},${stairsY}`)) {
    const [sx, sy] = randomFloorTile(grid, occupied)
    stairsX = sx
    stairsY = sy
  }
  grid[stairsY][stairsX] = STAIRS
  occupied.add(`${stairsX},${stairsY}`)

  const numEnemies = 3 + Math.floor(Math.random() * 3)
  const enemies: EnemyData[] = []
  for (let i = 0; i < numEnemies; i++) {
    const [ex, ey] = randomFloorTile(grid, occupied)
    enemies.push({ x: ex, y: ey, hp: 3 })
    occupied.add(`${ex},${ey}`)
  }

  for (let i = 0; i < 3; i++) {
    const [potX, potY] = randomFloorTile(grid, occupied)
    grid[potY][potX] = POTION
    occupied.add(`${potX},${potY}`)
  }

  const visible = computeVisibility(grid, playerX, playerY)
  const explored: boolean[][] = []
  for (let y = 0; y < GRID; y++) {
    explored[y] = []
    for (let x = 0; x < GRID; x++) {
      explored[y][x] = visible[y][x]
    }
  }

  return {
    grid,
    playerX,
    playerY,
    enemies,
    floor,
    hp: 10,
    maxHp: 10,
    atk: 3,
    kills: 0,
    gameOver: false,
    message: `Floor ${floor} — find the stairs (>)`,
    visible,
    explored,
  }
}

// ─── Turn logic ───────────────────────────────────────────────────────────────
export function processTurn(state: GameState, dx: number, dy: number): GameState {
  if (state.gameOver) return state

  const next: GameState = {
    ...state,
    enemies: state.enemies.map(e => ({ ...e })),
    grid: state.grid.map(row => [...row]),
    visible: state.visible.map(row => [...row]),
    explored: state.explored.map(row => [...row]),
  }

  const nx = next.playerX + dx
  const ny = next.playerY + dy

  if (nx < 0 || nx >= GRID || ny < 0 || ny >= GRID) return state
  if (next.grid[ny][nx] === WALL) return state

  // Check for enemy at target
  const enemyIdx = next.enemies.findIndex(e => e.x === nx && e.y === ny && e.hp > 0)
  if (enemyIdx >= 0) {
    const enemy = next.enemies[enemyIdx]
    enemy.hp -= next.atk
    next.message = `You hit the enemy for ${next.atk} damage!`
    if (enemy.hp <= 0) {
      next.kills++
      next.message = 'You defeated the enemy!'
    }
  } else {
    next.playerX = nx
    next.playerY = ny

    if (next.grid[ny][nx] === STAIRS) {
      gameEvents.onDescend?.()
      next.message = 'You descend the stairs...'
      return next
    }

    if (next.grid[ny][nx] === POTION) {
      next.hp = Math.min(next.maxHp, next.hp + 3)
      next.grid[ny][nx] = FLOOR
      next.message = 'You drink a health potion! (+3 HP)'
    }
  }

  // ── Enemy turns ─────────────────────────────────────────────────────────────
  for (const enemy of next.enemies) {
    if (enemy.hp <= 0) continue

    const edx = next.playerX - enemy.x
    const edy = next.playerY - enemy.y

    let moveX = 0
    let moveY = 0
    if (Math.abs(edx) >= Math.abs(edy)) {
      moveX = edx > 0 ? 1 : -1
    } else {
      moveY = edy > 0 ? 1 : -1
    }

    const enx = enemy.x + moveX
    const eny = enemy.y + moveY

    if (enx === next.playerX && eny === next.playerY) {
      next.hp -= 1
      next.message = `An enemy hits you! (${next.hp} HP remaining)`
      if (next.hp <= 0) {
        next.gameOver = true
        next.message = 'You died!'
        gameEvents.onDeath?.()
      }
      continue
    }

    if (
      enx >= 0 && enx < GRID && eny >= 0 && eny < GRID &&
      next.grid[eny][enx] !== WALL &&
      !next.enemies.some(
        other => other !== enemy && other.hp > 0 && other.x === enx && other.y === eny,
      )
    ) {
      enemy.x = enx
      enemy.y = eny
    }
  }

  // Update visibility
  next.visible = computeVisibility(next.grid, next.playerX, next.playerY)
  for (let y = 0; y < GRID; y++) {
    for (let x = 0; x < GRID; x++) {
      if (next.visible[y][x]) next.explored[y][x] = true
    }
  }

  return next
}

// ─── Tile rendering components ────────────────────────────────────────────────
// Colors
const COLOR_FLOOR  = '#1a1f2e'
const COLOR_WALL   = '#0a0d14'
const COLOR_PLAYER = '#4fc3f7'
const COLOR_ENEMY  = '#ef5350'
const COLOR_STAIRS = '#ffd54f'
const COLOR_POTION = '#67c23a'
const COLOR_FOG    = '#000000'
const COLOR_DIMMED = '#0d1018'

export function DungeonTiles({ state }: { state: GameState }) {
  const elements: JSX.Element[] = []

  for (let y = 0; y < GRID; y++) {
    for (let x = 0; x < GRID; x++) {
      const px = x * CELL + CELL / 2
      const py = y * CELL + CELL / 2

      if (!state.explored[y][x]) {
        // Full fog
        elements.push(
          <Entity key={`fog-${x}-${y}`}>
            <Transform x={px} y={py} />
            <Sprite width={CELL} height={CELL} color={COLOR_FOG} zIndex={0} />
          </Entity>
        )
        continue
      }

      if (!state.visible[y][x]) {
        // Explored but not visible — dimmed
        elements.push(
          <Entity key={`dim-${x}-${y}`}>
            <Transform x={px} y={py} />
            <Sprite width={CELL} height={CELL} color={COLOR_DIMMED} zIndex={0} />
          </Entity>
        )
        continue
      }

      // Visible tile
      const tile = state.grid[y][x]
      let color = COLOR_FLOOR
      if (tile === WALL) color = COLOR_WALL

      // Base tile
      elements.push(
        <Entity key={`tile-${x}-${y}`}>
          <Transform x={px} y={py} />
          <Sprite width={CELL} height={CELL} color={color} zIndex={0} />
        </Entity>
      )

      // Special tile markers (stairs, potions) — small colored square
      if (tile === STAIRS) {
        elements.push(
          <Entity key={`stairs-${x}-${y}`}>
            <Transform x={px} y={py} />
            <Sprite width={20} height={20} color={COLOR_STAIRS} zIndex={1} />
          </Entity>
        )
      } else if (tile === POTION) {
        elements.push(
          <Entity key={`potion-${x}-${y}`}>
            <Transform x={px} y={py} />
            <Sprite width={14} height={14} color={COLOR_POTION} zIndex={1} />
          </Entity>
        )
      }
    }
  }

  return <>{elements}</>
}

export function EnemyEntities({ state }: { state: GameState }) {
  return (
    <>
      {state.enemies
        .filter(e => e.hp > 0 && state.visible[e.y][e.x])
        .map((e, i) => (
          <Entity key={`enemy-${i}`} tags={[`enemy-${i}`]}>
            <Transform x={e.x * CELL + CELL / 2} y={e.y * CELL + CELL / 2} />
            <Sprite width={24} height={24} color={COLOR_ENEMY} zIndex={2} />
          </Entity>
        ))}
    </>
  )
}

export function PlayerEntity({ state }: { state: GameState }) {
  return (
    <Entity id="player" tags={['player']}>
      <Transform
        x={state.playerX * CELL + CELL / 2}
        y={state.playerY * CELL + CELL / 2}
      />
      <Sprite width={24} height={24} color={COLOR_PLAYER} zIndex={3} />
    </Entity>
  )
}
