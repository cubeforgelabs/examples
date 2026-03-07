import { Entity, Transform, Sprite, RigidBody, BoxCollider, Script } from '@cubeforge/react'
import type { EntityId, ECSWorld, TransformComponent, RigidBodyComponent, SpriteComponent } from '@cubeforge/react'

interface BlockState {
  hit:         boolean
  bounceTimer: number
  spawnY:      number
}

const blockStates = new Map<EntityId, BlockState>()

function blockUpdate(id: EntityId, world: ECSWorld, _input: unknown, dt: number) {
  if (!world.hasEntity(id)) return
  const state = blockStates.get(id)
  if (!state) return

  const transform = world.getComponent<TransformComponent>(id, 'Transform')
  const sprite    = world.getComponent<SpriteComponent>(id, 'Sprite')
  if (!transform || !sprite) return

  // Bounce animation
  if (state.bounceTimer > 0) {
    state.bounceTimer -= dt
    const t = 1 - state.bounceTimer / 0.2
    transform.y = state.spawnY - Math.sin(t * Math.PI) * 8
    if (state.bounceTimer <= 0) transform.y = state.spawnY
  }

  if (state.hit) return

  // Check if a player is jumping up and hitting this block from below
  const pid = world.findByTag('player')
  if (pid) {
    const pt = world.getComponent<TransformComponent>(pid, 'Transform')
    const rb = world.getComponent<RigidBodyComponent>(pid, 'RigidBody')
    if (pt && rb) {

    // Player moving upward (rb.vy < 0), player's top edge near block's bottom edge
    const dx = Math.abs(pt.x - transform.x)
    // player top = pt.y - 20, block bottom = transform.y + 16
    const playerTop  = pt.y - 20
    const blockBottom = transform.y + 16

      if (
        rb.vy < 0 &&
        dx < 14 &&
        playerTop >= blockBottom - 18 &&
        playerTop <= blockBottom + 6
      ) {
        state.hit         = true
        state.bounceTimer = 0.2
        sprite.color      = '#a0522d'
        const meta = world.getComponent<BlockMeta>(id, 'BlockMeta')
        meta?.onReveal()
        return
      }
    }
  }
}

interface BlockMeta {
  type:     'BlockMeta'
  onReveal: () => void
}

interface QuestionBlockProps {
  x:        number
  y:        number
  reveals:  'coin' | 'mushroom'
  onReveal: () => void
}

export function QuestionBlock({ x, y, onReveal }: QuestionBlockProps) {
  return (
    <Entity tags={['questionBlock']}>
      <Transform x={x} y={y} />
      <Sprite width={32} height={32} color="#f5a623" zIndex={3} />
      <RigidBody isStatic />
      <BoxCollider width={32} height={32} />
      <Script
        init={(id, world) => {
          blockStates.set(id, { hit: false, bounceTimer: 0, spawnY: y })
          world.addComponent(id, { type: 'BlockMeta', onReveal } as BlockMeta)
        }}
        update={blockUpdate}
      />
    </Entity>
  )
}
