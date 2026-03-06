import { Entity, Transform, Sprite, BoxCollider, Script } from '@cubeforge/react'
import type { EntityId, ECSWorld, TransformComponent } from '@cubeforge/react'
import { gameEvents } from '../gameEvents'

interface ExitProps {
  x: number
  y: number
  keysCollected: number
  totalKeys: number
}

function makeExitUpdate(keysCollectedRef: { value: number }, totalKeys: number) {
  return function exitUpdate(id: EntityId, world: ECSWorld) {
    if (!world.hasEntity(id)) return

    const transform = world.getComponent<TransformComponent>(id, 'Transform')
    if (!transform) return

    for (const pid of world.query('Tag')) {
      const tag = world.getComponent<{ type: 'Tag'; tags: string[] }>(pid, 'Tag')
      if (!tag?.tags.includes('player')) continue

      const pt = world.getComponent<TransformComponent>(pid, 'Transform')
      if (!pt) continue

      const dx = pt.x - transform.x
      const dy = pt.y - transform.y
      const dist = Math.sqrt(dx * dx + dy * dy)
      if (dist < 24 && keysCollectedRef.value >= totalKeys) {
        gameEvents.onExitReached?.()
      }
    }
  }
}

export function Exit({ x, y, keysCollected, totalKeys }: ExitProps) {
  // Use a ref-like object so the update closure always reads latest value
  const keysCollectedRef = { value: keysCollected }
  keysCollectedRef.value = keysCollected

  const exitUpdate = makeExitUpdate(keysCollectedRef, totalKeys)

  return (
    <Entity tags={['exit']}>
      <Transform x={x} y={y} />
      <Sprite width={36} height={48} color="#4fc3f7" zIndex={3} />
      <BoxCollider width={36} height={48} isTrigger />
      <Script update={exitUpdate} />
    </Entity>
  )
}
