import { Entity, Transform, Script } from '@cubeforge/react'
import type { EntityId, ECSWorld, TransformComponent } from '@cubeforge/react'
import type { InputManager } from '@cubeforge/react'
import { createTransform } from '@cubeforge/core'
import { createSprite } from '@cubeforge/renderer'
import { createTag } from '@cubeforge/core'
import { gameEvents } from '../gameEvents'

const CANVAS_W       = 800
const CANVAS_H       = 560
const ENEMY_W        = 28
const ENEMY_H        = 28
const PLAYER_W       = 32
const PLAYER_H       = 20
const ENEMY_BULLET_W = 8
const ENEMY_BULLET_H = 4
const ENEMY_BULLET_SPEED = 320

type EnemyType = 'straight' | 'sine' | 'zigzag'

interface EnemyState {
  type:         EnemyType
  baseY:        number
  timer:        number
  shootCooldown: number
  speed:        number
  zigzagDir:    1 | -1
  zigzagTimer:  number
}

interface ManagerState {
  spawnTimer:   number
  spawnInterval: number
  killCount:    number
  wave:         number
  enemyIds:     Set<EntityId>
  bulletIds:    Set<EntityId>
  typeIndex:    number
  active:       boolean
}

// Module-level maps keyed by manager entity id
const managerStates  = new Map<EntityId, ManagerState>()
const enemyStates    = new Map<EntityId, EnemyState>()

function getSpawnInterval(wave: number): number {
  return Math.max(0.5, 1.2 - (wave - 1) * 0.1)
}

function getEnemySpeed(wave: number): number {
  return 80 + (wave - 1) * 20
}

function getShootInterval(wave: number): number {
  return Math.max(0.5, 2.0 - (wave - 1) * 0.1)
}

const ENEMY_TYPES: EnemyType[] = ['straight', 'sine', 'zigzag']

function managerInit(id: EntityId, initialWave: number) {
  managerStates.set(id, {
    spawnTimer:    0,
    spawnInterval: getSpawnInterval(initialWave),
    killCount:     0,
    wave:          initialWave,
    enemyIds:      new Set(),
    bulletIds:     new Set(),
    typeIndex:     0,
    active:        true,
  })
}

function spawnEnemy(world: ECSWorld, state: ManagerState) {
  const type = ENEMY_TYPES[state.typeIndex % ENEMY_TYPES.length] as EnemyType
  state.typeIndex++

  const y = 60 + Math.random() * (CANVAS_H - 120)
  const speed = getEnemySpeed(state.wave)

  const eid = world.createEntity()
  world.addComponent(eid, createTransform(CANVAS_W + 20, y))
  world.addComponent(eid, createSprite({ width: ENEMY_W, height: ENEMY_H, color: '#ef5350', zIndex: 8 }))
  world.addComponent(eid, createTag('enemy'))

  const shootInterval = getShootInterval(state.wave)

  enemyStates.set(eid, {
    type,
    baseY:        y,
    timer:        0,
    shootCooldown: shootInterval * Math.random(),  // stagger initial shots
    speed,
    zigzagDir:    1,
    zigzagTimer:  0,
  })

  state.enemyIds.add(eid)
}

function managerUpdate(id: EntityId, world: ECSWorld, _input: InputManager, dt: number) {
  if (!world.hasEntity(id)) return
  const state = managerStates.get(id)
  if (!state || !state.active) return

  // ── Spawn timer ───────────────────────────────────────────────────────────
  state.spawnTimer += dt
  if (state.spawnTimer >= state.spawnInterval) {
    state.spawnTimer -= state.spawnInterval
    spawnEnemy(world, state)
  }

  // ── Find player transform ─────────────────────────────────────────────────
  let playerX = 60
  let playerY = 280
  const playerId = world.findByTag('player')
  if (playerId) {
    const pt = world.getComponent<TransformComponent>(playerId, 'Transform')
    if (pt) { playerX = pt.x; playerY = pt.y }
  }

  // ── Update enemies ────────────────────────────────────────────────────────
  const toRemoveEnemies = new Set<EntityId>()
  for (const eid of state.enemyIds) {
    if (!world.hasEntity(eid)) { toRemoveEnemies.add(eid); continue }

    const et = world.getComponent<TransformComponent>(eid, 'Transform')
    const es = enemyStates.get(eid)
    if (!et || !es) { toRemoveEnemies.add(eid); continue }

    es.timer += dt

    // Movement pattern
    et.x -= es.speed * dt

    if (es.type === 'sine') {
      et.y = es.baseY + Math.sin(es.timer * 2 * Math.PI) * 50
    } else if (es.type === 'zigzag') {
      es.zigzagTimer += dt
      if (es.zigzagTimer >= 0.8) {
        es.zigzagTimer = 0
        es.zigzagDir = es.zigzagDir === 1 ? -1 : 1
      }
      et.y += es.zigzagDir * es.speed * 0.6 * dt
      // Clamp to canvas
      if (et.y < ENEMY_H / 2)            { et.y = ENEMY_H / 2;            es.zigzagDir = 1  }
      if (et.y > CANVAS_H - ENEMY_H / 2) { et.y = CANVAS_H - ENEMY_H / 2; es.zigzagDir = -1 }
    }

    // Off-screen left — destroy without score
    if (et.x < -40) {
      world.destroyEntity(eid)
      enemyStates.delete(eid)
      toRemoveEnemies.add(eid)
      continue
    }

    // Shooting
    es.shootCooldown -= dt
    if (es.shootCooldown <= 0) {
      es.shootCooldown = getShootInterval(state.wave)
      const bid = world.createEntity()
      world.addComponent(bid, createTransform(et.x - ENEMY_W / 2, et.y))
      world.addComponent(bid, createSprite({ width: ENEMY_BULLET_W, height: ENEMY_BULLET_H, color: '#ff5722', zIndex: 6 }))
      world.addComponent(bid, createTag('enemyBullet'))
      state.bulletIds.add(bid)
    }
  }
  for (const eid of toRemoveEnemies) state.enemyIds.delete(eid)

  // ── Update enemy bullets ──────────────────────────────────────────────────
  const toRemoveBullets = new Set<EntityId>()
  for (const bid of state.bulletIds) {
    if (!world.hasEntity(bid)) { toRemoveBullets.add(bid); continue }

    const bt = world.getComponent<TransformComponent>(bid, 'Transform')
    if (!bt) { toRemoveBullets.add(bid); continue }

    bt.x -= ENEMY_BULLET_SPEED * dt

    if (bt.x < -10) {
      world.destroyEntity(bid)
      toRemoveBullets.add(bid)
      continue
    }

    // Check AABB with player
    const dx = Math.abs(bt.x - playerX)
    const dy = Math.abs(bt.y - playerY)
    if (dx < (ENEMY_BULLET_W / 2 + PLAYER_W / 2) && dy < (ENEMY_BULLET_H / 2 + PLAYER_H / 2)) {
      // Player collision is handled in Player script to avoid double-counting.
      // Bullet removal from here is skipped — Player script destroys the bullet.
      // (We only track the bullet in our set; Player.tsx removes it from world.)
    }
  }
  for (const bid of toRemoveBullets) state.bulletIds.delete(bid)

  // ── Clean up bullet set (player script may have destroyed some) ───────────
  for (const bid of [...state.bulletIds]) {
    if (!world.hasEntity(bid)) state.bulletIds.delete(bid)
  }

  // ── Track kills via gameEvents for wave progression ───────────────────────
  // (Kill counting is done via the onEnemyKill callback in App, but wave
  //  transitions are signalled from here via the killCount we shadow.)
}

// Called from App via gameEvents to inform manager of kill count
// We attach a hook on the manager state directly instead.
export function notifyKill(managerId: EntityId, wave: number) {
  const state = managerStates.get(managerId)
  if (!state) return
  state.killCount++
  if (state.killCount > 0 && state.killCount % 10 === 0) {
    state.wave = Math.min(5, state.wave + 1)
    state.spawnInterval = getSpawnInterval(state.wave)
    gameEvents.onWaveComplete?.()
  }
  // Sync wave from outside
  state.wave = wave
  state.spawnInterval = getSpawnInterval(wave)
}

interface EnemyManagerProps {
  wave: number
}

export function EnemyManager({ wave }: EnemyManagerProps) {
  return (
    <Entity id="enemyManager">
      <Transform x={0} y={0} />
      <Script
        init={(id) => managerInit(id, wave)}
        update={managerUpdate}
      />
    </Entity>
  )
}
