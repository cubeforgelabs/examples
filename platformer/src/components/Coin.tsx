import { useRef } from 'react'
import { Entity, Transform, Sprite, BoxCollider, Script, useTriggerEnter, useEntity } from '@cubeforge/react'
import type { EntityId, ECSWorld, TransformComponent } from '@cubeforge/react'

/** Collects the coin when a player-tagged entity enters its trigger. */
function CoinCollector({ onCollect }: { onCollect?: (id: EntityId) => void }) {
  const entityId = useEntity()
  const collected = useRef(false)

  useTriggerEnter(() => {
    if (collected.current) return
    collected.current = true
    onCollect?.(entityId)
  }, { tag: 'player' })

  return null
}

interface CoinProps {
  x: number
  y: number
  onCollect?: (id: EntityId) => void
}

export function Coin({ x, y, onCollect }: CoinProps) {
  const timer = useRef(Math.random() * Math.PI * 2)

  return (
    <Entity tags={['coin']}>
      <Transform x={x} y={y} />
      <Sprite src="/coin.png" width={16} height={16} color="#ffd54f" zIndex={5} />
      <BoxCollider width={16} height={16} isTrigger />
      <Script
        update={(_id: EntityId, world: ECSWorld, _input: unknown, dt: number) => {
          timer.current += dt
          const t = world.getComponent<TransformComponent>(_id, 'Transform')
          if (t) t.y = y + Math.sin(timer.current * 3) * 6
        }}
      />
      <CoinCollector onCollect={onCollect} />
    </Entity>
  )
}
