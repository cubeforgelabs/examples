import { Entity, Transform, Sprite, RigidBody, BoxCollider, Script } from '@cubeforge/react'
import type { EntityId, ECSWorld, TransformComponent, RigidBodyComponent, SpriteComponent } from '@cubeforge/react'
import { createTransform } from '@cubeforge/core'
import { createSprite } from '@cubeforge/renderer'
import { createTag } from '@cubeforge/core'
import { gameEvents } from '../gameEvents'
import { getImage } from '../images'

interface BowserHPComponent { type: 'BowserHP'; hp: number }

interface BowserState {
  direction:   1 | -1
  leftBound:   number
  rightBound:  number
  fireTimer:   number
}

interface FlameData { vx: number; life: number }

const bowserStates = new Map<EntityId, BowserState>()
const flames       = new Map<EntityId, FlameData>()

function bowserUpdate(id: EntityId, world: ECSWorld, _input: unknown, dt: number) {
  if (!world.hasEntity(id)) return
  const state = bowserStates.get(id)
  if (!state) return

  const transform = world.getComponent<TransformComponent>(id, 'Transform')!
  const rb        = world.getComponent<RigidBodyComponent>(id, 'RigidBody')!
  const sprite    = world.getComponent<SpriteComponent>(id, 'Sprite')!
  const hpComp    = world.getComponent<BowserHPComponent>(id, 'BowserHP')

  if (transform.x >= state.rightBound) state.direction = -1
  if (transform.x <= state.leftBound)  state.direction =  1
  rb.vx        = 45 * state.direction
  sprite.flipX = state.direction === 1

  // Flash red as HP drops
  if (hpComp) {
    if (hpComp.hp <= 2)      sprite.color = '#b71c1c'
    else if (hpComp.hp <= 4) sprite.color = '#e53935'
    else                     sprite.color = '#ff6f00'
  }

  // Shoot fire every ~3s
  state.fireTimer -= dt
  if (state.fireTimer <= 0) {
    state.fireTimer = 3.0 + Math.random() * 1.5
    const dir = state.direction === 1 ? 1 : -1
    const fid = world.createEntity()
    world.addComponent(fid, createTransform(transform.x + dir * 40, transform.y))
    const fs = createSprite({ width: 24, height: 20, color: '#ff6d00', zIndex: 12 })
    const img = getImage('/SMBBowsersFlame.gif')
    if (img) fs.image = img
    fs.flipX = dir < 0
    world.addComponent(fid, fs)
    world.addComponent(fid, createTag('enemyProjectile'))
    flames.set(fid, { vx: 200 * dir, life: 3.0 })
  }

  // Update flames
  const toRemove: EntityId[] = []
  for (const [fid, fdata] of flames) {
    if (!world.hasEntity(fid)) { toRemove.push(fid); continue }
    const ft = world.getComponent<TransformComponent>(fid, 'Transform')
    if (!ft) { toRemove.push(fid); continue }

    fdata.life -= dt
    ft.x       += fdata.vx * dt

    // Hurt player
    const pid = world.findByTag('player')
    if (pid) {
      const pt = world.getComponent<TransformComponent>(pid, 'Transform')
      if (pt && Math.abs(ft.x - pt.x) < 22 && Math.abs(ft.y - pt.y) < 22) {
        gameEvents.onPlayerHurt?.()
        world.destroyEntity(fid)
        toRemove.push(fid)
        continue
      }
    }
    if (fdata.life <= 0) { world.destroyEntity(fid); toRemove.push(fid) }
  }
  for (const fid of toRemove) flames.delete(fid)
}

interface BowserProps {
  x: number
  y: number
  patrolLeft?:  number
  patrolRight?: number
}

export function Bowser({ x, y, patrolLeft, patrolRight }: BowserProps) {
  const left  = patrolLeft  ?? x - 60
  const right = patrolRight ?? x + 60

  return (
    <Entity tags={['enemy', 'bowser']}>
      <Transform x={x} y={y} />
      <Sprite src="/SMB_Bowser_Sprite.png" width={68} height={68} color="#ff6f00" zIndex={10} />
      <RigidBody friction={1} />
      <BoxCollider width={60} height={64} />
      <Script
        init={(id, world) => {
          bowserStates.set(id, { direction: -1, leftBound: left, rightBound: right, fireTimer: 2.0 })
          world.addComponent(id, { type: 'BowserHP', hp: 5 } as BowserHPComponent)
        }}
        update={(id: EntityId, world: ECSWorld, input: unknown, dt: number) => bowserUpdate(id, world, input, dt)}
      />
    </Entity>
  )
}
