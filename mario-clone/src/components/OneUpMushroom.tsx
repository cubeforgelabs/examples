import { useRef } from 'react'
import { Entity, Transform, Sprite, RigidBody, BoxCollider, Script, useCollisionEnter, useDestroyEntity } from '@cubeforge/react'
import type { EntityId, ECSWorld, RigidBodyComponent } from '@cubeforge/react'
import { gameEvents } from '../gameEvents'

function OneUpPickup() {
  const destroy = useDestroyEntity()
  const collected = useRef(false)

  useCollisionEnter(() => {
    if (collected.current) return
    collected.current = true
    gameEvents.onOneUp?.()
    destroy()
  }, { tag: 'player' })

  return null
}

export function OneUpMushroom({ x, y }: { x: number; y: number }) {
  return (
    <Entity tags={['oneUp']}>
      <Transform x={x} y={y} />
      <Sprite src="/SMB_Sprite_1UP.png" width={28} height={28} color="#4caf50" zIndex={5} />
      <RigidBody />
      <BoxCollider width={28} height={28} />
      <Script
        update={(id: EntityId, world: ECSWorld) => {
          if (!world.hasEntity(id)) return
          const rb = world.getComponent<RigidBodyComponent>(id, 'RigidBody')
          if (rb) rb.vx = -80
        }}
      />
      <OneUpPickup />
    </Entity>
  )
}
