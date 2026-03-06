import { Entity, Transform, Sprite, RigidBody, BoxCollider, Script } from '@cubeforge/react'
import type { EntityId, ECSWorld, TransformComponent, RigidBodyComponent } from '@cubeforge/react'
import { gameEvents } from '../gameEvents'

interface MushroomState {
  vx: number
}

const mushroomStates = new Map<EntityId, MushroomState>()

function mushroomUpdate(id: EntityId, world: ECSWorld) {
  if (!world.hasEntity(id)) return
  const state = mushroomStates.get(id)
  if (!state) return

  const transform = world.getComponent<TransformComponent>(id, 'Transform')
  const rb        = world.getComponent<RigidBodyComponent>(id, 'RigidBody')
  if (!transform || !rb) return

  rb.vx = state.vx

  // Proximity collect — check all player-tagged entities
  for (const pid of world.query('Tag')) {
    const tag = world.getComponent<{ type: 'Tag'; tags: string[] }>(pid, 'Tag')
    if (!tag?.tags.includes('player')) continue

    const pt = world.getComponent<TransformComponent>(pid, 'Transform')
    if (!pt) continue

    const dx = Math.abs(pt.x - transform.x)
    const dy = Math.abs(pt.y - transform.y)
    if (dx < 20 && dy < 20) {
      gameEvents.onMushroomGet?.()
      world.destroyEntity(id)
      return
    }
  }
}

interface MushroomProps {
  x: number
  y: number
  onCollect?: () => void
}

export function Mushroom({ x, y }: MushroomProps) {
  return (
    <Entity tags={['mushroom']}>
      <Transform x={x} y={y} />
      <Sprite width={20} height={20} color="#e53935" zIndex={5} />
      <RigidBody />
      <BoxCollider width={20} height={20} />
      <Script
        init={(id) => {
          mushroomStates.set(id, { vx: 80 })
        }}
        update={mushroomUpdate}
      />
    </Entity>
  )
}
