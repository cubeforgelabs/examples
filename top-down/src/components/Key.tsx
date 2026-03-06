import { Entity, Transform, Sprite, BoxCollider, Script } from '@cubeforge/react'
import type { EntityId, ECSWorld, TransformComponent } from '@cubeforge/react'
import type { Component } from '@cubeforge/core'

interface KeyMeta extends Component {
  readonly type: 'KeyMeta'
  onCollect: (id: EntityId) => void
  baseY: number
  timer: number
}

function keyUpdate(id: EntityId, world: ECSWorld, _input: unknown, dt: number) {
  if (!world.hasEntity(id)) return

  const meta = world.getComponent<KeyMeta>(id, 'KeyMeta')
  if (!meta) return

  // Bob up and down
  meta.timer += dt
  const transform = world.getComponent<TransformComponent>(id, 'Transform')
  if (transform) transform.y = meta.baseY + Math.sin(meta.timer * 3) * 5

  // Proximity collect with player (radius 20px)
  for (const pid of world.query('Tag')) {
    const tag = world.getComponent<{ type: 'Tag'; tags: string[] }>(pid, 'Tag')
    if (!tag?.tags.includes('player')) continue

    const pt = world.getComponent<TransformComponent>(pid, 'Transform')
    const ct = transform
    if (!pt || !ct) continue

    const dx = pt.x - ct.x
    const dy = pt.y - ct.y
    if (dx * dx + dy * dy < 400) { // 20px radius
      meta.onCollect(id)
      world.destroyEntity(id)
      return
    }
  }
}

interface KeyProps {
  x: number
  y: number
  onCollect?: (id: EntityId) => void
}

export function Key({ x, y, onCollect }: KeyProps) {
  return (
    <Entity tags={['key']}>
      <Transform x={x} y={y} />
      <Sprite width={18} height={18} color="#ffd54f" zIndex={5} />
      <BoxCollider width={18} height={18} isTrigger />
      <Script
        init={(id, world) => {
          world.addComponent(id, {
            type:      'KeyMeta',
            onCollect: onCollect ?? (() => {}),
            baseY:     y,
            timer:     Math.random() * Math.PI * 2,
          } as KeyMeta)
        }}
        update={keyUpdate}
      />
    </Entity>
  )
}
