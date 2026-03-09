import { useRef } from 'react'
import { Entity, Transform, Sprite, RigidBody, BoxCollider, Script, useTriggerEnter } from '@cubeforge/react'
import type { EntityId, ECSWorld, TransformComponent } from '@cubeforge/react'

function HeartDetector({ onCollect }: { onCollect: () => void }) {
  const triggered = useRef(false)
  useTriggerEnter(() => {
    if (triggered.current) return
    triggered.current = true
    onCollect()
  }, { tag: 'player' })
  return null
}

interface HeartPickupProps {
  x: number
  y: number
  onCollect: () => void
}

export function HeartPickup({ x, y, onCollect }: HeartPickupProps) {
  const timer = useRef(Math.random() * Math.PI * 2)

  return (
    <Entity tags={['heart']}>
      <Transform x={x} y={y} />
      <Sprite src="/heart.png" width={20} height={20} zIndex={6} />
      <RigidBody isStatic />
      <BoxCollider width={20} height={20} isTrigger />
      <Script
        update={(_id: EntityId, world: ECSWorld, _input: unknown, dt: number) => {
          timer.current += dt
          const t = world.getComponent<TransformComponent>(_id, 'Transform')
          if (t) t.y = y + Math.sin(timer.current * 2.5) * 5
        }}
      />
      <HeartDetector onCollect={onCollect} />
    </Entity>
  )
}
