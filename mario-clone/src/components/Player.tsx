import { Entity, Transform, Sprite, RigidBody, BoxCollider, Script } from '@cubeforge/react'
import type { EntityId, ECSWorld, TransformComponent, RigidBodyComponent, SpriteComponent } from '@cubeforge/react'
import type { InputManager } from '@cubeforge/react'
import { gameEvents } from '../gameEvents'

const SPEED          = 220
const JUMP_FORCE     = -530
const COYOTE_TIME    = 0.1
const JUMP_BUFFER    = 0.09
const INVINCIBLE_DUR = 2.0
const KNOCKBACK_X    = 260
const KNOCKBACK_Y    = -300

// Module-level config so App.tsx can mutate maxJumps after mushroom pickup
export const playerConfig = {
  maxJumps: 1,
}

interface PlayerState {
  coyoteTimer:     number
  jumpBuffer:      number
  jumpsLeft:       number
  maxJumps:        number
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
    jumpsLeft:       playerConfig.maxJumps,
    maxJumps:        playerConfig.maxJumps,
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

  // Sync maxJumps from config each frame (updated when mushroom collected)
  state.maxJumps = playerConfig.maxJumps

  // ── Invincibility flash ───────────────────────────────────────────────────
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

  // ── Ground state ──────────────────────────────────────────────────────────
  if (rb.onGround) {
    state.coyoteTimer = COYOTE_TIME
    state.jumpsLeft   = state.maxJumps
  } else {
    state.coyoteTimer = Math.max(0, state.coyoteTimer - dt)
  }

  // ── Jump buffer ───────────────────────────────────────────────────────────
  const jumpPressed =
    input.isPressed('Space') || input.isPressed('ArrowUp') ||
    input.isPressed('KeyW')  || input.isPressed('w')
  if (jumpPressed) state.jumpBuffer = JUMP_BUFFER
  else             state.jumpBuffer = Math.max(0, state.jumpBuffer - dt)

  // ── Horizontal movement ───────────────────────────────────────────────────
  const left  = input.isDown('ArrowLeft')  || input.isDown('KeyA') || input.isDown('a')
  const right = input.isDown('ArrowRight') || input.isDown('KeyD') || input.isDown('d')
  if (left)       { rb.vx = -SPEED; state.facingRight = false }
  else if (right) { rb.vx =  SPEED; state.facingRight = true  }
  else              rb.vx *= rb.onGround ? 0.65 : 0.95
  sprite.flipX = !state.facingRight

  // ── Jump (coyote + multi-jump) ────────────────────────────────────────────
  const canJump = state.coyoteTimer > 0 || state.jumpsLeft > 0
  if (state.jumpBuffer > 0 && canJump) {
    rb.vy             = JUMP_FORCE
    state.jumpsLeft   = Math.max(0, state.jumpsLeft - 1)
    state.coyoteTimer = 0
    state.jumpBuffer  = 0
  }

  // Variable jump height — release early to cut arc short
  const jumpHeld =
    input.isDown('Space') || input.isDown('ArrowUp') ||
    input.isDown('KeyW')  || input.isDown('w')
  if (!jumpHeld && rb.vy < -150) rb.vy += 900 * dt

  // ── Enemy interactions ────────────────────────────────────────────────────
  const stomped = new Set<EntityId>()

  for (const eid of world.query('Tag')) {
    if (eid === id || !world.hasEntity(eid)) continue
    const tag = world.getComponent<{ type: 'Tag'; tags: string[] }>(eid, 'Tag')
    if (!tag?.tags.includes('enemy')) continue

    const et = world.getComponent<TransformComponent>(eid, 'Transform')
    if (!et) continue

    const dx = Math.abs(transform.x - et.x)
    const dy = transform.y - et.y  // positive = player lower than enemy

    // Stomp: player falling, center above enemy, close horizontally
    if (rb.vy > 50 && dy < 0 && dy > -50 && dx < 26) {
      world.destroyEntity(eid)
      stomped.add(eid)
      rb.vy          = -400
      state.jumpsLeft = state.maxJumps
      gameEvents.onEnemyKill?.()
      continue
    }

    // Hurt: side contact, not invincible
    if (!state.isInvincible && !stomped.has(eid) && dx < 30 && Math.abs(dy) < 41) {
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
    transform.x = 80
    transform.y = 420
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
      <Sprite width={28} height={40} color="#e53935" zIndex={10} />
      <RigidBody friction={0.7} />
      <BoxCollider width={26} height={40} />
      <Script init={(id) => playerInit(id)} update={playerUpdate} />
    </Entity>
  )
}
