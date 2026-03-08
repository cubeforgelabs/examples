import { useRef } from 'react'
import { Entity, Transform, Sprite, Script, findByTag } from '@cubeforge/react'
import type { EntityId, ECSWorld, TransformComponent } from '@cubeforge/react'

let collected = new Set<EntityId>()

interface CoinProps {
  x: number
  y: number
  src?: string
  onCollect?: () => void
}

export function Coin({ x, y, src = '/SMB_Sprite_Coin.png', onCollect }: CoinProps) {
  const timer = useRef(Math.random() * Math.PI * 2)
  const onCollectRef = useRef(onCollect)
  onCollectRef.current = onCollect

  return (
    <Entity tags={['coin']}>
      <Transform x={x} y={y} />
      <Sprite src={src} width={32} height={32} color="#ffd700" zIndex={5} />
      <Script
        update={(id: EntityId, world: ECSWorld, _input: unknown, dt: number) => {
          if (!world.hasEntity(id)) return
          timer.current += dt
          const t = world.getComponent<TransformComponent>(id, 'Transform')
          if (t) t.y = y + Math.sin(timer.current * 3) * 10

          if (collected.has(id)) return
          if (!t) return
          for (const pid of findByTag(world, 'player')) {
            const pt = world.getComponent<TransformComponent>(pid, 'Transform')
            if (!pt) continue
            if (Math.abs(t.x - pt.x) < 32 && Math.abs(t.y - pt.y) < 32) {
              collected.add(id)
              // Hide instead of destroy — let React unmount handle cleanup
              const sprite = world.getComponent<{ type: 'Sprite'; visible: boolean }>(id, 'Sprite')
              if (sprite) sprite.visible = false
              onCollectRef.current?.()
              return
            }
          }
        }}
      />
    </Entity>
  )
}
