import { Entity, Transform, Sprite, RigidBody, BoxCollider } from '@cubeforge/react'

interface GroundProps {
  x: number
  y: number
  width: number
  height?: number
  color?: string
  src?: string
  tileX?: boolean
  tileSizeX?: number
  tileSizeY?: number
  /** Jump-through platform: passable from below, solid from above */
  oneWay?: boolean
}

export function Ground({ x, y, width, height = 24, color = '#546e7a', src = '/ground_cave.png', tileX = true, tileSizeX = 18, tileSizeY = 18, oneWay = false }: GroundProps) {
  return (
    <Entity tags={['ground', 'solid']}>
      <Transform x={x} y={y} />
      <Sprite width={width} height={height} color={color} src={src} tileX={tileX} tileSizeX={tileSizeX} tileSizeY={tileSizeY} zIndex={1} />
      <RigidBody isStatic={true} />
      <BoxCollider width={width} height={height} oneWay={oneWay} />
    </Entity>
  )
}
