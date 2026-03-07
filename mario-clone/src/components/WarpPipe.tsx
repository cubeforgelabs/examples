import { Entity, Transform, Sprite, RigidBody, BoxCollider } from '@cubeforge/react'

interface WarpPipeProps {
  x: number
  y: number
  height?: number   // visible height of the pipe above ground (default 64)
  src?: string      // allow different pipe colors
}

export function WarpPipe({ x, y, height = 64, src = '/Warp_Pipe_SMB.png' }: WarpPipeProps) {
  return (
    <Entity tags={['pipe']}>
      <Transform x={x} y={y} />
      <Sprite src={src} width={48} height={height} color="#2e7d32" zIndex={1} />
      <RigidBody isStatic />
      <BoxCollider width={48} height={height} />
    </Entity>
  )
}
