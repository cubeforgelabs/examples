import { Entity, Transform, Sprite, Script } from '@cubeforge/react'
import type { EntityId, ECSWorld, TransformComponent } from '@cubeforge/react'
import type { InputManager } from '@cubeforge/react'
import { rpgEvents } from '../rpgEvents'

// ─── Constants ────────────────────────────────────────────────────────────────
export const W = 640
export const H = 480

const TILE = 32
const COLS = W / TILE   // 20
const ROWS = H / TILE   // 15

const PLAYER_SIZE  = 24
const PLAYER_SPD   = 150
const ENEMY_SIZE   = 22
const ENEMY_SPD    = 50
const COIN_SIZE    = 14
const SWORD_RANGE  = 30
const SWORD_CD     = 0.4   // seconds
const DAMAGE_CD    = 0.8   // player invulnerability after hit

const COLOR_GRASS  = '#1a2a1a'
const COLOR_WALL   = '#2a1f1a'
const COLOR_PLAYER = '#4fc3f7'
const COLOR_ENEMY  = '#ef5350'
const COLOR_COIN   = '#ffd54f'
const COLOR_SWORD  = '#81d4fa'

// ─── Map layout (1 = wall, 0 = floor) ────────────────────────────────────────
// 20 columns x 15 rows
const MAP: number[][] = [
  [1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1],
  [1,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,1],
  [1,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,1],
  [1,0,0,1,1,1,0,0,0,0,0,0,0,0,1,1,1,0,0,1],
  [1,0,0,1,0,0,0,0,0,0,0,0,0,0,0,0,1,0,0,1],
  [1,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,1],
  [1,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,1],
  [1,0,0,0,0,0,0,0,1,1,1,1,0,0,0,0,0,0,0,1],
  [1,0,0,0,0,0,0,0,1,0,0,1,0,0,0,0,0,0,0,1],
  [1,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,1],
  [1,0,0,1,1,0,0,0,0,0,0,0,0,0,0,1,1,0,0,1],
  [1,0,0,1,0,0,0,0,0,0,0,0,0,0,0,0,1,0,0,1],
  [1,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,1],
  [1,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,1],
  [1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1],
]

function isWall(px: number, py: number, hw: number, hh: number): boolean {
  const left   = Math.floor((px - hw) / TILE)
  const right  = Math.floor((px + hw - 1) / TILE)
  const top    = Math.floor((py - hh) / TILE)
  const bottom = Math.floor((py + hh - 1) / TILE)
  for (let r = top; r <= bottom; r++) {
    for (let c = left; c <= right; c++) {
      if (r < 0 || r >= ROWS || c < 0 || c >= COLS) return true
      if (MAP[r][c] === 1) return true
    }
  }
  return false
}

function dist(ax: number, ay: number, bx: number, by: number): number {
  const dx = ax - bx
  const dy = ay - by
  return Math.sqrt(dx * dx + dy * dy)
}

// ─── Floor tiles ──────────────────────────────────────────────────────────────
export function FloorTiles() {
  const tiles: { x: number; y: number }[] = []
  for (let r = 0; r < ROWS; r++) {
    for (let c = 0; c < COLS; c++) {
      if (MAP[r][c] === 0) tiles.push({ x: c * TILE + TILE / 2, y: r * TILE + TILE / 2 })
    }
  }
  return (
    <>
      {tiles.map((t, i) => (
        <Entity key={`floor-${i}`}>
          <Transform x={t.x} y={t.y} />
          <Sprite width={TILE} height={TILE} color={COLOR_GRASS} zIndex={0} />
        </Entity>
      ))}
    </>
  )
}

// ─── Wall tiles ───────────────────────────────────────────────────────────────
export function WallTiles() {
  const tiles: { x: number; y: number }[] = []
  for (let r = 0; r < ROWS; r++) {
    for (let c = 0; c < COLS; c++) {
      if (MAP[r][c] === 1) tiles.push({ x: c * TILE + TILE / 2, y: r * TILE + TILE / 2 })
    }
  }
  return (
    <>
      {tiles.map((t, i) => (
        <Entity key={`wall-${i}`}>
          <Transform x={t.x} y={t.y} />
          <Sprite width={TILE} height={TILE} color={COLOR_WALL} zIndex={1} />
        </Entity>
      ))}
    </>
  )
}

// ─── Coins ────────────────────────────────────────────────────────────────────
const COIN_POSITIONS = [
  { x: 5, y: 2 }, { x: 14, y: 2 },
  { x: 2, y: 6 }, { x: 17, y: 6 },
  { x: 10, y: 5 }, { x: 9, y: 12 },
  { x: 4, y: 10 }, { x: 15, y: 10 },
]

export function Coins() {
  return (
    <>
      {COIN_POSITIONS.map((c, i) => (
        <Entity key={`coin-${i}`} tags={[`coin-${i}`]}>
          <Transform x={c.x * TILE + TILE / 2} y={c.y * TILE + TILE / 2} />
          <Sprite width={COIN_SIZE} height={COIN_SIZE} color={COLOR_COIN} zIndex={3} />
        </Entity>
      ))}
    </>
  )
}

// ─── Player ───────────────────────────────────────────────────────────────────
export function Player() {
  return (
    <Entity tags={['rpg-player']}>
      <Transform x={3 * TILE + TILE / 2} y={2 * TILE + TILE / 2} />
      <Sprite width={PLAYER_SIZE} height={PLAYER_SIZE} color={COLOR_PLAYER} zIndex={5} />
    </Entity>
  )
}

// ─── Enemy ────────────────────────────────────────────────────────────────────
interface EnemyProps { index: number; x: number; y: number; patrolAxis: 'x' | 'y'; patrolMin: number; patrolMax: number }

export function Enemy({ index, x, y }: EnemyProps) {
  return (
    <Entity tags={[`enemy-${index}`]}>
      <Transform x={x * TILE + TILE / 2} y={y * TILE + TILE / 2} />
      <Sprite width={ENEMY_SIZE} height={ENEMY_SIZE} color={COLOR_ENEMY} zIndex={4} />
    </Entity>
  )
}

// ─── Sword slash visual ───────────────────────────────────────────────────────
export function SwordSlash() {
  return (
    <Entity tags={['rpg-sword']}>
      <Transform x={-100} y={-100} />
      <Sprite width={SWORD_RANGE} height={8} color={COLOR_SWORD} zIndex={6} />
    </Entity>
  )
}

// ─── Enemy state ──────────────────────────────────────────────────────────────
interface EnemyState {
  hp: number
  dir: number
  patrolAxis: 'x' | 'y'
  patrolMin: number
  patrolMax: number
  flashTimer: number
}

// ─── Game Manager ─────────────────────────────────────────────────────────────
interface RPGState {
  hp: number
  coins: number
  faceDx: number
  faceDy: number
  swordTimer: number
  damageTimer: number
  flashTimer: number
  enemies: EnemyState[]
  coinsCollected: boolean[]
  gameOver: boolean
}

const ENEMIES_DEF = [
  { index: 0, x: 6,  y: 5,  patrolAxis: 'x' as const, patrolMin: 5,  patrolMax: 10 },
  { index: 1, x: 14, y: 9,  patrolAxis: 'y' as const, patrolMin: 6,  patrolMax: 12 },
  { index: 2, x: 9,  y: 12, patrolAxis: 'x' as const, patrolMin: 5,  patrolMax: 14 },
]

const states = new Map<EntityId, RPGState>()

function rpgInit(id: EntityId) {
  states.set(id, {
    hp: 5,
    coins: 0,
    faceDx: 0,
    faceDy: 1,
    swordTimer: 0,
    damageTimer: 0,
    flashTimer: 0,
    enemies: ENEMIES_DEF.map(e => ({
      hp: 2,
      dir: 1,
      patrolAxis: e.patrolAxis,
      patrolMin: e.patrolMin * TILE + TILE / 2,
      patrolMax: e.patrolMax * TILE + TILE / 2,
      flashTimer: 0,
    })),
    coinsCollected: new Array(COIN_POSITIONS.length).fill(false),
    gameOver: false,
  })
}

function rpgUpdate(id: EntityId, world: ECSWorld, input: InputManager, dt: number) {
  if (!world.hasEntity(id)) return
  const state = states.get(id)
  if (!state || state.gameOver) return

  // ── Find entities ──────────────────────────────────────────────────────
  const playerId = world.findByTag('rpg-player')
  const swordId  = world.findByTag('rpg-sword')
  if (!playerId || !swordId) return

  const pt = world.getComponent<TransformComponent>(playerId, 'Transform')
  const ps = world.getComponent<{ color: string; width: number; height: number }>(playerId, 'Sprite')
  const st = world.getComponent<TransformComponent>(swordId, 'Transform')
  const ss = world.getComponent<{ color: string; width: number; height: number }>(swordId, 'Sprite')
  if (!pt || !ps || !st || !ss) return

  // ── Timers ─────────────────────────────────────────────────────────────
  if (state.swordTimer > 0) state.swordTimer -= dt
  if (state.damageTimer > 0) state.damageTimer -= dt
  if (state.flashTimer > 0) state.flashTimer -= dt

  // ── Player movement ────────────────────────────────────────────────────
  let dx = 0
  let dy = 0
  if (input.isDown('KeyW') || input.isDown('ArrowUp'))    dy -= 1
  if (input.isDown('KeyS') || input.isDown('ArrowDown'))  dy += 1
  if (input.isDown('KeyA') || input.isDown('ArrowLeft'))  dx -= 1
  if (input.isDown('KeyD') || input.isDown('ArrowRight')) dx += 1

  if (dx !== 0 || dy !== 0) {
    // Normalize diagonal
    const len = Math.sqrt(dx * dx + dy * dy)
    dx /= len
    dy /= len
    state.faceDx = dx
    state.faceDy = dy

    const hw = PLAYER_SIZE / 2 - 2
    const hh = PLAYER_SIZE / 2 - 2

    // Move X then Y (two-pass)
    const nx = pt.x + dx * PLAYER_SPD * dt
    if (!isWall(nx, pt.y, hw, hh)) pt.x = nx

    const ny = pt.y + dy * PLAYER_SPD * dt
    if (!isWall(pt.x, ny, hw, hh)) pt.y = ny
  }

  // ── Sword attack ───────────────────────────────────────────────────────
  if (input.isDown('Space') && state.swordTimer <= 0) {
    state.swordTimer = SWORD_CD

    // Position sword in front of player
    const sx = pt.x + state.faceDx * (PLAYER_SIZE / 2 + SWORD_RANGE / 2)
    const sy = pt.y + state.faceDy * (PLAYER_SIZE / 2 + SWORD_RANGE / 2)
    st.x = sx
    st.y = sy

    // Orient sword: horizontal or vertical
    if (Math.abs(state.faceDx) >= Math.abs(state.faceDy)) {
      ss.width = SWORD_RANGE
      ss.height = 8
    } else {
      ss.width = 8
      ss.height = SWORD_RANGE
    }

    // Check hits on enemies
    for (let i = 0; i < state.enemies.length; i++) {
      const es = state.enemies[i]
      if (es.hp <= 0) continue
      const eId = world.findByTag(`enemy-${i}`)
      if (!eId) continue
      const et = world.getComponent<TransformComponent>(eId, 'Transform')
      if (!et) continue
      if (dist(sx, sy, et.x, et.y) < SWORD_RANGE) {
        es.hp -= 1
        es.flashTimer = 0.2
        if (es.hp <= 0) {
          // Move dead enemy offscreen
          et.x = -200
          et.y = -200
        }
      }
    }
  } else if (state.swordTimer <= SWORD_CD - 0.1) {
    // Hide sword after brief display
    st.x = -100
    st.y = -100
  }

  // ── Player flash (damage invulnerability) ──────────────────────────────
  if (state.flashTimer > 0) {
    ps.color = Math.floor(state.flashTimer * 20) % 2 === 0 ? COLOR_PLAYER : '#ffffff'
  } else {
    ps.color = COLOR_PLAYER
  }

  // ── Enemy AI & damage ──────────────────────────────────────────────────
  for (let i = 0; i < state.enemies.length; i++) {
    const es = state.enemies[i]
    if (es.hp <= 0) continue
    const eId = world.findByTag(`enemy-${i}`)
    if (!eId) continue
    const et = world.getComponent<TransformComponent>(eId, 'Transform')
    const esp = world.getComponent<{ color: string }>(eId, 'Sprite')
    if (!et || !esp) continue

    // Patrol
    if (es.patrolAxis === 'x') {
      et.x += es.dir * ENEMY_SPD * dt
      if (et.x >= es.patrolMax) { et.x = es.patrolMax; es.dir = -1 }
      if (et.x <= es.patrolMin) { et.x = es.patrolMin; es.dir = 1 }
    } else {
      et.y += es.dir * ENEMY_SPD * dt
      if (et.y >= es.patrolMax) { et.y = es.patrolMax; es.dir = -1 }
      if (et.y <= es.patrolMin) { et.y = es.patrolMin; es.dir = 1 }
    }

    // Flash when hit
    if (es.flashTimer > 0) {
      es.flashTimer -= dt
      esp.color = '#ffffff'
    } else {
      esp.color = COLOR_ENEMY
    }

    // Damage player on contact
    if (state.damageTimer <= 0 && dist(pt.x, pt.y, et.x, et.y) < (PLAYER_SIZE + ENEMY_SIZE) / 2) {
      state.hp -= 1
      state.damageTimer = DAMAGE_CD
      state.flashTimer = DAMAGE_CD
      rpgEvents.onHpChange?.(state.hp)
      if (state.hp <= 0) {
        state.gameOver = true
        rpgEvents.onGameOver?.()
      }
    }
  }

  // ── Coin collection ────────────────────────────────────────────────────
  for (let i = 0; i < COIN_POSITIONS.length; i++) {
    if (state.coinsCollected[i]) continue
    const cId = world.findByTag(`coin-${i}`)
    if (!cId) continue
    const ct = world.getComponent<TransformComponent>(cId, 'Transform')
    if (!ct) continue
    if (dist(pt.x, pt.y, ct.x, ct.y) < (PLAYER_SIZE + COIN_SIZE) / 2) {
      state.coinsCollected[i] = true
      state.coins += 1
      ct.x = -200
      ct.y = -200
      rpgEvents.onCoinCollect?.(state.coins)
    }
  }
}

export function GameManager() {
  return (
    <Entity id="rpg-manager">
      <Transform x={0} y={0} />
      <Script init={rpgInit} update={rpgUpdate} />
    </Entity>
  )
}

// ─── Exports for scene composition ────────────────────────────────────────────
export { ENEMIES_DEF }
