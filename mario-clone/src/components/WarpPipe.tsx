import { Entity, Transform, Sprite, RigidBody, BoxCollider } from '@cubeforge/react'

interface WarpPipeProps {
  x: number
  y: number
  height?: number
  src?: string
}

export function WarpPipe({ x, y, height = 32, src = '/Warp_Pipe_SMB.png' }: WarpPipeProps) {
  return (
    <Entity tags={['pipe']}>
      <Transform x={x} y={y} />
      <Sprite src={src} width={32} height={height} color="#2e7d32" zIndex={1} />
      <RigidBody isStatic />
      <BoxCollider width={32} height={height} layer="world" />
    </Entity>
  )
}
