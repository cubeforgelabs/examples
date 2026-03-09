import { Entity, Transform, AnimatedSprite, Animator, RigidBody, BoxCollider, Script } from '@cubeforge/react'
import { defineAnimations } from '@cubeforge/react'
import type { EntityId, ECSWorld, TransformComponent, RigidBodyComponent } from '@cubeforge/react'
import type { InputManager } from '@cubeforge/react'

// ─── Constants ────────────────────────────────────────────────────────────────
export const PLAYER_X  = 120
export const PLAYER_W  = 32
export const PLAYER_H  = 44
const PLAYER_SPRITE_H = 48
const JUMP_VEL  = -430
const GROUND_Y  = 326

// ─── State ────────────────────────────────────────────────────────────────────
interface PlayerState { canJump: boolean; jumpBufferTimer: number }
const states = new Map<EntityId, PlayerState>()

const playerAnims = defineAnimations({
  run: { frames: [0, 1, 2, 3, 4, 5, 6, 7, 8], fps: 14 },
})

// ─── Script ───────────────────────────────────────────────────────────────────
function playerInit(id: EntityId) {
  states.set(id, { canJump: false, jumpBufferTimer: 0 })
}

function playerUpdate(id: EntityId, world: ECSWorld, input: InputManager, dt: number) {
  if (!world.hasEntity(id)) return
  const state = states.get(id)
  if (!state) return

  const transform = world.getComponent<TransformComponent>(id, 'Transform')
  const rb        = world.getComponent<RigidBodyComponent>(id, 'RigidBody')
  if (!transform || !rb) return

  // Grounded = near ground level and not moving upward significantly
  const grounded = transform.y >= GROUND_Y - 4 && rb.vy >= -30

  // Jump buffer: accept jump input slightly early
  if (input.isPressed('Space') || input.isPressed('ArrowUp') || input.isPressed('KeyW')) {
    state.jumpBufferTimer = 0.12
  }
  if (state.jumpBufferTimer > 0) state.jumpBufferTimer -= dt

  if (state.jumpBufferTimer > 0 && grounded) {
    rb.vy = JUMP_VEL
    state.jumpBufferTimer = 0
  }

  state.canJump = grounded
}

// ─── Component ────────────────────────────────────────────────────────────────
interface PlayerProps { x: number; y: number }
export function Player({ x, y }: PlayerProps) {
  return (
    <Entity id="runner-player" tags={['player']}>
      <Transform x={x} y={y} />
      <AnimatedSprite
        src="/runner.png"
        width={PLAYER_W}
        height={PLAYER_SPRITE_H}
        frameWidth={32}
        frameHeight={48}
        frameColumns={9}
        color="#4fc3f7"
        zIndex={10}
        animations={playerAnims}
        current="run"
      />
      <Animator initial="run" states={{ run: { clip: 'run' } }} />
      <RigidBody friction={0.0} lockX />
      <BoxCollider width={PLAYER_W - 6} height={PLAYER_H} />
      <Script init={playerInit} update={playerUpdate} />
    </Entity>
  )
}
