import { Entity, Transform, Sprite, RigidBody, BoxCollider, Script } from '@cubeforge/react'
import { createInputMap, findByTag } from '@cubeforge/react'
import type { EntityId, ECSWorld, TransformComponent, RigidBodyComponent, SpriteComponent } from '@cubeforge/react'
import type { InputManager } from '@cubeforge/react'
import { gameCallbacks } from '../gameEvents'

const SPEED          = 230
const JUMP_FORCE     = -540
const MAX_JUMPS      = 2
const COYOTE_TIME    = 0.1
const JUMP_BUFFER    = 0.09
const INVINCIBLE_DUR = 2.0
const KNOCKBACK_X    = 260
const KNOCKBACK_Y    = -300

const actions = createInputMap({
  left:  ['ArrowLeft', 'KeyA', 'a'],
  right: ['ArrowRight', 'KeyD', 'd'],
  jump:  ['Space', 'ArrowUp', 'KeyW', 'w'],
})

interface PlayerState {
  coyoteTimer:     number
  jumpBuffer:      number
  jumpCooldown:    number
  jumpsLeft:       number
  facingRight:     boolean
  isInvincible:    boolean
  invincibleTimer: number
  flashTimer:      number
}

const playerStates = new Map<EntityId, PlayerState>()

function playerInit(id: EntityId) {
  playerStates.set(id, {
    coyoteTimer:     0,
    jumpBuffer:      0,
    jumpCooldown:    0,
    jumpsLeft:       MAX_JUMPS,
    facingRight:     true,
    isInvincible:    false,
    invincibleTimer: 0,
    flashTimer:      0,
  })
}

function playerUpdate(id: EntityId, world: ECSWorld, input: InputManager, dt: number) {
  if (!world.hasEntity(id)) return
  const transform = world.getComponent<TransformComponent>(id, 'Transform')!
  const rb        = world.getComponent<RigidBodyComponent>(id, 'RigidBody')!
  const sprite    = world.getComponent<SpriteComponent>(id, 'Sprite')!
  const state     = playerStates.get(id)!

  // ── Invincibility flash ───────────────────────────────────────────────────
  if (state.isInvincible) {
    state.invincibleTimer -= dt
    state.flashTimer      -= dt
    if (state.flashTimer <= 0) {
      sprite.visible  = !sprite.visible
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
    state.jumpsLeft   = MAX_JUMPS
  } else {
    state.coyoteTimer = Math.max(0, state.coyoteTimer - dt)
  }

  // ── Jump cooldown (prevents spam-jumping) ────────────────────────────────
  state.jumpCooldown = Math.max(0, state.jumpCooldown - dt)

  // ── Jump buffer ───────────────────────────────────────────────────────────
  if (actions.isActionPressed(input, 'jump') && state.jumpCooldown === 0) state.jumpBuffer = JUMP_BUFFER
  else if (!actions.isActionPressed(input, 'jump'))                        state.jumpBuffer = Math.max(0, state.jumpBuffer - dt)

  // ── Horizontal movement ───────────────────────────────────────────────────
  const left  = actions.isActionDown(input, 'left')
  const right = actions.isActionDown(input, 'right')
  if (left)       { rb.vx = -SPEED; state.facingRight = false }
  else if (right) { rb.vx =  SPEED; state.facingRight = true  }
  else              rb.vx *= rb.onGround ? 0.65 : 0.95
  sprite.flipX = !state.facingRight

  // ── Jump (coyote + double jump) ───────────────────────────────────────────
  const canJump = state.coyoteTimer > 0 || state.jumpsLeft > 0
  if (state.jumpBuffer > 0 && canJump) {
    rb.vy              = JUMP_FORCE
    state.jumpsLeft    = Math.max(0, state.jumpsLeft - 1)
    state.coyoteTimer  = 0
    state.jumpBuffer   = 0
    state.jumpCooldown = 0.22
  }

  // Variable jump height — release early to cut arc short
  if (!actions.isActionDown(input, 'jump') && rb.vy < -150) rb.vy += 900 * dt

  // ── Enemy interactions ────────────────────────────────────────────────────
  const stomped = new Set<EntityId>()

  for (const eid of findByTag(world, 'enemy')) {
    if (eid === id || !world.hasEntity(eid)) continue

    const et = world.getComponent<TransformComponent>(eid, 'Transform')
    if (!et) continue

    const dx = Math.abs(transform.x - et.x)
    const dy = transform.y - et.y  // positive = player is lower than enemy

    // Stomp: player falling, center above enemy center, close horizontally
    if (rb.vy > 50 && dy < 0 && dy > -58 && dx < 30) {
      world.destroyEntity(eid)
      stomped.add(eid)
      rb.vy          = -400
      state.jumpsLeft = MAX_JUMPS
      gameCallbacks.onEnemyKill?.()
      continue
    }

    // Hurt: overlap without stomp, not invincible
    if (!state.isInvincible && !stomped.has(eid) && dx < 30 && Math.abs(dy) < 41) {
      state.isInvincible    = true
      state.invincibleTimer = INVINCIBLE_DUR
      state.flashTimer      = 0.1
      const pushDir = transform.x >= et.x ? 1 : -1
      transform.x  += pushDir * 32
      rb.vx         = pushDir * KNOCKBACK_X
      rb.vy         = KNOCKBACK_Y
      gameCallbacks.onPlayerHurt?.()
    }
  }

  // ── Fall respawn ──────────────────────────────────────────────────────────
  if (transform.y > 700) {
    transform.x = 80
    transform.y = 420
    rb.vx = 0
    rb.vy = 0
    if (!state.isInvincible) {
      state.isInvincible    = true
      state.invincibleTimer = INVINCIBLE_DUR
      state.flashTimer      = 0.1
      gameCallbacks.onPlayerHurt?.()
    }
  }
}

export function Player({ x = 80, y = 420 }: { x?: number; y?: number }) {
  return (
    <Entity id="player" tags={['player']}>
      <Transform x={x} y={y} />
      <Sprite src="/player.png" width={28} height={40} color="#4fc3f7" zIndex={10} />
      <RigidBody friction={0.7} />
      <BoxCollider width={26} height={40} />
      <Script init={(id) => playerInit(id)} update={playerUpdate} />
    </Entity>
  )
}
