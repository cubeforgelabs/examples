import { Entity, Transform, Sprite, RigidBody, BoxCollider, Script, findByTag } from '@cubeforge/react'
import type { EntityId, ECSWorld, TransformComponent, RigidBodyComponent } from '@cubeforge/react'
import { gameEvents } from '../gameEvents'

let collected = new Set<EntityId>()

function oneUpUpdate(id: EntityId, world: ECSWorld) {
  if (!world.hasEntity(id)) return
  const rb = world.getComponent<RigidBodyComponent>(id, 'RigidBody')
  if (rb) rb.vx = -80

  if (collected.has(id)) return
  const mt = world.getComponent<TransformComponent>(id, 'Transform')
  if (!mt) return
  for (const pid of findByTag(world, 'player')) {
    const pt = world.getComponent<TransformComponent>(pid, 'Transform')
    if (!pt) continue
    if (Math.abs(mt.x - pt.x) < 16 && Math.abs(mt.y - pt.y) < 16) {
      collected.add(id)
      gameEvents.onOneUp?.()
      world.destroyEntity(id)
      return
    }
  }
}

export function OneUpMushroom({ x, y }: { x: number; y: number }) {
  return (
    <Entity tags={['oneUp']}>
      <Transform x={x} y={y} />
      <Sprite src="/SMB_Sprite_1UP.png" width={16} height={16} color="#4caf50" zIndex={5} />
      <RigidBody />
      <BoxCollider width={16} height={16} mask="world" />
      <Script update={oneUpUpdate} />
    </Entity>
  )
}
