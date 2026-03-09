import { Entity, Transform, AnimatedSprite, Animator, RigidBody, BoxCollider, Script } from '@cubeforge/react'
import { defineAnimations, findByTag } from '@cubeforge/react'
import type { EntityId, ECSWorld, TransformComponent, RigidBodyComponent, SpriteComponent } from '@cubeforge/react'

const slimeAnims = defineAnimations({
  walk: { frames: [0, 1, 2, 3, 4, 5, 6, 7, 8, 9], fps: 8 },
})

const slimeAnimatorStates = {
  walk: { clip: 'walk' },
}

interface EnemyState {
  direction:  1 | -1
  leftBound:  number
  rightBound: number
  speed:      number
}

const enemyStates = new Map<EntityId, EnemyState>()

function enemyInit(id: EntityId, left: number, right: number, speed: number) {
  enemyStates.set(id, { direction: 1, leftBound: left, rightBound: right, speed })
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

  // Reverse direction when another enemy is directly ahead (prevents stacking)
  for (const other of findByTag(world, 'enemy')) {
    if (other === id || !world.hasEntity(other)) continue
    const ot = world.getComponent<TransformComponent>(other, 'Transform')
    if (!ot) continue
    const dx = transform.x - ot.x
    const dy = Math.abs(transform.y - ot.y)
    if (dy < 20 && Math.abs(dx) < 42) {
      state.direction = dx > 0 ? 1 : -1
    }
  }

  rb.vx        = state.speed * state.direction
  sprite.flipX = state.direction === -1
}

interface EnemyProps {
  x?:           number
  y?:           number
  patrolLeft?:  number
  patrolRight?: number
  speed?:       number
  color?:       string
}

export function Enemy({ x = 400, y = 440, patrolLeft, patrolRight, speed = 80, color = '#ef5350' }: EnemyProps) {
  const left  = patrolLeft  ?? x - 110
  const right = patrolRight ?? x + 110

  return (
    <Entity tags={['enemy']}>
      <Transform x={x} y={y} />
      <AnimatedSprite
        src="/slime_sheet.png"
        frameWidth={36} frameHeight={32} frameColumns={10}
        width={36} height={32}
        color={color}
        zIndex={10}
        animations={slimeAnims}
        current="walk"
      />
      <Animator initial="walk" states={slimeAnimatorStates} />
      <RigidBody friction={1} />
      <BoxCollider width={26} height={34} />
      <Script
        init={(id) => enemyInit(id, left, right, speed)}
        update={(id: EntityId, world: ECSWorld) => enemyUpdate(id, world)}
      />
    </Entity>
  )
}
