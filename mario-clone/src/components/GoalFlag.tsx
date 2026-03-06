import { Entity, Transform, Sprite, BoxCollider, Script } from '@cubeforge/react'
import type { EntityId, ECSWorld, TransformComponent } from '@cubeforge/react'
import { gameEvents } from '../gameEvents'

function goalUpdate(id: EntityId, world: ECSWorld) {
  if (!world.hasEntity(id)) return

  const transform = world.getComponent<TransformComponent>(id, 'Transform')
  if (!transform) return

  for (const pid of world.query('Tag')) {
    const tag = world.getComponent<{ type: 'Tag'; tags: string[] }>(pid, 'Tag')
    if (!tag?.tags.includes('player')) continue

    const pt = world.getComponent<TransformComponent>(pid, 'Transform')
    if (!pt) continue

    const dx = Math.abs(pt.x - transform.x)
    const dy = Math.abs(pt.y - transform.y)
    if (dx < 30 && dy < 50) {
      gameEvents.onGoalReached?.()
      world.destroyEntity(id)
      return
    }
  }
}

interface GoalFlagProps {
  x: number
  y: number
}

export function GoalFlag({ x, y }: GoalFlagProps) {
  return (
    <Entity tags={['goalFlag']}>
      <Transform x={x} y={y} />
      <Sprite width={16} height={64} color="#4caf50" zIndex={4} />
      <BoxCollider width={16} height={64} isTrigger />
      <Script update={goalUpdate} />
    </Entity>
  )
}
