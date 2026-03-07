import { Entity, Transform, Sprite, BoxCollider, Script } from '@cubeforge/react'
import type { EntityId, ECSWorld, TransformComponent } from '@cubeforge/react'
import { gameEvents } from '../gameEvents'

interface PodobooState { baseY: number; vy: number; hurtTimer: number }
const podobooStates = new Map<EntityId, PodobooState>()

function podobooUpdate(id: EntityId, world: ECSWorld, _input: unknown, dt: number) {
  if (!world.hasEntity(id)) return
  const state = podobooStates.get(id)
  if (!state) return

  const transform = world.getComponent<TransformComponent>(id, 'Transform')!

  state.vy      += 700 * dt           // gravity pulls it back down
  transform.y   += state.vy * dt

  if (transform.y >= state.baseY) {
    transform.y = state.baseY
    state.vy    = -420                // relaunch
  }

  // Hurt player on contact
  state.hurtTimer = Math.max(0, state.hurtTimer - dt)
  if (state.hurtTimer <= 0) {
    const pid = world.findByTag('player')
    if (pid) {
      const pt = world.getComponent<TransformComponent>(pid, 'Transform')
      if (pt && Math.abs(pt.x - transform.x) < 22 && Math.abs(pt.y - transform.y) < 22) {
        state.hurtTimer = 2.0
        gameEvents.onPlayerHurt?.()
      }
    }
  }
}

interface PodobooProps { x: number; baseY: number }

export function Podoboo({ x, baseY }: PodobooProps) {
  return (
    <Entity tags={['enemy']}>
      <Transform x={x} y={baseY} />
      <Sprite src="/Podoboo_Sprite_SMB.png" width={24} height={24} color="#ff1744" zIndex={11} />
      <BoxCollider width={22} height={22} isTrigger />
      <Script
        init={(id) => podobooStates.set(id, { baseY, vy: -420, hurtTimer: 0 })}
        update={podobooUpdate}
      />
    </Entity>
  )
}
