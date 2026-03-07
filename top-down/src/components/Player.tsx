import { Entity, Transform, Sprite, RigidBody, BoxCollider, Script } from '@cubeforge/react'
import { createInputMap } from '@cubeforge/react'
import type {
  EntityId,
  ECSWorld,
  TransformComponent,
  RigidBodyComponent,
  SpriteComponent,
} from '@cubeforge/react'
import type { InputManager } from '@cubeforge/react'

const actions = createInputMap({
  up:     ['ArrowUp',    'KeyW', 'w'],
  down:   ['ArrowDown',  'KeyS', 's'],
  left:   ['ArrowLeft',  'KeyA', 'a'],
  right:  ['ArrowRight', 'KeyD', 'd'],
  attack: 'Space',
})
import { createTransform } from '@cubeforge/core'
import { createSprite } from '@cubeforge/renderer'
import { createTag } from '@cubeforge/core'
import { gameEvents } from '../gameEvents'

const SPEED          = 160
const INVINCIBLE_DUR = 1.5
const SWORD_DUR      = 0.2
const SWORD_OFFSET   = 32

type Facing = 'up' | 'down' | 'left' | 'right'

interface PlayerState {
  facing:          Facing
  swordTimer:      number
  swordId:         EntityId | null
  isInvincible:    boolean
  invincibleTimer: number
  flashTimer:      number
}

const playerStates = new Map<EntityId, PlayerState>()

function playerInit(id: EntityId) {
  playerStates.set(id, {
    facing:          'down',
    swordTimer:      0,
    swordId:         null,
    isInvincible:    false,
    invincibleTimer: 0,
    flashTimer:      0,
  })
}

function playerUpdate(id: EntityId, world: ECSWorld, input: InputManager, dt: number) {
  if (!world.hasEntity(id)) return
  const state     = playerStates.get(id)!
  const transform = world.getComponent<TransformComponent>(id, 'Transform')!
  const rb        = world.getComponent<RigidBodyComponent>(id, 'RigidBody')!
  const sprite    = world.getComponent<SpriteComponent>(id, 'Sprite')!

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

  // ── Movement ─────────────────────────────────────────────────────────────
  const up    = actions.isActionDown(input, 'up')
  const down  = actions.isActionDown(input, 'down')
  const left  = actions.isActionDown(input, 'left')
  const right = actions.isActionDown(input, 'right')

  let vx = 0
  let vy = 0

  if (left)  { vx = -SPEED; state.facing = 'left'  }
  if (right) { vx =  SPEED; state.facing = 'right' }
  if (up)    { vy = -SPEED; state.facing = 'up'    }
  if (down)  { vy =  SPEED; state.facing = 'down'  }

  // Normalize diagonal movement
  if (vx !== 0 && vy !== 0) {
    const norm = 1 / Math.SQRT2
    vx *= norm
    vy *= norm
  }

  rb.vx = vx
  rb.vy = vy

  // Flip sprite when facing left
  sprite.flipX = state.facing === 'left'

  // ── Sword attack ─────────────────────────────────────────────────────────
  if (state.swordTimer > 0) {
    state.swordTimer -= dt

    // Move sword with player
    if (state.swordId !== null && world.hasEntity(state.swordId)) {
      const swordT = world.getComponent<TransformComponent>(state.swordId, 'Transform')
      if (swordT) {
        const [ox, oy] = swordOffset(state.facing)
        swordT.x = transform.x + ox
        swordT.y = transform.y + oy
      }
    }

    // Expire sword
    if (state.swordTimer <= 0) {
      if (state.swordId !== null && world.hasEntity(state.swordId)) {
        world.destroyEntity(state.swordId)
      }
      state.swordId = null
    }
  } else {
    // Check for attack input
    const attack = actions.isActionPressed(input, 'attack')
    if (attack && state.swordId === null) {
      const [ox, oy] = swordOffset(state.facing)
      const swordId = world.createEntity()
      world.addComponent(swordId, createTransform(transform.x + ox, transform.y + oy))
      world.addComponent(swordId, createSprite({ width: 20, height: 20, color: '#e0e0e0', zIndex: 11 }))
      world.addComponent(swordId, createTag('sword'))
      state.swordId    = swordId
      state.swordTimer = SWORD_DUR
    }
  }

  // ── Bounds clamp ─────────────────────────────────────────────────────────
  transform.x = Math.max(0, Math.min(1200, transform.x))
  transform.y = Math.max(0, Math.min(900,  transform.y))
}

function swordOffset(facing: Facing): [number, number] {
  switch (facing) {
    case 'up':    return [0, -SWORD_OFFSET]
    case 'down':  return [0,  SWORD_OFFSET]
    case 'left':  return [-SWORD_OFFSET, 0]
    case 'right': return [ SWORD_OFFSET, 0]
  }
}

// Called from App when player takes a hit (to trigger invincibility)
export function triggerPlayerInvincible(id: EntityId, world: ECSWorld) {
  const state = playerStates.get(id)
  if (!state || state.isInvincible) return
  state.isInvincible    = true
  state.invincibleTimer = INVINCIBLE_DUR
  state.flashTimer      = 0.1
  // Also fire event in case it wasn't done by the caller
  gameEvents.onPlayerHit?.()

  // Destroy sword if active
  if (state.swordId !== null && world.hasEntity(state.swordId)) {
    world.destroyEntity(state.swordId)
    state.swordId    = null
    state.swordTimer = 0
  }
}

interface PlayerProps {
  x?: number
  y?: number
}

export function Player({ x = 100, y = 100 }: PlayerProps) {
  return (
    <Entity id="player" tags={['player']}>
      <Transform x={x} y={y} />
      <Sprite width={24} height={32} color="#4fc3f7" zIndex={10} />
      <RigidBody gravityScale={0} friction={0} />
      <BoxCollider width={22} height={30} />
      <Script
        init={(id) => playerInit(id)}
        update={playerUpdate}
      />
    </Entity>
  )
}
