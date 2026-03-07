import { Entity, Transform, Sprite, Script } from '@cubeforge/react'
import type { EntityId, ECSWorld, TransformComponent } from '@cubeforge/react'
import type { InputManager } from '@cubeforge/react'
import { gameEvents } from '../gameEvents'

// ─── Constants ────────────────────────────────────────────────────────────────
export const W           = 640
export const H           = 480
const PADDLE_W    = 14
const PADDLE_H    = 80
const BALL_SIZE   = 12
const PADDLE_SPD  = 340
const BALL_SPD    = 290

// ─── Manager ─────────────────────────────────────────────────────────────────
interface PongState { bvx: number; bvy: number; scored: boolean }
const states = new Map<EntityId, PongState>()

function resetBall(state: PongState, ball: TransformComponent, toRight: boolean) {
  ball.x = W / 2
  ball.y = H / 2
  const dir = toRight ? 1 : -1
  state.bvx = BALL_SPD * dir
  state.bvy = BALL_SPD * (Math.random() * 0.6 + 0.2) * (Math.random() > 0.5 ? 1 : -1)
  state.scored = true
}

function pongInit(id: EntityId) {
  states.set(id, { bvx: BALL_SPD * 0.9, bvy: BALL_SPD * 0.5, scored: false })
}

function findByTag(world: ECSWorld, tag: string): TransformComponent | undefined {
  for (const eid of world.query('Tag', 'Transform')) {
    if (!world.hasEntity(eid)) continue
    const t = world.getComponent<{ type: 'Tag'; tags: string[] }>(eid, 'Tag')
    if (t?.tags.includes(tag)) return world.getComponent<TransformComponent>(eid, 'Transform')
  }
  return undefined
}

function pongUpdate(id: EntityId, world: ECSWorld, input: InputManager, dt: number) {
  if (!world.hasEntity(id)) return
  const state = states.get(id)
  if (!state) return

  const ball  = findByTag(world, 'pong-ball')
  const left  = findByTag(world, 'pong-left')
  const right = findByTag(world, 'pong-right')
  if (!ball || !left || !right) return

  // ── Move paddles ────────────────────────────────────────────────────────
  const minY = PADDLE_H / 2
  const maxY = H - PADDLE_H / 2
  if (input.isDown('KeyW'))       left.y  = Math.max(minY, left.y  - PADDLE_SPD * dt)
  if (input.isDown('KeyS'))       left.y  = Math.min(maxY, left.y  + PADDLE_SPD * dt)
  if (input.isDown('ArrowUp'))    right.y = Math.max(minY, right.y - PADDLE_SPD * dt)
  if (input.isDown('ArrowDown'))  right.y = Math.min(maxY, right.y + PADDLE_SPD * dt)

  // ── Move ball ───────────────────────────────────────────────────────────
  ball.x += state.bvx * dt
  ball.y += state.bvy * dt

  // Top/bottom walls
  if (ball.y - BALL_SIZE / 2 < 0)   { ball.y = BALL_SIZE / 2;       state.bvy =  Math.abs(state.bvy) }
  if (ball.y + BALL_SIZE / 2 > H)   { ball.y = H - BALL_SIZE / 2;   state.bvy = -Math.abs(state.bvy) }

  // ── Paddle collisions ───────────────────────────────────────────────────
  const HW = BALL_SIZE / 2
  const PW = PADDLE_W  / 2
  const PH = PADDLE_H  / 2

  // Left paddle
  if (state.bvx < 0 &&
      ball.x - HW < left.x + PW && ball.x + HW > left.x - PW &&
      ball.y - HW < left.y + PH && ball.y + HW > left.y - PH) {
    state.bvx = Math.abs(state.bvx) * 1.06
    state.bvy = ((ball.y - left.y) / PH) * BALL_SPD
    ball.x = left.x + PW + HW
  }

  // Right paddle
  if (state.bvx > 0 &&
      ball.x + HW > right.x - PW && ball.x - HW < right.x + PW &&
      ball.y - HW < right.y + PH && ball.y + HW > right.y - PH) {
    state.bvx = -Math.abs(state.bvx) * 1.06
    state.bvy = ((ball.y - right.y) / PH) * BALL_SPD
    ball.x = right.x - PW - HW
  }

  // ── Scoring ─────────────────────────────────────────────────────────────
  if (!state.scored) {
    if (ball.x < 0)  { gameEvents.onScore?.('right'); resetBall(state, ball, true)  }
    if (ball.x > W)  { gameEvents.onScore?.('left');  resetBall(state, ball, false) }
  } else if (Math.abs(ball.x - W / 2) < 60) {
    state.scored = false
  }
}

export function GameManager() {
  return (
    <Entity id="pong-manager">
      <Transform x={0} y={0} />
      <Script init={pongInit} update={pongUpdate} />
    </Entity>
  )
}

// ─── Ball ─────────────────────────────────────────────────────────────────────
export function Ball() {
  return (
    <Entity tags={['pong-ball']}>
      <Transform x={W / 2} y={H / 2} />
      <Sprite width={BALL_SIZE} height={BALL_SIZE} color="#ffffff" zIndex={10} />
    </Entity>
  )
}

// ─── Paddle ───────────────────────────────────────────────────────────────────
interface PaddleProps { side: 'left' | 'right' }
export function Paddle({ side }: PaddleProps) {
  const x     = side === 'left' ? 24 : W - 24
  const color = side === 'left' ? '#4fc3f7' : '#ef5350'
  const tag   = side === 'left' ? 'pong-left' : 'pong-right'
  return (
    <Entity tags={[tag]}>
      <Transform x={x} y={H / 2} />
      <Sprite width={PADDLE_W} height={PADDLE_H} color={color} zIndex={5} />
    </Entity>
  )
}
