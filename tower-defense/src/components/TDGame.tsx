import { Entity, Transform, Sprite, Script } from '@cubeforge/react'
import { createTransform, createSprite, createTag } from '@cubeforge/react'
import type { EntityId, ECSWorld, TransformComponent } from '@cubeforge/react'
import type { InputManager } from '@cubeforge/react'

// ─── Constants ────────────────────────────────────────────────────────────────
export const W    = 800
export const H    = 600
export const CELL = 40
export const COLS = 20
export const ROWS = 15

// ─── Tower types ──────────────────────────────────────────────────────────────
export type TowerType = 'basic' | 'slow' | 'splash'

export interface TowerDef {
  color:    string
  cost:     number
  damage:   number
  range:    number
  fireRate: number  // shots per second
  slow?:    number  // slow multiplier (0..1)
  splash?:  number  // splash radius
}

export const TOWER_DEFS: Record<TowerType, TowerDef> = {
  basic:  { color: '#4fc3f7', cost: 25,  damage: 20,  range: 120, fireRate: 1.5 },
  slow:   { color: '#9c27b0', cost: 40,  damage: 10,  range: 100, fireRate: 1.0, slow: 0.4 },
  splash: { color: '#ff9800', cost: 60,  damage: 35,  range: 130, fireRate: 0.6, splash: 60 },
}

// ─── Path definition (zigzag) ─────────────────────────────────────────────────
export const PATH_WAYPOINTS: [number, number][] = [
  [0,  3],
  [5,  3],
  [5,  7],
  [15, 7],
  [15, 3],
  [18, 3],
  [18, 11],
  [10, 11],
  [10, 13],
  [20, 13],
]

// Convert grid coords to pixel center
export function gridToPixel(col: number, row: number): [number, number] {
  return [col * CELL + CELL / 2, row * CELL + CELL / 2]
}

// Build the set of grid cells on the path for rendering
export function getPathCells(): Set<string> {
  const cells = new Set<string>()
  for (let i = 0; i < PATH_WAYPOINTS.length - 1; i++) {
    const [c1, r1] = PATH_WAYPOINTS[i]
    const [c2, r2] = PATH_WAYPOINTS[i + 1]
    if (c1 === c2) {
      const minR = Math.min(r1, r2)
      const maxR = Math.max(r1, r2)
      for (let r = minR; r <= maxR; r++) cells.add(`${c1},${r}`)
    } else {
      const minC = Math.min(c1, c2)
      const maxC = Math.max(c1, c2)
      for (let c = minC; c <= maxC; c++) cells.add(`${c},${r1}`)
    }
  }
  return cells
}

// Build pixel waypoints from grid waypoints
const PIXEL_WAYPOINTS = PATH_WAYPOINTS.map(([c, r]) => gridToPixel(c, r))

// ─── Wave definitions ─────────────────────────────────────────────────────────
export interface WaveDef {
  count:    number
  hp:       number
  speed:    number
  interval: number  // seconds between spawns
}

export const WAVES: WaveDef[] = [
  { count: 8,  hp: 60,  speed: 60,  interval: 1.2 },
  { count: 12, hp: 80,  speed: 70,  interval: 1.0 },
  { count: 16, hp: 120, speed: 75,  interval: 0.8 },
  { count: 20, hp: 160, speed: 85,  interval: 0.7 },
  { count: 25, hp: 220, speed: 95,  interval: 0.5 },
]

// ─── Game events (bridge to React state) ──────────────────────────────────────
export const tdEvents = {
  onEnemyKilled: null as (() => void) | null,
  onLifeLost:    null as (() => void) | null,
  onWaveCleared: null as (() => void) | null,
}

// ─── Shared game state ────────────────────────────────────────────────────────
export interface TowerPlacement {
  col:  number
  row:  number
  type: TowerType
}

// Runtime enemy state (managed by the Script system)
interface EnemyState {
  hp:          number
  maxHp:       number
  speed:       number
  baseSpeed:   number
  waypointIdx: number
  slowTimer:   number
  tag:         string
}

interface BulletState {
  targetTag: string
  damage:    number
  speed:     number
  slow?:     number
  splash?:   number
  towerType: TowerType
}

interface TowerState {
  type:     TowerType
  cooldown: number
}

const enemyStates  = new Map<EntityId, EnemyState>()
const bulletStates = new Map<EntityId, BulletState>()
const towerStates  = new Map<EntityId, TowerState>()

// ─── Manager: spawns enemies, processes bullets, tower shooting ───────────────
interface ManagerState {
  spawnTimer:    number
  spawned:       number
  waveIndex:     number
  waveCount:     number
  waveHp:        number
  waveSpeed:     number
  waveInterval:  number
  waveActive:    boolean
  enemyCounter:  number
  bulletCounter: number
}

const managerStates = new Map<EntityId, ManagerState>()

function managerInit(id: EntityId, _world: ECSWorld) {
  managerStates.set(id, {
    spawnTimer:    0,
    spawned:       0,
    waveIndex:     -1,
    waveCount:     0,
    waveHp:        0,
    waveSpeed:     0,
    waveInterval:  1,
    waveActive:    false,
    enemyCounter:  0,
    bulletCounter: 0,
  })
}

function managerUpdate(id: EntityId, world: ECSWorld, _input: InputManager, dt: number) {
  if (!world.hasEntity(id)) return
  const state = managerStates.get(id)
  if (!state) return

  // ── Spawn enemies ──────────────────────────────────────────────────────
  if (state.waveActive && state.spawned < state.waveCount) {
    state.spawnTimer -= dt
    if (state.spawnTimer <= 0) {
      state.spawnTimer = state.waveInterval
      state.spawned++
      state.enemyCounter++
      const tag = `enemy-${state.enemyCounter}`
      const [sx, sy] = PIXEL_WAYPOINTS[0]
      const enemyId = world.createEntity()
      world.addComponent(enemyId, createTag(tag, 'enemy'))
      world.addComponent(enemyId, createTransform(sx, sy))
      world.addComponent(enemyId, createSprite({ width: 24, height: 24, color: '#ef5350', zIndex: 20 }))
      enemyStates.set(enemyId, {
        hp:          state.waveHp,
        maxHp:       state.waveHp,
        speed:       state.waveSpeed,
        baseSpeed:   state.waveSpeed,
        waypointIdx: 1,
        slowTimer:   0,
        tag,
      })
    }
  }

  // ── Check if wave cleared ──────────────────────────────────────────────
  if (state.waveActive && state.spawned >= state.waveCount) {
    let aliveCount = 0
    for (const [eid] of enemyStates) {
      if (world.hasEntity(eid)) aliveCount++
    }
    if (aliveCount === 0) {
      state.waveActive = false
      tdEvents.onWaveCleared?.()
    }
  }

  // ── Move enemies along path ────────────────────────────────────────────
  for (const [eid, es] of enemyStates) {
    if (!world.hasEntity(eid)) { enemyStates.delete(eid); continue }
    const tf = world.getComponent<TransformComponent>(eid, 'Transform')
    if (!tf) continue

    // Slow timer
    if (es.slowTimer > 0) {
      es.slowTimer -= dt
      if (es.slowTimer <= 0) es.speed = es.baseSpeed
    }

    if (es.waypointIdx >= PIXEL_WAYPOINTS.length) {
      // Reached the end
      world.destroyEntity(eid)
      enemyStates.delete(eid)
      tdEvents.onLifeLost?.()
      continue
    }

    const [tx, ty] = PIXEL_WAYPOINTS[es.waypointIdx]
    const dx = tx - tf.x
    const dy = ty - tf.y
    const dist = Math.sqrt(dx * dx + dy * dy)
    if (dist < 2) {
      es.waypointIdx++
    } else {
      const step = es.speed * dt
      tf.x += (dx / dist) * Math.min(step, dist)
      tf.y += (dy / dist) * Math.min(step, dist)
    }
  }

  // ── Tower shooting ─────────────────────────────────────────────────────
  for (const [tid, ts] of towerStates) {
    if (!world.hasEntity(tid)) { towerStates.delete(tid); continue }
    const def = TOWER_DEFS[ts.type]
    ts.cooldown -= dt
    if (ts.cooldown > 0) continue

    const ttf = world.getComponent<TransformComponent>(tid, 'Transform')
    if (!ttf) continue

    // Find nearest enemy in range
    let bestDist = Infinity
    let bestEid: EntityId | null = null
    for (const [eid] of enemyStates) {
      if (!world.hasEntity(eid)) continue
      const etf = world.getComponent<TransformComponent>(eid, 'Transform')
      if (!etf) continue
      const dx = etf.x - ttf.x
      const dy = etf.y - ttf.y
      const d = Math.sqrt(dx * dx + dy * dy)
      if (d <= def.range && d < bestDist) {
        bestDist = d
        bestEid = eid
      }
    }

    if (bestEid != null) {
      ts.cooldown = 1 / def.fireRate

      // Get the target's unique tag from our enemy state map
      const es = enemyStates.get(bestEid)
      if (!es) continue
      const targetTag = es.tag

      // Spawn bullet
      state.bulletCounter++
      const bid = world.createEntity()
      world.addComponent(bid, createTag(`bullet-${state.bulletCounter}`, 'bullet'))
      world.addComponent(bid, createTransform(ttf.x, ttf.y))
      world.addComponent(bid, createSprite({ width: 6, height: 6, color: '#ffffff', zIndex: 25 }))
      bulletStates.set(bid, {
        targetTag,
        damage: def.damage,
        speed:  300,
        slow:   def.slow,
        splash: def.splash,
        towerType: ts.type,
      })
    }
  }

  // ── Move bullets toward targets ────────────────────────────────────────
  for (const [bid, bs] of bulletStates) {
    if (!world.hasEntity(bid)) { bulletStates.delete(bid); continue }
    const btf = world.getComponent<TransformComponent>(bid, 'Transform')
    if (!btf) { bulletStates.delete(bid); continue }

    // Find target
    const targetId = world.findByTag(bs.targetTag)
    if (!targetId || !world.hasEntity(targetId)) {
      // Target dead, remove bullet
      world.destroyEntity(bid)
      bulletStates.delete(bid)
      continue
    }

    const etf = world.getComponent<TransformComponent>(targetId, 'Transform')
    if (!etf) { world.destroyEntity(bid); bulletStates.delete(bid); continue }

    const dx = etf.x - btf.x
    const dy = etf.y - btf.y
    const dist = Math.sqrt(dx * dx + dy * dy)

    if (dist < 8) {
      // Hit!
      world.destroyEntity(bid)
      bulletStates.delete(bid)

      // Apply splash damage
      if (bs.splash) {
        for (const [eid, es] of enemyStates) {
          if (!world.hasEntity(eid)) continue
          const ef = world.getComponent<TransformComponent>(eid, 'Transform')
          if (!ef) continue
          const sdx = ef.x - etf.x
          const sdy = ef.y - etf.y
          if (Math.sqrt(sdx * sdx + sdy * sdy) <= bs.splash) {
            applyDamage(eid, es, bs.damage, world)
          }
        }
      } else {
        const es = enemyStates.get(targetId)
        if (es) {
          applyDamage(targetId, es, bs.damage, world)
          if (bs.slow && es.hp > 0) {
            es.speed = es.baseSpeed * bs.slow
            es.slowTimer = 2.0
          }
        }
      }
    } else {
      const step = bs.speed * dt
      btf.x += (dx / dist) * Math.min(step, dist)
      btf.y += (dy / dist) * Math.min(step, dist)
    }
  }
}

function applyDamage(eid: EntityId, es: EnemyState, damage: number, world: ECSWorld) {
  es.hp -= damage
  if (es.hp <= 0) {
    world.destroyEntity(eid)
    enemyStates.delete(eid)
    tdEvents.onEnemyKilled?.()
  } else {
    // Update sprite color to show damage (gets darker/redder as HP drops)
    const ratio = es.hp / es.maxHp
    const r = 239
    const g = Math.round(83 * ratio)
    const b = Math.round(80 * ratio)
    const sprite = world.getComponent(eid, 'Sprite') as { color: string } | undefined
    if (sprite) {
      sprite.color = `rgb(${r},${g},${b})`
    }
  }
}

// ─── Start wave (called from React) ──────────────────────────────────────────
export function startWave(waveIndex: number) {
  for (const [, state] of managerStates) {
    if (waveIndex >= WAVES.length) return
    const wave = WAVES[waveIndex]
    state.waveIndex    = waveIndex
    state.waveCount    = wave.count
    state.waveHp       = wave.hp
    state.waveSpeed    = wave.speed
    state.waveInterval = wave.interval
    state.spawned      = 0
    state.spawnTimer   = 0.3
    state.waveActive   = true
  }
}

// ─── Register a tower (called when React places a tower) ─────────────────────
export function registerTower(entityId: EntityId, type: TowerType) {
  towerStates.set(entityId, { type, cooldown: 0 })
}

// ─── Clear all runtime state (for restart) ────────────────────────────────────
export function clearAllState() {
  enemyStates.clear()
  bulletStates.clear()
  towerStates.clear()
  managerStates.clear()
}

// ─── Components ───────────────────────────────────────────────────────────────

// Path background cells
export function PathCell({ col, row }: { col: number; row: number }) {
  const [x, y] = gridToPixel(col, row)
  return (
    <Entity>
      <Transform x={x} y={y} />
      <Sprite width={CELL} height={CELL} color="#1a1f2e" zIndex={1} />
    </Entity>
  )
}

// Tower entity (placed by React, registered with Script)
interface TowerEntityProps {
  col:  number
  row:  number
  type: TowerType
  idx:  number
}

function towerInit(id: EntityId, world: ECSWorld) {
  // Determine tower type from sprite color
  const sprite = world.getComponent<{ color: string }>(id, 'Sprite')
  if (!sprite) return
  let type: TowerType = 'basic'
  if (sprite.color === TOWER_DEFS.slow.color)   type = 'slow'
  if (sprite.color === TOWER_DEFS.splash.color) type = 'splash'
  registerTower(id, type)
}

export function TowerEntity({ col, row, type, idx }: TowerEntityProps) {
  const [x, y] = gridToPixel(col, row)
  const def = TOWER_DEFS[type]
  return (
    <Entity id={`tower-${idx}`} tags={[`tower-${idx}`]}>
      <Transform x={x} y={y} />
      <Sprite width={30} height={30} color={def.color} zIndex={10} />
      <Script init={towerInit} update={() => {}} />
    </Entity>
  )
}

// Game manager entity
export function GameManagerEntity() {
  return (
    <Entity id="td-manager">
      <Transform x={0} y={0} />
      <Script init={managerInit} update={managerUpdate} />
    </Entity>
  )
}
