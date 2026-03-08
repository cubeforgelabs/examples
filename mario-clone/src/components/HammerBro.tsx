import { Entity, Transform, Sprite, RigidBody, BoxCollider, Script } from '@cubeforge/react'
import type { EntityId, ECSWorld, TransformComponent, RigidBodyComponent, SpriteComponent } from '@cubeforge/react'
import { createTransform } from '@cubeforge/core'
import { createSprite } from '@cubeforge/renderer'
import { createTag } from '@cubeforge/core'
import { gameEvents } from '../gameEvents'
import { getImage } from '../images'

interface HammerData { vx: number; vy: number; life: number }
const hammers = new Map<EntityId, HammerData>()

interface BroState {
  direction:   1 | -1
  leftBound:   number
  rightBound:  number
  throwTimer:  number
}

const broStates = new Map<EntityId, BroState>()

function broInit(id: EntityId, left: number, right: number) {
  broStates.set(id, { direction: -1, leftBound: left, rightBound: right, throwTimer: 2.0 })
}

function broUpdate(id: EntityId, world: ECSWorld, _input: unknown, dt: number) {
  if (!world.hasEntity(id)) return
  const state = broStates.get(id)
  if (!state) return

  const transform = world.getComponent<TransformComponent>(id, 'Transform')!
  const rb        = world.getComponent<RigidBodyComponent>(id, 'RigidBody')!
  const sprite    = world.getComponent<SpriteComponent>(id, 'Sprite')!

  if (transform.x >= state.rightBound) state.direction = -1
  if (transform.x <= state.leftBound)  state.direction =  1
  rb.vx        = 55 * state.direction
  sprite.flipX = state.direction === 1

  // Throw hammer
  state.throwTimer -= dt
  if (state.throwTimer <= 0) {
    state.throwTimer = 2.5

    const pid = world.findByTag('player')
    const dir = pid ? (() => {
      const pt = world.getComponent<TransformComponent>(pid, 'Transform')
      return pt && pt.x < transform.x ? -1 : 1
    })() : state.direction

    const hid = world.createEntity()
    world.addComponent(hid, createTransform(transform.x, transform.y - 12))
    const hsprite = createSprite({ width: 8, height: 8, color: '#795548', zIndex: 11 })
    const img = getImage('/SMB_Sprite_Axe.png')
    if (img) hsprite.image = img
    world.addComponent(hid, hsprite)
    world.addComponent(hid, createTag('hammer'))
    hammers.set(hid, { vx: 120 * dir, vy: -380, life: 2.5 })
  }

  // Update hammers
  const toRemove: EntityId[] = []
  for (const [hid, hdata] of hammers) {
    if (!world.hasEntity(hid)) { toRemove.push(hid); continue }
    const ht = world.getComponent<TransformComponent>(hid, 'Transform')
    if (!ht) { toRemove.push(hid); continue }

    hdata.life -= dt
    hdata.vy   += 800 * dt
    ht.x       += hdata.vx * dt
    ht.y       += hdata.vy * dt
    ht.rotation += 6 * dt

    // Hurt player
    const pid = world.findByTag('player')
    if (pid) {
      const pt = world.getComponent<TransformComponent>(pid, 'Transform')
      if (pt && Math.abs(ht.x - pt.x) < 12 && Math.abs(ht.y - pt.y) < 12) {
        gameEvents.onPlayerHurt?.()
        world.destroyEntity(hid)
        toRemove.push(hid)
        continue
      }
    }
    if (hdata.life <= 0) { world.destroyEntity(hid); toRemove.push(hid) }
  }
  for (const hid of toRemove) hammers.delete(hid)
}

interface HammerBroProps {
  x?:           number
  y?:           number
  patrolLeft?:  number
  patrolRight?: number
}

export function HammerBro({ x = 400, y = 484, patrolLeft, patrolRight }: HammerBroProps) {
  const left  = patrolLeft  ?? x - 80
  const right = patrolRight ?? x + 80

  return (
    <Entity tags={['enemy']}>
      <Transform x={x} y={y} />
      <Sprite src="/SMB_Hammer_Bro_Sprite.png" width={16} height={24} color="#1565c0" zIndex={10} />
      <RigidBody friction={1} />
      <BoxCollider width={16} height={24} mask="world" />
      <Script
        init={(id) => broInit(id, left, right)}
        update={(id: EntityId, world: ECSWorld, input: unknown, dt: number) => broUpdate(id, world, input, dt)}
      />
    </Entity>
  )
}
