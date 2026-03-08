import { useRef } from 'react'
import { Entity, Transform, Sprite, BoxCollider, Script, findByTag } from '@cubeforge/react'
import type { EntityId, ECSWorld, TransformComponent } from '@cubeforge/react'
import { gameEvents } from '../gameEvents'

let collected = new Set<EntityId>()

function starPickupCheck(id: EntityId, world: ECSWorld) {
  if (!world.hasEntity(id)) return
  if (collected.has(id)) return
  const st = world.getComponent<TransformComponent>(id, 'Transform')
  if (!st) return
  for (const pid of findByTag(world, 'player')) {
    const pt = world.getComponent<TransformComponent>(pid, 'Transform')
    if (!pt) continue
    if (Math.abs(st.x - pt.x) < 16 && Math.abs(st.y - pt.y) < 16) {
      collected.add(id)
      gameEvents.onStar?.()
      world.destroyEntity(id)
      return
    }
  }
}

export function StarItem({ x, y }: { x: number; y: number }) {
  const timer = useRef(0)

  return (
    <Entity tags={['star']}>
      <Transform x={x} y={y} />
      <Sprite src="/Starman.gif" width={16} height={16} color="#ffd600" zIndex={5} />
      <BoxCollider width={16} height={16} />
      <Script
        update={(id: EntityId, world: ECSWorld, _i: unknown, dt: number) => {
          timer.current += dt
          const t = world.getComponent<TransformComponent>(id, 'Transform')
          if (t) t.y = y + Math.sin(timer.current * 4) * 5
          starPickupCheck(id, world)
        }}
      />
    </Entity>
  )
}
