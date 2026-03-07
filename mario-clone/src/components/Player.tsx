import { Entity, Transform, Sprite, RigidBody, BoxCollider, Script } from '@cubeforge/react'
import { createInputMap, findByTag } from '@cubeforge/react'
import type { EntityId, ECSWorld, TransformComponent, RigidBodyComponent, SpriteComponent, BoxColliderComponent } from '@cubeforge/react'
import type { InputManager } from '@cubeforge/react'
import { createTransform } from '@cubeforge/core'
import { createSprite } from '@cubeforge/renderer'
import { createTag } from '@cubeforge/core'
import { gameEvents } from '../gameEvents'
import { getImage } from '../images'

const actions = createInputMap({
  left:  ['ArrowLeft', 'KeyA'],
  right: ['ArrowRight', 'KeyD'],
  jump:  ['Space', 'ArrowUp', 'KeyW'],
  fire:  ['KeyX', 'KeyZ'],
})

const SPEED           = 220
const JUMP_FORCE      = -530
const SMALL_H         = 40
const BIG_H           = 54
const COYOTE_TIME     = 0.1
const JUMP_BUFFER     = 0.09
const INVINCIBLE_DUR  = 2.0
const KNOCKBACK_X     = 260
const KNOCKBACK_Y     = -300
const FIREBALL_SPEED  = 380
const FIREBALL_LIFE   = 2.5
const FIREBALL_GRAV   = 700
const BOUNCE_Y        = 492

// Module-level config mutated by App.tsx on powerup
export const playerConfig = {
  maxJumps:     1,
  isBig:        false,
  canFire:      false,
  isStarActive: false,
  starTimer:    0,
  spawnX:       80,
  spawnY:       420,
}

interface BowserHPComponent { type: 'BowserHP'; hp: number }
interface FireballData { vx: number; vy: number; life: number; bounces: number }

interface PlayerState {
  coyoteTimer:     number
  jumpBuffer:      number
  jumpsLeft:       number
  maxJumps:        number
  facingRight:     boolean
  isInvincible:    boolean
  invincibleTimer: number
  flashTimer:      number
  fireCooldown:    number
  fireballs:       Map<EntityId, FireballData>
  appliedH:        number   // last height applied to sprite + collider
}

const playerStates = new Map<EntityId, PlayerState>()

function playerInit(id: EntityId) {
  playerStates.set(id, {
    coyoteTimer:     0,
    jumpBuffer:      0,
    jumpsLeft:       playerConfig.maxJumps,
    maxJumps:        playerConfig.maxJumps,
    facingRight:     true,
    isInvincible:    false,
    invincibleTimer: 0,
    flashTimer:      0,
    fireCooldown:    0,
    fireballs:       new Map(),
    appliedH:        SMALL_H,
  })
}

function playerUpdate(id: EntityId, world: ECSWorld, input: InputManager, dt: number) {
  if (!world.hasEntity(id)) return
  const transform = world.getComponent<TransformComponent>(id, 'Transform')!
  const rb        = world.getComponent<RigidBodyComponent>(id, 'RigidBody')!
  const sprite    = world.getComponent<SpriteComponent>(id, 'Sprite')!
  const state     = playerStates.get(id)!

  state.maxJumps = playerConfig.maxJumps

  // ── Star timer ────────────────────────────────────────────────────────────
  if (playerConfig.isStarActive) {
    playerConfig.starTimer -= dt
    if (playerConfig.starTimer <= 0) {
      playerConfig.isStarActive = false
      playerConfig.starTimer    = 0
      sprite.visible            = true
    } else {
      state.flashTimer -= dt
      if (state.flashTimer <= 0) {
        sprite.visible   = !sprite.visible
        state.flashTimer = 0.07
      }
    }
  }

  // ── Normal invincibility flash ─────────────────────────────────────────────
  if (state.isInvincible && !playerConfig.isStarActive) {
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

  // ── Ground state ──────────────────────────────────────────────────────────
  if (rb.onGround) {
    state.coyoteTimer = COYOTE_TIME
    state.jumpsLeft   = state.maxJumps
  } else {
    state.coyoteTimer = Math.max(0, state.coyoteTimer - dt)
  }

  // ── Jump buffer ───────────────────────────────────────────────────────────
  if (actions.isActionPressed(input, 'jump')) state.jumpBuffer = JUMP_BUFFER
  else                                         state.jumpBuffer = Math.max(0, state.jumpBuffer - dt)

  // ── Horizontal movement ───────────────────────────────────────────────────
  const left  = actions.isActionDown(input, 'left')
  const right = actions.isActionDown(input, 'right')
  if (left)       { rb.vx = -SPEED; state.facingRight = false }
  else if (right) { rb.vx =  SPEED; state.facingRight = true  }
  else              rb.vx *= rb.onGround ? 0.65 : 0.95
  sprite.flipX = !state.facingRight

  // ── Jump ──────────────────────────────────────────────────────────────────
  const canJump = state.coyoteTimer > 0 || state.jumpsLeft > 0
  if (state.jumpBuffer > 0 && canJump) {
    rb.vy             = JUMP_FORCE
    state.jumpsLeft   = Math.max(0, state.jumpsLeft - 1)
    state.coyoteTimer = 0
    state.jumpBuffer  = 0
  }
  if (!actions.isActionDown(input, 'jump') && rb.vy < -150) rb.vy += 900 * dt

  // ── Powerup size + sprite sync ────────────────────────────────────────────
  const targetH   = (playerConfig.isBig || playerConfig.canFire) ? BIG_H : SMALL_H
  const targetSrc = playerConfig.canFire ? '/SMB_Fire_Mario_Sprite.png'
                  : playerConfig.isBig   ? '/ClassicNES_SMB_Super_Mario_Sprite.png'
                  :                        '/ClassicNES_SMB_Small_Mario_Sprite.png'
  if (state.appliedH !== targetH) {
    const delta = targetH - state.appliedH
    transform.y   -= delta / 2          // grow upward, shrink downward
    sprite.height  = targetH
    const bc = world.getComponent<BoxColliderComponent>(id, 'BoxCollider')
    if (bc) bc.height = targetH
    state.appliedH = targetH
  }
  const powerImg = getImage(targetSrc)
  if (powerImg) sprite.image = powerImg

  // ── Shoot fireball ────────────────────────────────────────────────────────
  state.fireCooldown = Math.max(0, state.fireCooldown - dt)
  if (playerConfig.canFire && actions.isActionPressed(input, 'fire') && state.fireCooldown <= 0) {
    state.fireCooldown = 0.35
    const dir = state.facingRight ? 1 : -1
    const fid = world.createEntity()
    world.addComponent(fid, createTransform(transform.x + dir * 16, transform.y + 4))
    const fs = createSprite({ width: 14, height: 14, color: '#ff6f00', zIndex: 9 })
    const img = getImage('/SMBFireBall.gif')
    if (img) fs.image = img
    world.addComponent(fid, fs)
    world.addComponent(fid, createTag('fireball'))
    state.fireballs.set(fid, { vx: FIREBALL_SPEED * dir, vy: -180, life: FIREBALL_LIFE, bounces: 0 })
  }

  // ── Move + collide fireballs ──────────────────────────────────────────────
  const toRemoveF: EntityId[] = []
  for (const [fid, fdata] of state.fireballs) {
    if (!world.hasEntity(fid)) { toRemoveF.push(fid); continue }
    const ft = world.getComponent<TransformComponent>(fid, 'Transform')
    if (!ft) { toRemoveF.push(fid); continue }

    fdata.life -= dt
    fdata.vy   += FIREBALL_GRAV * dt
    ft.x       += fdata.vx * dt
    ft.y       += fdata.vy * dt

    if (ft.y >= BOUNCE_Y) {
      ft.y = BOUNCE_Y
      fdata.vy = -260
      fdata.bounces++
      if (fdata.bounces >= 4) { world.destroyEntity(fid); toRemoveF.push(fid); continue }
    }
    if (fdata.life <= 0) { world.destroyEntity(fid); toRemoveF.push(fid); continue }

    let hitSomething = false
    for (const eid of world.findAllByTag('enemy')) {
      if (!world.hasEntity(eid)) continue
      const et = world.getComponent<TransformComponent>(eid, 'Transform')
      if (!et) continue
      if (Math.abs(ft.x - et.x) < 26 && Math.abs(ft.y - et.y) < 26) {
        const bowserHp = world.getComponent<BowserHPComponent>(eid, 'BowserHP')
        if (bowserHp) {
          bowserHp.hp -= 1
          if (bowserHp.hp <= 0) { world.destroyEntity(eid); gameEvents.onGoalReached?.() }
        } else {
          world.destroyEntity(eid)
          gameEvents.onEnemyKill?.(200)
        }
        hitSomething = true
        break
      }
    }
    if (hitSomething) { world.destroyEntity(fid); toRemoveF.push(fid) }
  }
  for (const fid of toRemoveF) state.fireballs.delete(fid)

  // ── Enemy interactions ────────────────────────────────────────────────────
  const stomped = new Set<EntityId>()
  for (const eid of findByTag(world, 'enemy')) {
    if (eid === id || !world.hasEntity(eid)) continue
    const et = world.getComponent<TransformComponent>(eid, 'Transform')
    if (!et) continue
    const dx = Math.abs(transform.x - et.x)
    const dy = transform.y - et.y

    // Stomp
    if (rb.vy > 50 && dy < 0 && dy > -64 && dx < 30) {
      stomped.add(eid)
      rb.vy         = -380
      state.jumpsLeft = state.maxJumps
      const bowserHp = world.getComponent<BowserHPComponent>(eid, 'BowserHP')
      if (bowserHp) {
        bowserHp.hp -= 1
        if (bowserHp.hp <= 0) { world.destroyEntity(eid); gameEvents.onGoalReached?.() }
      } else {
        world.destroyEntity(eid)
        gameEvents.onEnemyKill?.(100)
      }
      continue
    }

    // Star kill — touch while starman active
    if (playerConfig.isStarActive && dx < 34 && Math.abs(dy) < 50) {
      stomped.add(eid)
      const bowserHp = world.getComponent<BowserHPComponent>(eid, 'BowserHP')
      if (bowserHp) {
        bowserHp.hp -= 1
        if (bowserHp.hp <= 0) { world.destroyEntity(eid); gameEvents.onGoalReached?.() }
      } else {
        world.destroyEntity(eid)
        gameEvents.onEnemyKill?.(200)
      }
      continue
    }

    // Hurt
    if (!state.isInvincible && !playerConfig.isStarActive && !stomped.has(eid) && dx < 30 && Math.abs(dy) < 46) {
      state.isInvincible    = true
      state.invincibleTimer = INVINCIBLE_DUR
      state.flashTimer      = 0.1
      const pushDir = transform.x >= et.x ? 1 : -1
      transform.x  += pushDir * 32
      rb.vx         = pushDir * KNOCKBACK_X
      rb.vy         = KNOCKBACK_Y
      gameEvents.onPlayerHurt?.()
    }
  }

  // ── Fall respawn ──────────────────────────────────────────────────────────
  if (transform.y > 700) {
    transform.x = playerConfig.spawnX
    transform.y = playerConfig.spawnY
    rb.vx = 0
    rb.vy = 0
    if (!state.isInvincible) {
      state.isInvincible    = true
      state.invincibleTimer = INVINCIBLE_DUR
      state.flashTimer      = 0.1
      gameEvents.onPlayerHurt?.()
    }
  }
}

export function Player({ x = 80, y = 420 }: { x?: number; y?: number }) {
  return (
    <Entity id="player" tags={['player']}>
      <Transform x={x} y={y} />
      <Sprite
        src="/ClassicNES_SMB_Small_Mario_Sprite.png"
        width={28}
        height={SMALL_H}
        color="#e53935"
        zIndex={10}
      />
      <RigidBody friction={0.7} />
      <BoxCollider width={26} height={SMALL_H} />
      <Script init={(id) => playerInit(id)} update={playerUpdate} />
    </Entity>
  )
}
