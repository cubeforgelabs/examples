import { Entity, Transform, Sprite, BoxCollider, Script } from '@cubeforge/react'
import type { EntityId, ECSWorld, TransformComponent } from '@cubeforge/react'
import { gameEvents } from '../gameEvents'

interface PlantState {
  timer:      number
  phase:      'up' | 'down'
  baseY:      number
  topY:       number
  hurtTimer:  number
}

const plantStates = new Map<EntityId, PlantState>()

function plantUpdate(id: EntityId, world: ECSWorld, _input: unknown, dt: number) {
  if (!world.hasEntity(id)) return
  const state = plantStates.get(id)
  if (!state) return

  const transform = world.getComponent<TransformComponent>(id, 'Transform')!
  state.timer -= dt

  if (state.phase === 'up') {
    if (transform.y > state.topY) {
      transform.y = Math.max(state.topY, transform.y - 80 * dt)
    } else if (state.timer <= 0) {
      state.phase = 'down'
      state.timer = 1.2
    }
  } else {
    if (transform.y < state.baseY) {
      transform.y = Math.min(state.baseY, transform.y + 80 * dt)
    } else if (state.timer <= 0) {
      state.phase = 'up'
      state.timer = 1.8
    }
  }

  // Hurt player on contact
  state.hurtTimer = Math.max(0, state.hurtTimer - dt)
  if (transform.y < state.baseY - 6 && state.hurtTimer <= 0) {
    const pid = world.findByTag('player')
    if (pid) {
      const pt = world.getComponent<TransformComponent>(pid, 'Transform')
      if (pt) {
        const dx = Math.abs(pt.x - transform.x)
        const dy = Math.abs(pt.y - transform.y)
        if (dx < 16 && dy < 20) {
          state.hurtTimer = 2.0
          gameEvents.onPlayerHurt?.()
        }
      }
    }
  }
}

interface PiranhaPlantProps {
  x: number
  pipeTopY: number
  src?: string
}

export function PiranhaPlant({ x, pipeTopY, src = '/SMB_Sprite_Piranha_Plant.png' }: PiranhaPlantProps) {
  const baseY = pipeTopY + 4    // hidden inside pipe
  const topY  = pipeTopY - 20   // fully emerged

  return (
    <Entity tags={['enemy']}>
      <Transform x={x} y={baseY} />
      <Sprite src={src} width={16} height={24} color="#4caf50" zIndex={11} />
      <BoxCollider width={14} height={22} isTrigger />
      <Script
        init={(id) => plantStates.set(id, { timer: 1.8, phase: 'up', baseY, topY, hurtTimer: 0 })}
        update={plantUpdate}
      />
    </Entity>
  )
}
