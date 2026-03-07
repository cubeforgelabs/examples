import { Entity, Transform, Sprite, RigidBody, BoxCollider } from '@cubeforge/react'

interface GroundProps {
  x: number
  y: number
  width: number
  height?: number
  color?: string
  src?: string
  zIndex?: number
  tileX?: boolean
  tileY?: boolean
}

export function Ground({ x, y, width, height = 28, color = '#5a3e1b', src, zIndex = 2, tileX, tileY }: GroundProps) {
  return (
    <Entity>
      <Transform x={x} y={y} />
      <Sprite width={width} height={height} color={color} src={src} zIndex={zIndex} tileX={tileX} tileY={tileY} />
      <RigidBody isStatic />
      <BoxCollider width={width} height={height} />
    </Entity>
  )
}
