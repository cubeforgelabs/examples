import { Entity, Transform, Sprite, RigidBody, BoxCollider } from '@cubeforge/react'

interface GroundProps {
  x: number
  y: number
  width: number
  height?: number
  color?: string
}

export function Ground({ x, y, width, height = 28, color = '#5a3e1b' }: GroundProps) {
  return (
    <Entity>
      <Transform x={x} y={y} />
      <Sprite width={width} height={height} color={color} zIndex={2} />
      <RigidBody isStatic />
      <BoxCollider width={width} height={height} />
    </Entity>
  )
}
