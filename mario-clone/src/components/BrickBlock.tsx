import { Entity, Transform, Sprite, RigidBody, BoxCollider, Script } from '@cubeforge/react'
import type { EntityId, ECSWorld, TransformComponent, RigidBodyComponent, SpriteComponent } from '@cubeforge/react'
import { T } from '../levelGen'

interface BrickState { bounceTimer: number; spawnY: number }
const brickStates = new Map<EntityId, BrickState>()

function brickUpdate(id: EntityId, world: ECSWorld, _input: unknown, dt: number) {
  if (!world.hasEntity(id)) return
  const state = brickStates.get(id)
  if (!state) return

  const transform = world.getComponent<TransformComponent>(id, 'Transform')
  const sprite    = world.getComponent<SpriteComponent>(id, 'Sprite')
  if (!transform || !sprite) return

  if (state.bounceTimer > 0) {
    state.bounceTimer -= dt
    const t = 1 - state.bounceTimer / 0.15
    transform.y = state.spawnY - Math.sin(t * Math.PI) * 4
    if (state.bounceTimer <= 0) transform.y = state.spawnY
  }

  const pid = world.findByTag('player')
  if (!pid) return
  const pt = world.getComponent<TransformComponent>(pid, 'Transform')
  const rb = world.getComponent<RigidBodyComponent>(pid, 'RigidBody')
  if (!pt || !rb) return

  const dx          = Math.abs(pt.x - transform.x)
  const blockBottom = transform.y + T / 2
  const playerTop   = pt.y - 16

  if (
    rb.vy < 0 &&
    dx < T &&
    playerTop >= blockBottom - 16 &&
    playerTop <= blockBottom + 8 &&
    state.bounceTimer <= 0
  ) {
    state.bounceTimer = 0.15
  }
}

interface BrickBlockProps { x: number; y: number }

export function BrickBlock({ x, y }: BrickBlockProps) {
  return (
    <Entity>
      <Transform x={x} y={y} />
      <Sprite src="/SMB_Brick_Block_Sprite.png" width={T} height={T} color="#b5651d" zIndex={3} />
      <RigidBody isStatic />
      <BoxCollider width={T} height={T} layer="world" />
      <Script
        init={(id) => brickStates.set(id, { bounceTimer: 0, spawnY: y })}
        update={brickUpdate}
      />
    </Entity>
  )
}
