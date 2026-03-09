import { Entity, Transform, Sprite, RigidBody, BoxCollider, Script } from '@cubeforge/react'
import { findByTag } from '@cubeforge/react'
import type { EntityId, ECSWorld, TransformComponent, RigidBodyComponent, SpriteComponent } from '@cubeforge/react'

interface ChaserState {
  direction:  1 | -1
  leftBound:  number
  rightBound: number
  speed:      number
  chaseSpeed: number
}

const chaserStates = new Map<EntityId, ChaserState>()

function chaserInit(id: EntityId, left: number, right: number, speed: number) {
  chaserStates.set(id, {
    direction:  1,
    leftBound:  left,
    rightBound: right,
    speed,
    chaseSpeed: Math.round(speed * 2.2),
  })
}

const DETECT_RANGE = 220

function chaserUpdate(id: EntityId, world: ECSWorld) {
  if (!world.hasEntity(id)) return
  const state = chaserStates.get(id)
  if (!state) return

  const transform = world.getComponent<TransformComponent>(id, 'Transform')!
  const rb        = world.getComponent<RigidBodyComponent>(id, 'RigidBody')!
  const sprite    = world.getComponent<SpriteComponent>(id, 'Sprite')!

  // Patrol default
  if (transform.x >= state.rightBound) state.direction = -1
  if (transform.x <= state.leftBound)  state.direction =  1
  let vx = state.speed * state.direction

  // Chase if player is within range
  for (const pid of findByTag(world, 'player')) {
    if (!world.hasEntity(pid)) continue
    const pt = world.getComponent<TransformComponent>(pid, 'Transform')
    if (!pt) continue
    const dx = pt.x - transform.x
    if (Math.abs(dx) < DETECT_RANGE) {
      state.direction = dx > 0 ? 1 : -1
      vx = state.chaseSpeed * state.direction
    }
    break
  }

  rb.vx        = vx
  sprite.flipX = vx < 0
}

interface ChaserEnemyProps {
  x?:           number
  y?:           number
  patrolLeft?:  number
  patrolRight?: number
  speed?:       number
  color?:       string
}

export function ChaserEnemy({ x = 400, y = 440, patrolLeft, patrolRight, speed = 60, color = '#ff1744' }: ChaserEnemyProps) {
  const left  = patrolLeft  ?? x - 110
  const right = patrolRight ?? x + 110

  return (
    <Entity tags={['enemy']}>
      <Transform x={x} y={y} />
      <Sprite
        src="/enemy.png"
        width={43} height={28}
        color={color}
        zIndex={10}
      />
      <RigidBody friction={1} />
      <BoxCollider width={38} height={24} />
      <Script
        init={(id) => chaserInit(id, left, right, speed)}
        update={(id: EntityId, world: ECSWorld) => chaserUpdate(id, world)}
      />
    </Entity>
  )
}
