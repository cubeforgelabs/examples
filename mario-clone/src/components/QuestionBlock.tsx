import { Entity, Transform, Sprite, RigidBody, BoxCollider, Script } from '@cubeforge/react'
import type { EntityId, ECSWorld, TransformComponent, RigidBodyComponent, SpriteComponent } from '@cubeforge/react'
import { getImage } from '../images'
import { T } from '../levelGen'

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

  if (state.bounceTimer > 0) {
    state.bounceTimer -= dt
    const t = 1 - state.bounceTimer / 0.2
    transform.y = state.spawnY - Math.sin(t * Math.PI) * 6
    if (state.bounceTimer <= 0) transform.y = state.spawnY
  }

  if (state.hit) return

  const pid = world.findByTag('player')
  if (pid) {
    const pt = world.getComponent<TransformComponent>(pid, 'Transform')
    const rb = world.getComponent<RigidBodyComponent>(pid, 'RigidBody')
    if (pt && rb) {
      const dx          = Math.abs(pt.x - transform.x)
      const blockBottom = transform.y + T / 2
      const playerTop   = pt.y - 16 // generous: assume big mario head

      if (
        rb.vy < 0 &&
        dx < T &&
        playerTop >= blockBottom - 16 &&
        playerTop <= blockBottom + 8
      ) {
        state.hit         = true
        state.bounceTimer = 0.2
        sprite.src        = '/SMB1_Empty_Block.png'
        sprite.image      = getImage('/SMB1_Empty_Block.png')
        const meta = world.getComponent<BlockMeta>(id, 'BlockMeta')
        meta?.onReveal()
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
  reveals:  'coin' | 'mushroom' | 'fireFlower' | 'star' | 'oneUp'
  src?:     string
  onReveal: () => void
}

export function QuestionBlock({ x, y, onReveal, src = '/SMB_Qblock.png' }: QuestionBlockProps) {
  return (
    <Entity tags={['questionBlock']}>
      <Transform x={x} y={y} />
      <Sprite src={src} width={T} height={T} color="#f5a623" zIndex={3} />
      <RigidBody isStatic />
      <BoxCollider width={T} height={T} layer="world" />
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
