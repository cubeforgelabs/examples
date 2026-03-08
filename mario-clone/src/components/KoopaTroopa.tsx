import { Entity, Transform, Sprite, RigidBody, BoxCollider, Script } from '@cubeforge/react'
import type { EntityId, ECSWorld, TransformComponent, RigidBodyComponent, SpriteComponent } from '@cubeforge/react'

interface KoopaState {
  direction:  1 | -1
  leftBound:  number
  rightBound: number
}

const koopaStates = new Map<EntityId, KoopaState>()

function koopaInit(id: EntityId, left: number, right: number) {
  koopaStates.set(id, { direction: -1, leftBound: left, rightBound: right })
}

function koopaUpdate(id: EntityId, world: ECSWorld) {
  if (!world.hasEntity(id)) return
  const state = koopaStates.get(id)
  if (!state) return

  const transform = world.getComponent<TransformComponent>(id, 'Transform')!
  const rb        = world.getComponent<RigidBodyComponent>(id, 'RigidBody')!
  const sprite    = world.getComponent<SpriteComponent>(id, 'Sprite')!

  if (transform.x >= state.rightBound) state.direction = -1
  if (transform.x <= state.leftBound)  state.direction =  1

  rb.vx        = 60 * state.direction
  sprite.flipX = state.direction === 1
}

interface KoopaProps {
  x?:           number
  y?:           number
  patrolLeft?:  number
  patrolRight?: number
  src?:         string
}

export function KoopaTroopa({ x = 400, y = 484, patrolLeft, patrolRight, src = '/SMB_Green_Koopa_Troopa_Sprite.png' }: KoopaProps) {
  const left  = patrolLeft  ?? x - 120
  const right = patrolRight ?? x + 120

  return (
    <Entity tags={['enemy']}>
      <Transform x={x} y={y} />
      <Sprite src={src} width={16} height={24} color="#388e3c" zIndex={10} />
      <RigidBody friction={1} />
      <BoxCollider width={16} height={24} mask="world" />
      <Script
        init={(id) => koopaInit(id, left, right)}
        update={(id: EntityId, world: ECSWorld) => koopaUpdate(id, world)}
      />
    </Entity>
  )
}
