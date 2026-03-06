import { Entity, Transform, Sprite, Script } from '@cubeforge/react'
import type { EntityId, ECSWorld } from '@cubeforge/react'
import type { Component } from '@cubeforge/core'

export interface BrickMeta extends Component {
  readonly type: 'BrickMeta'
  onHit: (id: EntityId) => void
  score: number
}

// No-op update — brick is fully passive; ball script handles collision
function brickUpdate(id: EntityId, world: ECSWorld) {
  if (!world.hasEntity(id)) return
}

interface BrickProps {
  x: number
  y: number
  width: number
  height: number
  color: string
  score: number
  onHit: (id: EntityId) => void
}

export function Brick({ x, y, width, height, color, score, onHit }: BrickProps) {
  return (
    <Entity tags={['brick']}>
      <Transform x={x} y={y} />
      <Sprite width={width} height={height} color={color} zIndex={5} />
      <Script
        init={(id, world) => {
          world.addComponent(id, {
            type:  'BrickMeta',
            onHit: onHit,
            score: score,
          } as BrickMeta)
        }}
        update={brickUpdate}
      />
    </Entity>
  )
}
