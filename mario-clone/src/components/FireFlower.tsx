import { Entity, Transform, Sprite, BoxCollider, Script, findByTag } from '@cubeforge/react'
import type { EntityId, ECSWorld, TransformComponent } from '@cubeforge/react'
import { gameEvents } from '../gameEvents'

let collected = new Set<EntityId>()

function fireFlowerUpdate(id: EntityId, world: ECSWorld) {
  if (!world.hasEntity(id)) return
  if (collected.has(id)) return
  const ft = world.getComponent<TransformComponent>(id, 'Transform')
  if (!ft) return
  for (const pid of findByTag(world, 'player')) {
    const pt = world.getComponent<TransformComponent>(pid, 'Transform')
    if (!pt) continue
    if (Math.abs(ft.x - pt.x) < 16 && Math.abs(ft.y - pt.y) < 16) {
      collected.add(id)
      gameEvents.onFireFlower?.()
      world.destroyEntity(id)
      return
    }
  }
}

export function FireFlower({ x, y }: { x: number; y: number }) {
  return (
    <Entity tags={['fireFlower']}>
      <Transform x={x} y={y} />
      <Sprite src="/SMB_Sprite_Fire_Flower.png" width={16} height={16} color="#ef6c00" zIndex={5} />
      <BoxCollider width={16} height={16} />
      <Script update={fireFlowerUpdate} />
    </Entity>
  )
}
