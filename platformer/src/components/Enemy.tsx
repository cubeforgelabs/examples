import { Entity, Transform, Sprite, RigidBody, BoxCollider, Script } from '@cubeforge/react'
import type { EntityId, ECSWorld, TransformComponent, RigidBodyComponent, SpriteComponent } from '@cubeforge/react'

interface EnemyState {
  direction:  1 | -1
  leftBound:  number
  rightBound: number
}

const enemyStates = new Map<EntityId, EnemyState>()

function enemyInit(id: EntityId, left: number, right: number) {
  enemyStates.set(id, { direction: 1, leftBound: left, rightBound: right })
}

function enemyUpdate(id: EntityId, world: ECSWorld) {
  if (!world.hasEntity(id)) return
  const state = enemyStates.get(id)
  if (!state) return

  const transform = world.getComponent<TransformComponent>(id, 'Transform')!
  const rb        = world.getComponent<RigidBodyComponent>(id, 'RigidBody')!
  const sprite    = world.getComponent<SpriteComponent>(id, 'Sprite')!

  if (transform.x >= state.rightBound) state.direction = -1
  if (transform.x <= state.leftBound)  state.direction =  1

  rb.vx         = 80 * state.direction
  sprite.flipX  = state.direction === -1
}

interface EnemyProps {
  x?:          number
  y?:          number
  patrolLeft?: number
  patrolRight?: number
  speed?:      number
}

export function Enemy({ x = 400, y = 440, patrolLeft, patrolRight }: EnemyProps) {
  const left  = patrolLeft  ?? x - 110
  const right = patrolRight ?? x + 110

  return (
    <Entity tags={['enemy']}>
      <Transform x={x} y={y} />
      <Sprite src="/enemy.png" width={28} height={34} color="#ef5350" zIndex={10} />
      <RigidBody friction={1} />
      <BoxCollider width={26} height={34} />
      <Script
        init={(id) => enemyInit(id, left, right)}
        update={(id: EntityId, world: ECSWorld) => enemyUpdate(id, world)}
      />
    </Entity>
  )
}
