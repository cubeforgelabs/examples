import { Entity, Transform, Sprite, RigidBody, BoxCollider, Script } from '@cubeforge/react'
import type { EntityId, ECSWorld, TransformComponent } from '@cubeforge/react'
import { createTransform } from '@cubeforge/core'
import { createSprite } from '@cubeforge/renderer'
import { createTag } from '@cubeforge/core'
import { gameEvents } from '../gameEvents'
import { getImage } from '../images'

interface BillData { vx: number; life: number }
const bulletBills = new Map<EntityId, BillData>()

interface BlasterState { fireTimer: number; fireInterval: number; dir: 1 | -1 }
const blasterStates = new Map<EntityId, BlasterState>()

function blasterUpdate(id: EntityId, world: ECSWorld, _input: unknown, dt: number) {
  if (!world.hasEntity(id)) return
  const state = blasterStates.get(id)
  if (!state) return

  state.fireTimer -= dt
  if (state.fireTimer <= 0) {
    state.fireTimer = state.fireInterval

    const bt = world.getComponent<TransformComponent>(id, 'Transform')
    if (!bt) return

    const bid = world.createEntity()
    world.addComponent(bid, createTransform(bt.x, bt.y))

    const sprite = createSprite({ width: 16, height: 8, color: '#607d8b', zIndex: 12 })
    const img = getImage('/Bullet_Bill_Super_Mario_Bros.png')
    if (img) sprite.image = img
    sprite.flipX = state.dir === 1
    world.addComponent(bid, sprite)
    world.addComponent(bid, createTag('enemy', 'bulletBill'))

    bulletBills.set(bid, { vx: -160 * state.dir, life: 5.0 })
  }

  // Update all bullet bills
  const toRemove: EntityId[] = []
  for (const [bid, bdata] of bulletBills) {
    if (!world.hasEntity(bid)) { toRemove.push(bid); continue }
    const bt2 = world.getComponent<TransformComponent>(bid, 'Transform')
    if (!bt2) { toRemove.push(bid); continue }

    bdata.life -= dt
    bt2.x += bdata.vx * dt

    // Hurt player on contact
    const pid = world.findByTag('player')
    if (pid) {
      const pt = world.getComponent<TransformComponent>(pid, 'Transform')
      if (pt) {
        const dx = Math.abs(bt2.x - pt.x)
        const dy = Math.abs(bt2.y - pt.y)
        if (dx < 16 && dy < 12) {
          gameEvents.onPlayerHurt?.()
        }
      }
    }

    if (bdata.life <= 0) { world.destroyEntity(bid); toRemove.push(bid) }
  }
  for (const bid of toRemove) bulletBills.delete(bid)
}

interface BillBlasterProps {
  x: number
  y: number
  dir?: 1 | -1
  fireInterval?: number
}

export function BillBlaster({ x, y, dir = 1, fireInterval = 4.0 }: BillBlasterProps) {
  return (
    <Entity tags={['blaster']}>
      <Transform x={x} y={y} />
      <Sprite src="/Bill_Blaster_Sprite_SMB.png" width={16} height={32} color="#37474f" zIndex={8} />
      <RigidBody isStatic />
      <BoxCollider width={16} height={32} layer="world" />
      <Script
        init={(id) => blasterStates.set(id, { fireTimer: fireInterval * 0.5, fireInterval, dir })}
        update={blasterUpdate}
      />
    </Entity>
  )
}
