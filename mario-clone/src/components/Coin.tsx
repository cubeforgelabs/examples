import { Entity, Transform, Sprite, BoxCollider, Script } from '@cubeforge/react'
import type { EntityId, ECSWorld, TransformComponent } from '@cubeforge/react'
import type { Component } from '@cubeforge/core'

interface CoinMeta extends Component {
  readonly type: 'CoinMeta'
  onCollect: (id: EntityId) => void
  baseY:  number
  timer:  number
}

function coinUpdate(id: EntityId, world: ECSWorld, _input: unknown, dt: number) {
  if (!world.hasEntity(id)) return

  const meta = world.getComponent<CoinMeta>(id, 'CoinMeta')
  if (!meta) return

  // Bob up and down
  meta.timer += dt
  const transform = world.getComponent<TransformComponent>(id, 'Transform')
  if (transform) transform.y = meta.baseY + Math.sin(meta.timer * 3) * 6

  // Proximity collect
  for (const pid of world.query('Tag')) {
    const tag = world.getComponent<{ type: 'Tag'; tags: string[] }>(pid, 'Tag')
    if (!tag?.tags.includes('player')) continue

    const pt = world.getComponent<TransformComponent>(pid, 'Transform')
    const ct = transform
    if (!pt || !ct) continue

    const dx = pt.x - ct.x
    const dy = pt.y - ct.y
    if (dx * dx + dy * dy < 900) {
      meta.onCollect(id)
      world.destroyEntity(id)
      return
    }
  }
}

interface CoinProps {
  x: number
  y: number
  onCollect?: (id: EntityId) => void
}

export function Coin({ x, y, onCollect }: CoinProps) {
  return (
    <Entity tags={['coin']}>
      <Transform x={x} y={y} />
      <Sprite width={16} height={16} color="#ffd700" zIndex={5} />
      <BoxCollider width={16} height={16} isTrigger />
      <Script
        init={(id, world) => {
          world.addComponent(id, {
            type:      'CoinMeta',
            onCollect: onCollect ?? (() => {}),
            baseY:     y,
            timer:     Math.random() * Math.PI * 2,
          } as CoinMeta)
        }}
        update={coinUpdate}
      />
    </Entity>
  )
}
