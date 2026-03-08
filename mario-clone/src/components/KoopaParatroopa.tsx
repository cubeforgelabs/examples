import { Entity, Transform, Sprite, RigidBody, BoxCollider, Script } from '@cubeforge/react'
import type { EntityId, ECSWorld, TransformComponent, RigidBodyComponent, SpriteComponent } from '@cubeforge/react'

interface ParatroopaState {
  direction:  1 | -1
  leftBound:  number
  rightBound: number
  hopTimer:   number
}

const paraTroopaStates = new Map<EntityId, ParatroopaState>()

function paraTroopaUpdate(id: EntityId, world: ECSWorld, _input: unknown, dt: number) {
  if (!world.hasEntity(id)) return
  const state = paraTroopaStates.get(id)
  if (!state) return

  const transform = world.getComponent<TransformComponent>(id, 'Transform')!
  const rb        = world.getComponent<RigidBodyComponent>(id, 'RigidBody')!
  const sprite    = world.getComponent<SpriteComponent>(id, 'Sprite')!

  if (transform.x >= state.rightBound) state.direction = -1
  if (transform.x <= state.leftBound)  state.direction =  1

  rb.vx        = 65 * state.direction
  sprite.flipX = state.direction === -1

  // Periodic hops
  state.hopTimer -= dt
  if (state.hopTimer <= 0 && rb.onGround) {
    rb.vy          = -360
    state.hopTimer = 1.2
  }
}

interface KoopaParatroopaProps {
  x?:           number
  y?:           number
  patrolLeft?:  number
  patrolRight?: number
  src?:         string
}

export function KoopaParatroopa({
  x = 400, y = 484,
  patrolLeft, patrolRight,
  src = '/KoopaParatroopaGreenDark.gif',
}: KoopaParatroopaProps) {
  const left  = patrolLeft  ?? x - 100
  const right = patrolRight ?? x + 100

  return (
    <Entity tags={['enemy']}>
      <Transform x={x} y={y} />
      <Sprite src={src} width={16} height={24} color="#388e3c" zIndex={10} />
      <RigidBody friction={1} />
      <BoxCollider width={16} height={24} mask="world" />
      <Script
        init={(id) => paraTroopaStates.set(id, { direction: 1, leftBound: left, rightBound: right, hopTimer: 0.8 })}
        update={(id: EntityId, world: ECSWorld, input: unknown, dt: number) => paraTroopaUpdate(id, world, input, dt)}
      />
    </Entity>
  )
}
