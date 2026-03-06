import { Entity, Transform, Sprite, RigidBody, BoxCollider, Script } from '@cubeforge/react'
import type { EntityId, ECSWorld, TransformComponent, RigidBodyComponent, SpriteComponent } from '@cubeforge/react'

interface GoombaState {
  direction:  1 | -1
  leftBound:  number
  rightBound: number
}

const goombaStates = new Map<EntityId, GoombaState>()

function goombaInit(id: EntityId, left: number, right: number) {
  goombaStates.set(id, { direction: 1, leftBound: left, rightBound: right })
}

function goombaUpdate(id: EntityId, world: ECSWorld) {
  if (!world.hasEntity(id)) return
  const state = goombaStates.get(id)
  if (!state) return

  const transform = world.getComponent<TransformComponent>(id, 'Transform')!
  const rb        = world.getComponent<RigidBodyComponent>(id, 'RigidBody')!
  const sprite    = world.getComponent<SpriteComponent>(id, 'Sprite')!

  if (transform.x >= state.rightBound) state.direction = -1
  if (transform.x <= state.leftBound)  state.direction =  1

  rb.vx        = 80 * state.direction
  sprite.flipX = state.direction === -1
}

interface GoombaProps {
  x?:           number
  y?:           number
  patrolLeft?:  number
  patrolRight?: number
}

export function Goomba({ x = 400, y = 465, patrolLeft, patrolRight }: GoombaProps) {
  const left  = patrolLeft  ?? x - 110
  const right = patrolRight ?? x + 110

  return (
    <Entity tags={['enemy']}>
      <Transform x={x} y={y} />
      <Sprite width={26} height={26} color="#8b4513" zIndex={10} />
      <RigidBody friction={1} />
      <BoxCollider width={26} height={26} />
      <Script
        init={(id) => goombaInit(id, left, right)}
        update={(id: EntityId, world: ECSWorld) => goombaUpdate(id, world)}
      />
    </Entity>
  )
}
