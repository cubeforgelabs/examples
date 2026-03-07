import { Entity, Transform, Script } from '@cubeforge/react'
import type { EntityId, ECSWorld, TransformComponent, SpriteComponent } from '@cubeforge/react'
import type { InputManager } from '@cubeforge/react'
import { createTransform } from '@cubeforge/core'
import { createSprite } from '@cubeforge/renderer'
import { createTag } from '@cubeforge/core'
import { gameEvents } from '../gameEvents'
import { CANVAS_W, CANVAS_H } from './Ship'

// ─── Asteroid sizes ───────────────────────────────────────────────────────────
const SIZES = {
  large:  { r: 38, pts: 20,  color: '#5d4037', splits: 'medium' as const },
  medium: { r: 22, pts: 50,  color: '#4e342e', splits: 'small'  as const },
  small:  { r: 12, pts: 100, color: '#3e2723', splits: null },
}
type AsteroidSize = keyof typeof SIZES

// ─── State ────────────────────────────────────────────────────────────────────
interface AsteroidData { vx: number; vy: number; rotSpd: number; size: AsteroidSize }
interface FieldState {
  asteroids: Map<EntityId, AsteroidData>
  wave:      number
  cleared:   boolean
  clearTimer: number
}
const states = new Map<EntityId, FieldState>()

// ─── Helpers ──────────────────────────────────────────────────────────────────
function wrap(v: number, max: number) {
  if (v < -50)      return max + 50
  if (v > max + 50) return -50
  return v
}

function randEdge(): { x: number; y: number } {
  const side = Math.floor(Math.random() * 4)
  if (side === 0) return { x: Math.random() * CANVAS_W,  y: -50 }
  if (side === 1) return { x: CANVAS_W + 50, y: Math.random() * CANVAS_H }
  if (side === 2) return { x: Math.random() * CANVAS_W,  y: CANVAS_H + 50 }
  return             { x: -50,             y: Math.random() * CANVAS_H }
}

function spawnAsteroid(
  world: ECSWorld,
  state: FieldState,
  size: AsteroidSize,
  x: number,
  y: number,
  baseSpeed: number,
) {
  const def   = SIZES[size]
  const angle = Math.random() * Math.PI * 2
  const speed = baseSpeed * (0.6 + Math.random() * 0.8)
  const oid   = world.createEntity()
  world.addComponent(oid, createTransform(x, y))
  world.addComponent(oid, createSprite({ width: def.r * 2, height: def.r * 2, color: def.color, zIndex: 3 }))
  world.addComponent(oid, createTag('asteroid'))
  state.asteroids.set(oid, {
    vx:     Math.cos(angle) * speed,
    vy:     Math.sin(angle) * speed,
    rotSpd: (Math.random() - 0.5) * 2.0,
    size,
  })
}

function spawnWave(world: ECSWorld, state: FieldState) {
  const count     = 4 + state.wave
  const baseSpeed = 60 + state.wave * 15
  for (let i = 0; i < count; i++) {
    const pos = randEdge()
    spawnAsteroid(world, state, 'large', pos.x, pos.y, baseSpeed)
  }
  state.cleared = false
}

// ─── Script ───────────────────────────────────────────────────────────────────
function fieldInit(id: EntityId) {
  const state: FieldState = { asteroids: new Map(), wave: 1, cleared: false, clearTimer: 0 }
  states.set(id, state)
}

function fieldUpdate(id: EntityId, world: ECSWorld, _input: InputManager, dt: number) {
  if (!world.hasEntity(id)) return
  const state = states.get(id)
  if (!state) return

  // Initial spawn
  if (!state.cleared && state.asteroids.size === 0 && state.clearTimer === 0) {
    spawnWave(world, state)
    return
  }

  // Wave cleared — brief pause then next wave
  if (!state.cleared && state.asteroids.size === 0) {
    state.cleared = true
    state.clearTimer = 2.5
    gameEvents.onWave?.()
  }
  if (state.cleared) {
    state.clearTimer -= dt
    if (state.clearTimer <= 0) {
      state.wave++
      spawnWave(world, state)
    }
    return
  }

  // ── Move asteroids ─────────────────────────────────────────────────────
  const toDestroy: EntityId[] = []
  for (const [oid, data] of state.asteroids) {
    if (!world.hasEntity(oid)) { toDestroy.push(oid); continue }
    const at = world.getComponent<TransformComponent>(oid, 'Transform')
    if (!at) { toDestroy.push(oid); continue }
    at.x = wrap(at.x + data.vx * dt, CANVAS_W)
    at.y = wrap(at.y + data.vy * dt, CANVAS_H)
    at.rotation += data.rotSpd * dt
  }
  for (const oid of toDestroy) state.asteroids.delete(oid)

  // ── Bullet-asteroid collisions ─────────────────────────────────────────
  const hitAsteroids = new Set<EntityId>()
  const hitBullets   = new Set<EntityId>()

  for (const bid of world.findAllByTag('bullet')) {
    if (!world.hasEntity(bid) || hitBullets.has(bid)) continue
    const bt = world.getComponent<TransformComponent>(bid, 'Transform')
    if (!bt) continue

    for (const [oid, data] of state.asteroids) {
      if (hitAsteroids.has(oid) || !world.hasEntity(oid)) continue
      const at = world.getComponent<TransformComponent>(oid, 'Transform')
      const sp = world.getComponent<SpriteComponent>(oid, 'Sprite')
      if (!at || !sp) continue
      const ar = sp.width / 2
      const dx = bt.x - at.x
      const dy = bt.y - at.y
      if (Math.sqrt(dx * dx + dy * dy) < ar + 3) {
        hitAsteroids.add(oid)
        hitBullets.add(bid)

        // Score
        gameEvents.onScore?.(SIZES[data.size].pts)

        // Split
        const splitType = SIZES[data.size].splits
        if (splitType) {
          for (let s = 0; s < 2; s++) {
            const angle = Math.random() * Math.PI * 2
            const spd   = 80 + Math.random() * 60
            const nx    = at.x + Math.cos(angle) * 20
            const ny    = at.y + Math.sin(angle) * 20
            const frag  = world.createEntity()
            const fdef  = SIZES[splitType]
            world.addComponent(frag, createTransform(nx, ny))
            world.addComponent(frag, createSprite({ width: fdef.r * 2, height: fdef.r * 2, color: fdef.color, zIndex: 3 }))
            world.addComponent(frag, createTag('asteroid'))
            state.asteroids.set(frag, {
              vx: Math.cos(angle) * spd,
              vy: Math.sin(angle) * spd,
              rotSpd: (Math.random() - 0.5) * 3.0,
              size: splitType,
            })
          }
        }
        break
      }
    }
  }

  // Destroy hit bullets + asteroids
  for (const bid of hitBullets)   { if (world.hasEntity(bid)) world.destroyEntity(bid) }
  for (const oid of hitAsteroids) {
    if (world.hasEntity(oid)) world.destroyEntity(oid)
    state.asteroids.delete(oid)
  }
}

// ─── Component ────────────────────────────────────────────────────────────────
export function AsteroidField() {
  return (
    <Entity id="asteroid-field">
      <Transform x={0} y={0} />
      <Script init={fieldInit} update={fieldUpdate} />
    </Entity>
  )
}
