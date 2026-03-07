import { Entity, Transform, Sprite, RigidBody, BoxCollider, Script } from '@cubeforge/react'
import type { EntityId, ECSWorld, TransformComponent, RigidBodyComponent, SpriteComponent } from '@cubeforge/react'

interface BeetleState {
  direction:  1 | -1
  leftBound:  number
  rightBound: number
}

const beetleStates = new Map<EntityId, BeetleState>()

function beetleUpdate(id: EntityId, world: ECSWorld) {
  if (!world.hasEntity(id)) return
  const state = beetleStates.get(id)
  if (!state) return

  const transform = world.getComponent<TransformComponent>(id, 'Transform')!
  const rb        = world.getComponent<RigidBodyComponent>(id, 'RigidBody')!
  const sprite    = world.getComponent<SpriteComponent>(id, 'Sprite')!

  if (transform.x >= state.rightBound) state.direction = -1
  if (transform.x <= state.leftBound)  state.direction =  1

  rb.vx        = 55 * state.direction
  sprite.flipX = state.direction === -1
}

interface BuzzyBeetleProps {
  x?:           number
  y?:           number
  patrolLeft?:  number
  patrolRight?: number
  src?:         string
}

export function BuzzyBeetle({ x = 400, y = 465, patrolLeft, patrolRight, src = '/Buzzy_Beetle_SMB.png' }: BuzzyBeetleProps) {
  const left  = patrolLeft  ?? x - 100
  const right = patrolRight ?? x + 100

  return (
    <Entity tags={['enemy']}>
      <Transform x={x} y={y} />
      <Sprite src={src} width={30} height={30} color="#1565c0" zIndex={10} />
      <RigidBody friction={1} />
      <BoxCollider width={28} height={28} />
      <Script
        init={(id) => beetleStates.set(id, { direction: 1, leftBound: left, rightBound: right })}
        update={(id: EntityId, world: ECSWorld) => beetleUpdate(id, world)}
      />
    </Entity>
  )
}
