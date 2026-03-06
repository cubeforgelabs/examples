import { Entity, Transform, Sprite, Script } from '@cubeforge/react'
import type { EntityId, ECSWorld, TransformComponent } from '@cubeforge/react'
import type { InputManager } from '@cubeforge/react'

const PADDLE_SPEED  = 400
const PADDLE_MIN_X  = 50
const PADDLE_MAX_X  = 750
const PADDLE_W      = 100
const PADDLE_H      = 14

interface PaddleState {
  speed: number
}

const paddleStates = new Map<EntityId, PaddleState>()

function paddleInit(id: EntityId) {
  paddleStates.set(id, { speed: PADDLE_SPEED })
}

function paddleUpdate(id: EntityId, world: ECSWorld, input: InputManager, dt: number) {
  if (!world.hasEntity(id)) return
  const state = paddleStates.get(id)
  if (!state) return

  const transform = world.getComponent<TransformComponent>(id, 'Transform')
  if (!transform) return

  const left  = input.isDown('ArrowLeft')  || input.isDown('a') || input.isDown('KeyA')
  const right = input.isDown('ArrowRight') || input.isDown('d') || input.isDown('KeyD')

  if (left)       transform.x -= state.speed * dt
  else if (right) transform.x += state.speed * dt

  // Clamp paddle to canvas bounds
  transform.x = Math.max(PADDLE_MIN_X, Math.min(PADDLE_MAX_X, transform.x))
}

interface PaddleProps {
  x?: number
  y?: number
}

export { PADDLE_W, PADDLE_H }

export function Paddle({ x = 400, y = 524 }: PaddleProps) {
  return (
    <Entity id="paddle" tags={['paddle']}>
      <Transform x={x} y={y} />
      <Sprite width={PADDLE_W} height={PADDLE_H} color="#4fc3f7" zIndex={10} />
      <Script
        init={(id) => paddleInit(id)}
        update={paddleUpdate}
      />
    </Entity>
  )
}
