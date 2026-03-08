import { useRef } from 'react'
import { Entity, Transform, AnimatedSprite, RigidBody, BoxCollider, Script } from '@cubeforge/react'
import { createInputMap, findByTag, defineAnimations, useAnimationController } from '@cubeforge/react'
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

// ── Animation clips ───────────────────────────────────────────────────────────
// player_alt.png: 288×48, 9 frames of 32×48
//   0–3 = run left  |  4 = idle  |  5–8 = run right
type AnimState = 'idle' | 'walkLeft' | 'walkRight' | 'jump'

const playerAnims = defineAnimations({
  idle:      { frames: [4],          fps: 1  },
  walkLeft:  { frames: [0, 1, 2, 3], fps: 10 },
  walkRight: { frames: [5, 6, 7, 8], fps: 10 },
  jump:      { frames: [4],          fps: 1  },
})

// Bridge: Script.update() → React setState (keyed by EntityId)
const playerAnimSetters = new Map<EntityId, React.MutableRefObject<(s: AnimState) => void>>()

// ── Physics state ─────────────────────────────────────────────────────────────
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
  const setAnim   = playerAnimSetters.get(id)

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

  // ── Animation state ───────────────────────────────────────────────────────
  if (setAnim) {
    if (!rb.onGround)    setAnim.current('jump')
    else if (left)       setAnim.current('walkLeft')
    else if (right)      setAnim.current('walkRight')
    else                 setAnim.current('idle')
  }

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
  const { setState, animProps } = useAnimationController(playerAnims, 'idle')

  // Stable ref so Script.update() always calls the latest setState
  const setAnimRef = useRef(setState)
  setAnimRef.current = setState

  return (
    <Entity id="player" tags={['player']}>
      <Transform x={x} y={y} />
      <AnimatedSprite
        src="/player_alt.png"
        width={32} height={48}
        frameWidth={32} frameHeight={48} frameColumns={9}
        color="#4fc3f7"
        zIndex={10}
        {...animProps}
      />
      <RigidBody friction={0.7} />
      <BoxCollider width={26} height={44} />
      <Script
        init={(id) => {
          playerAnimSetters.set(id, setAnimRef)
          playerInit(id)
        }}
        update={playerUpdate}
      />
    </Entity>
  )
}
