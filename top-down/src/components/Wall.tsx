import { Entity, Transform, Sprite, RigidBody, BoxCollider } from '@cubeforge/react'

interface WallProps {
  x: number
  y: number
  width: number
  height: number
  color?: string
}

export function Wall({ x, y, width, height, color = '#3e2723' }: WallProps) {
  return (
    <Entity>
      <Transform x={x} y={y} />
      <Sprite width={width} height={height} color={color} zIndex={2} />
      <RigidBody isStatic />
      <BoxCollider width={width} height={height} />
    </Entity>
  )
}
