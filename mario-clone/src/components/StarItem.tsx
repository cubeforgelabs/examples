import { useRef } from 'react'
import { Entity, Transform, Sprite, BoxCollider, Script, useTriggerEnter, useDestroyEntity } from '@cubeforge/react'
import type { EntityId, ECSWorld, TransformComponent } from '@cubeforge/react'
import { gameEvents } from '../gameEvents'

function StarPickup() {
  const destroy = useDestroyEntity()
  const collected = useRef(false)

  useTriggerEnter(() => {
    if (collected.current) return
    collected.current = true
    gameEvents.onStar?.()
    destroy()
  }, { tag: 'player' })

  return null
}

export function StarItem({ x, y }: { x: number; y: number }) {
  const timer = useRef(0)

  return (
    <Entity tags={['star']}>
      <Transform x={x} y={y} />
      <Sprite src="/Starman.gif" width={28} height={28} color="#ffd600" zIndex={5} />
      <BoxCollider width={24} height={24} isTrigger />
      <Script
        update={(_id: EntityId, world: ECSWorld, _i: unknown, dt: number) => {
          timer.current += dt
          const t = world.getComponent<TransformComponent>(_id, 'Transform')
          if (t) t.y = y + Math.sin(timer.current * 4) * 8
        }}
      />
      <StarPickup />
    </Entity>
  )
}
