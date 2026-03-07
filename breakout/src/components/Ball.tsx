import { Entity, Transform, Sprite, Script } from '@cubeforge/react'
import type { EntityId, ECSWorld, TransformComponent } from '@cubeforge/react'
import type { InputManager } from '@cubeforge/react'
import type { BrickMeta } from './Brick'
import { gameEvents } from '../gameEvents'

const BALL_SIZE   = 12
const BALL_SPEED  = 280
const CANVAS_W    = 800
const PADDLE_W    = 100
const PADDLE_H    = 14

interface BallState {
  vx: number
  vy: number
  speed: number
  launched: boolean
}

const ballStates = new Map<EntityId, BallState>()

function ballInit(id: EntityId) {
  const angle = Math.atan2(-1, 1)
  ballStates.set(id, {
    vx:       Math.cos(angle) * BALL_SPEED,
    vy:       Math.sin(angle) * BALL_SPEED,
    speed:    BALL_SPEED,
    launched: true,
  })
}

function ballUpdate(id: EntityId, world: ECSWorld, _input: InputManager, dt: number) {
  if (!world.hasEntity(id)) return
  const state = ballStates.get(id)
  if (!state) return

  const transform = world.getComponent<TransformComponent>(id, 'Transform')
  if (!transform) return

  // Move ball
  transform.x += state.vx * dt
  transform.y += state.vy * dt

  const halfBall = BALL_SIZE / 2

  // ── Wall bounces ──────────────────────────────────────────────────────────
  if (transform.x - halfBall < 0) {
    transform.x = halfBall
    state.vx = Math.abs(state.vx)
  }
  if (transform.x + halfBall > CANVAS_W) {
    transform.x = CANVAS_W - halfBall
    state.vx = -Math.abs(state.vx)
  }
  // Ceiling
  if (transform.y - halfBall < 0) {
    transform.y = halfBall
    state.vy = Math.abs(state.vy)
  }

  // ── Paddle collision ──────────────────────────────────────────────────────
  const pid = world.findByTag('paddle')
  if (pid) {
    const pt = world.getComponent<TransformComponent>(pid, 'Transform')
    if (pt) {
      const paddleLeft   = pt.x - PADDLE_W / 2
      const paddleRight  = pt.x + PADDLE_W / 2
      const paddleTop    = pt.y - PADDLE_H / 2

      const ballLeft   = transform.x - halfBall
      const ballRight  = transform.x + halfBall
      const ballTop    = transform.y - halfBall
      const ballBottom = transform.y + halfBall

      const overlapX = ballRight > paddleLeft && ballLeft < paddleRight
      const overlapY = ballBottom > paddleTop  && ballTop < paddleTop + PADDLE_H

      if (overlapX && overlapY && state.vy > 0) {
        transform.y = paddleTop - halfBall
        const rel = (transform.x - pt.x) / (PADDLE_W / 2)
        const clampedRel = Math.max(-0.95, Math.min(0.95, rel))
        state.vx = clampedRel * state.speed * 1.2
        state.vy = -Math.sqrt(Math.max(0, state.speed * state.speed - state.vx * state.vx))
      }
    }
  }

  // ── Brick collision ───────────────────────────────────────────────────────
  for (const bid of world.findAllByTag('brick')) {
    if (!world.hasEntity(bid) || bid === id) continue

    const bt = world.getComponent<TransformComponent>(bid, 'Transform')
    if (!bt) continue

    // Brick sprite dimensions from design spec: 64×20
    const BRICK_W = 64
    const BRICK_H = 20

    const brickLeft   = bt.x - BRICK_W / 2
    const brickRight  = bt.x + BRICK_W / 2
    const brickTop    = bt.y - BRICK_H / 2
    const brickBottom = bt.y + BRICK_H / 2

    const ballLeft   = transform.x - halfBall
    const ballRight  = transform.x + halfBall
    const ballTop    = transform.y - halfBall
    const ballBottom = transform.y + halfBall

    const overlapX = ballRight > brickLeft && ballLeft < brickRight
    const overlapY = ballBottom > brickTop  && ballTop < brickBottom

    if (!overlapX || !overlapY) continue

    // Determine which axis has smaller penetration
    const penLeft   = ballRight  - brickLeft
    const penRight  = brickRight - ballLeft
    const penTop    = ballBottom - brickTop
    const penBottom = brickBottom - ballTop

    const minPenX = Math.min(penLeft, penRight)
    const minPenY = Math.min(penTop, penBottom)

    if (minPenX < minPenY) {
      // Horizontal collision — reflect vx
      state.vx = penLeft < penRight ? -Math.abs(state.vx) : Math.abs(state.vx)
    } else {
      // Vertical collision — reflect vy
      state.vy = penTop < penBottom ? -Math.abs(state.vy) : Math.abs(state.vy)
    }

    // Get BrickMeta for callback and score
    const meta = world.getComponent<BrickMeta>(bid, 'BrickMeta')
    const score = meta?.score ?? 0

    // Notify React of brick hit
    gameEvents.onBrickHit?.(bid, score)
    meta?.onHit(bid)

    // Destroy the brick entity
    world.destroyEntity(bid)
    break // only hit one brick per frame
  }

  // ── Ball lost (fell off bottom) ───────────────────────────────────────────
  if (transform.y > 580) {
    gameEvents.onBallLost?.()
    // Reset ball to center
    transform.x = CANVAS_W / 2
    transform.y = 300
    const resetAngle = Math.atan2(-1, 1)
    state.vx = Math.cos(resetAngle) * state.speed
    state.vy = Math.sin(resetAngle) * state.speed
  }
}

interface BallProps {
  x?: number
  y?: number
}

export function Ball({ x = 400, y = 300 }: BallProps) {
  return (
    <Entity tags={['ball']}>
      <Transform x={x} y={y} />
      <Sprite width={BALL_SIZE} height={BALL_SIZE} color="#ffffff" zIndex={15} />
      <Script
        init={(id) => ballInit(id)}
        update={ballUpdate}
      />
    </Entity>
  )
}
