import { Entity, Transform, Sprite, Script } from '@cubeforge/react'
import type { EntityId, ECSWorld, TransformComponent, SpriteComponent } from '@cubeforge/react'
import type { InputManager } from '@cubeforge/react'
import { createTransform } from '@cubeforge/core'
import { createSprite } from '@cubeforge/renderer'
import { createTag } from '@cubeforge/core'
import { gameEvents } from '../gameEvents'

const SPEED            = 220
const SHOOT_COOLDOWN   = 0.15
const INVINCIBLE_DUR   = 2.0
const BULLET_SPEED     = 500
const CANVAS_W         = 800
const CANVAS_H         = 560
const PLAYER_W         = 32
const PLAYER_H         = 20
const BULLET_W         = 10
const BULLET_H         = 4

interface PlayerState {
  shootCooldown:   number
  isInvincible:    boolean
  invincibleTimer: number
  flashTimer:      number
  bulletIds:       Set<EntityId>
}

const playerStates = new Map<EntityId, PlayerState>()

function playerInit(id: EntityId) {
  playerStates.set(id, {
    shootCooldown:   0,
    isInvincible:    false,
    invincibleTimer: 0,
    flashTimer:      0,
    bulletIds:       new Set(),
  })
}

function playerUpdate(id: EntityId, world: ECSWorld, input: InputManager, dt: number) {
  if (!world.hasEntity(id)) return
  const transform = world.getComponent<TransformComponent>(id, 'Transform')
  const sprite    = world.getComponent<SpriteComponent>(id, 'Sprite')
  const state     = playerStates.get(id)
  if (!transform || !sprite || !state) return

  // ── Invincibility flash ──────────────────────────────────────────────────
  if (state.isInvincible) {
    state.invincibleTimer -= dt
    state.flashTimer      -= dt
    if (state.flashTimer <= 0) {
      sprite.visible   = !sprite.visible
      state.flashTimer = 0.1
    }
    if (state.invincibleTimer <= 0) {
      state.isInvincible = false
      sprite.visible     = true
    }
  }

  // ── Vertical movement ────────────────────────────────────────────────────
  const up   = input.isDown('ArrowUp')   || input.isDown('KeyW')
  const down = input.isDown('ArrowDown') || input.isDown('KeyS')

  if (up)        transform.y -= SPEED * dt
  else if (down) transform.y += SPEED * dt

  // Clamp to canvas bounds (half-height from center)
  const minY = PLAYER_H / 2
  const maxY = CANVAS_H - PLAYER_H / 2
  transform.y = Math.max(minY, Math.min(maxY, transform.y))

  // ── Shooting ─────────────────────────────────────────────────────────────
  state.shootCooldown -= dt
  const shoot = input.isDown('Space') || input.isDown('KeyZ')
  if (shoot && state.shootCooldown <= 0) {
    state.shootCooldown = SHOOT_COOLDOWN
    const bulletId = world.createEntity()
    world.addComponent(bulletId, createTransform(transform.x + PLAYER_W / 2, transform.y))
    world.addComponent(bulletId, createSprite({ width: BULLET_W, height: BULLET_H, color: '#ffeb3b', zIndex: 5 }))
    world.addComponent(bulletId, createTag('playerBullet'))
    state.bulletIds.add(bulletId)
  }

  // ── Update player bullets ─────────────────────────────────────────────────
  const toRemoveBullets = new Set<EntityId>()
  for (const bid of state.bulletIds) {
    if (!world.hasEntity(bid)) { toRemoveBullets.add(bid); continue }
    const bt = world.getComponent<TransformComponent>(bid, 'Transform')
    if (!bt) { toRemoveBullets.add(bid); continue }

    bt.x += BULLET_SPEED * dt

    // Off-screen
    if (bt.x > CANVAS_W + 20) {
      world.destroyEntity(bid)
      toRemoveBullets.add(bid)
      continue
    }

    // Check collision with enemies (tag 'enemy')
    let hitEnemy = false
    for (const eid of world.findAllByTag('enemy')) {
      if (!world.hasEntity(eid)) continue
      const et = world.getComponent<TransformComponent>(eid, 'Transform')
      if (!et) continue
      const dx = Math.abs(bt.x - et.x)
      const dy = Math.abs(bt.y - et.y)
      if (dx < (BULLET_W / 2 + 14) && dy < (BULLET_H / 2 + 14)) {
        world.destroyEntity(bid)
        toRemoveBullets.add(bid)
        world.destroyEntity(eid)
        gameEvents.onEnemyKill?.(10)
        hitEnemy = true
        break
      }
    }
    if (hitEnemy) continue
  }
  for (const bid of toRemoveBullets) state.bulletIds.delete(bid)

  // ── Collision with enemy ships ────────────────────────────────────────────
  if (!state.isInvincible) {
    for (const eid of world.findAllByTag('enemy')) {
      if (!world.hasEntity(eid)) continue
      const et = world.getComponent<TransformComponent>(eid, 'Transform')
      if (!et) continue
      const dx = Math.abs(transform.x - et.x)
      const dy = Math.abs(transform.y - et.y)
      if (dx < (PLAYER_W / 2 + 14) && dy < (PLAYER_H / 2 + 14)) {
        state.isInvincible    = true
        state.invincibleTimer = INVINCIBLE_DUR
        state.flashTimer      = 0.1
        gameEvents.onPlayerHit?.()
        break
      }
    }
  }

  // ── Collision with enemy bullets ──────────────────────────────────────────
  if (!state.isInvincible) {
    for (const eid of world.findAllByTag('enemyBullet')) {
      if (!world.hasEntity(eid)) continue
      const et = world.getComponent<TransformComponent>(eid, 'Transform')
      if (!et) continue
      const dx = Math.abs(transform.x - et.x)
      const dy = Math.abs(transform.y - et.y)
      if (dx < (PLAYER_W / 2 + 4) && dy < (PLAYER_H / 2 + 2)) {
        world.destroyEntity(eid)
        state.isInvincible    = true
        state.invincibleTimer = INVINCIBLE_DUR
        state.flashTimer      = 0.1
        gameEvents.onPlayerHit?.()
        break
      }
    }
  }
}

export function Player() {
  return (
    <Entity id="player" tags={['player']}>
      <Transform x={60} y={280} />
      <Sprite width={PLAYER_W} height={PLAYER_H} color="#4fc3f7" zIndex={10} />
      <Script
        init={(id) => playerInit(id)}
        update={playerUpdate}
      />
    </Entity>
  )
}
