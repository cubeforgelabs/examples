import { Entity, Transform, Script } from '@cubeforge/react'
import type { EntityId, ECSWorld, TransformComponent } from '@cubeforge/react'
import type { InputManager } from '@cubeforge/react'
import { createTransform } from '@cubeforge/core'
import { createSprite } from '@cubeforge/renderer'
import { createTag } from '@cubeforge/core'
import { gameEvents } from '../gameEvents'
import { PLAYER_X, PLAYER_W, PLAYER_H } from './Player'

// ─── Constants ────────────────────────────────────────────────────────────────
const CANVAS_W      = 800
const GROUND_TOP    = 350   // y of ground top surface
const BASE_SPEED    = 220
const SPEED_RAMP    = 12    // px/s per second
const MAX_SPEED     = 520
const BASE_INTERVAL = 2.2
const MIN_INTERVAL  = 0.75

// ─── Obstacle sizes (width × height) ─────────────────────────────────────────
const OBSTACLE_TYPES = [
  { w: 22, h: 48, color: '#558b2f' },   // short cactus
  { w: 18, h: 68, color: '#33691e' },   // tall cactus
  { w: 30, h: 36, color: '#4e342e' },   // wide rock
  { w: 16, h: 80, color: '#1b5e20' },   // very tall cactus
]

// ─── State ───────────────────────────────────────────────────────────────────
interface ObstacleData { w: number; h: number }
interface ManagerState {
  speed:        number
  spawnTimer:   number
  spawnInterval: number
  obstacles:    Map<EntityId, ObstacleData>
  dead:         boolean
}
const states = new Map<EntityId, ManagerState>()

// ─── Script ──────────────────────────────────────────────────────────────────
function managerInit(id: EntityId) {
  states.set(id, {
    speed:         BASE_SPEED,
    spawnTimer:    1.0,
    spawnInterval: BASE_INTERVAL,
    obstacles:     new Map(),
    dead:          false,
  })
}

function managerUpdate(id: EntityId, world: ECSWorld, _input: InputManager, dt: number) {
  if (!world.hasEntity(id)) return
  const state = states.get(id)
  if (!state || state.dead) return

  // Ramp up speed
  state.speed = Math.min(MAX_SPEED, state.speed + SPEED_RAMP * dt)
  state.spawnInterval = Math.max(MIN_INTERVAL, BASE_INTERVAL - (state.speed - BASE_SPEED) / 200)

  // Spawn timer
  state.spawnTimer -= dt
  if (state.spawnTimer <= 0) {
    state.spawnTimer = state.spawnInterval * (0.7 + Math.random() * 0.6)
    spawnObstacle(world, state)
  }

  // Find player transform for collision
  let playerTransform: TransformComponent | undefined
  for (const eid of world.query('Tag', 'Transform')) {
    if (!world.hasEntity(eid)) continue
    const tag = world.getComponent<{ type: 'Tag'; tags: string[] }>(eid, 'Tag')
    if (tag?.tags.includes('player')) {
      playerTransform = world.getComponent<TransformComponent>(eid, 'Transform')
      break
    }
  }

  // Move obstacles + check collision
  const toRemove: EntityId[] = []
  for (const [oid, data] of state.obstacles) {
    if (!world.hasEntity(oid)) { toRemove.push(oid); continue }
    const t = world.getComponent<TransformComponent>(oid, 'Transform')
    if (!t) { toRemove.push(oid); continue }

    t.x -= state.speed * dt

    // Off-screen → remove
    if (t.x + data.w / 2 < -20) {
      world.destroyEntity(oid)
      toRemove.push(oid)
      continue
    }

    // AABB collision with player
    if (!state.dead && playerTransform) {
      const px = playerTransform.x
      const py = playerTransform.y
      const pw = PLAYER_W / 2 - 2
      const ph = PLAYER_H / 2
      const ow = data.w / 2 - 2
      const oh = data.h / 2
      if (Math.abs(px - PLAYER_X) < pw + ow && Math.abs(py - t.y) < ph + oh) {
        state.dead = true
        gameEvents.onDeath?.()
      }
    }
  }
  for (const oid of toRemove) state.obstacles.delete(oid)
}

function spawnObstacle(world: ECSWorld, state: ManagerState) {
  const def = OBSTACLE_TYPES[Math.floor(Math.random() * OBSTACLE_TYPES.length)]
  const oid = world.createEntity()
  const cy  = GROUND_TOP - def.h / 2
  world.addComponent(oid, createTransform(CANVAS_W + def.w / 2, cy))
  world.addComponent(oid, createSprite({ width: def.w, height: def.h, color: def.color, zIndex: 5 }))
  world.addComponent(oid, createTag('obstacle'))
  state.obstacles.set(oid, { w: def.w, h: def.h })
}

// ─── Component ───────────────────────────────────────────────────────────────
export function ObstacleManager() {
  return (
    <Entity id="obstacle-manager">
      <Transform x={0} y={0} />
      <Script init={managerInit} update={managerUpdate} />
    </Entity>
  )
}
