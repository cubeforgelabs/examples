import { Entity, Transform, Sprite, Script } from '@cubeforge/react'
import type { EntityId, ECSWorld, TransformComponent } from '@cubeforge/react'
import type { InputManager } from '@cubeforge/react'
import type { Room, NetMessage } from '../net/localTransport'
import { gameEvents } from '../gameEvents'

// ─── Constants ────────────────────────────────────────────────────────────────
export const W = 800
export const H = 400

const PLAYER_SIZE = 28
const PLAYER_SPD  = 260
const BALL_SIZE   = 16
const BALL_FRICTION = 0.98
const PUSH_FORCE  = 320
const GOAL_W      = 10
const WALL_T      = 10

// ─── Network state ───────────────────────────────────────────────────────────
// Rooms are set externally by App before game mount.
let room1: Room | null = null
let room2: Room | null = null

export function setRooms(r1: Room, r2: Room) {
  room1 = r1
  room2 = r2
}

// ─── Ball physics state ──────────────────────────────────────────────────────
interface BallState { vx: number; vy: number }
const ballStates = new Map<EntityId, BallState>()

// ─── Player script state ─────────────────────────────────────────────────────
interface PlayerScriptState {
  side: 'p1' | 'p2'
  room: Room | null
}
const playerStates = new Map<EntityId, PlayerScriptState>()

// ─── GameManager ─────────────────────────────────────────────────────────────
function managerInit(_id: EntityId) {
  // Set up network listeners: each room receives the other player's position.
  if (room1) {
    room1.onMessage((msg: NetMessage) => {
      if (msg.type === 'player:pos') {
        const p = msg.payload as { x: number; y: number }
        pendingRemote.p1 = p
      }
    })
  }
  if (room2) {
    room2.onMessage((msg: NetMessage) => {
      if (msg.type === 'player:pos') {
        const p = msg.payload as { x: number; y: number }
        pendingRemote.p2 = p
      }
    })
  }
}

// Buffer for incoming remote positions.
const pendingRemote: {
  p1: { x: number; y: number } | null
  p2: { x: number; y: number } | null
} = { p1: null, p2: null }

function managerUpdate(id: EntityId, world: ECSWorld, _input: InputManager, dt: number) {
  if (!world.hasEntity(id)) return

  const ballId = world.findByTag('mp-ball')
  const p1Id   = world.findByTag('mp-p1')
  const p2Id   = world.findByTag('mp-p2')
  if (!ballId || !p1Id || !p2Id) return

  const ball = world.getComponent<TransformComponent>(ballId, 'Transform')
  const p1   = world.getComponent<TransformComponent>(p1Id,  'Transform')
  const p2   = world.getComponent<TransformComponent>(p2Id,  'Transform')
  if (!ball || !p1 || !p2) return

  // ── Apply remote positions (from the other player's perspective) ──────
  // In this local demo, room1 sends p1's position to room2 (so room2 receives
  // it as "the remote p1"), and vice versa. We apply them to show the sync.
  if (pendingRemote.p1) {
    // p1 data came from room1 -> applies as remote on the room2 side.
    // In this single-canvas demo both are visible, so this is a no-op
    // demonstration. The real sync is: room1 sends, room2 receives.
    pendingRemote.p1 = null
  }
  if (pendingRemote.p2) {
    pendingRemote.p2 = null
  }

  // ── Ball physics ──────────────────────────────────────────────────────
  let state = ballStates.get(ballId)
  if (!state) {
    state = { vx: 0, vy: 0 }
    ballStates.set(ballId, state)
  }

  // Apply friction.
  state.vx *= BALL_FRICTION
  state.vy *= BALL_FRICTION
  if (Math.abs(state.vx) < 0.5) state.vx = 0
  if (Math.abs(state.vy) < 0.5) state.vy = 0

  ball.x += state.vx * dt
  ball.y += state.vy * dt

  // ── Player-to-ball push ───────────────────────────────────────────────
  pushBall(p1, ball, state)
  pushBall(p2, ball, state)

  // ── Wall bounces (top/bottom) ─────────────────────────────────────────
  const halfBall = BALL_SIZE / 2
  if (ball.y - halfBall < WALL_T) {
    ball.y = WALL_T + halfBall
    state.vy = Math.abs(state.vy)
  }
  if (ball.y + halfBall > H - WALL_T) {
    ball.y = H - WALL_T - halfBall
    state.vy = -Math.abs(state.vy)
  }

  // ── Side wall bounces ─────────────────────────────────────────────────
  if (ball.x - halfBall < GOAL_W) {
    ball.x = GOAL_W + halfBall
    state.vx = Math.abs(state.vx)
  }
  if (ball.x + halfBall > W - GOAL_W) {
    ball.x = W - GOAL_W - halfBall
    state.vx = -Math.abs(state.vx)
  }

  // ── Goal detection ────────────────────────────────────────────────────
  if (ball.x - halfBall <= GOAL_W + 2 && Math.abs(state.vx) < 1) {
    // Ball resting at left goal — Player 2 scores.
    if (ball.x < GOAL_W + halfBall + 4) {
      gameEvents.onScore?.('right')
      resetBall(ball, state, true)
    }
  }
  if (ball.x + halfBall >= W - GOAL_W - 2 && Math.abs(state.vx) < 1) {
    // Ball resting at right goal — Player 1 scores.
    if (ball.x > W - GOAL_W - halfBall - 4) {
      gameEvents.onScore?.('left')
      resetBall(ball, state, false)
    }
  }
}

function pushBall(player: TransformComponent, ball: TransformComponent, state: BallState) {
  const dx = ball.x - player.x
  const dy = ball.y - player.y
  const dist = Math.sqrt(dx * dx + dy * dy)
  const minDist = (PLAYER_SIZE + BALL_SIZE) / 2

  if (dist < minDist && dist > 0) {
    const nx = dx / dist
    const ny = dy / dist
    // Separate ball from player.
    ball.x = player.x + nx * minDist
    ball.y = player.y + ny * minDist
    // Apply push velocity.
    state.vx += nx * PUSH_FORCE
    state.vy += ny * PUSH_FORCE
  }
}

function resetBall(ball: TransformComponent, state: BallState, toRight: boolean) {
  ball.x = W / 2
  ball.y = H / 2
  state.vx = (toRight ? 1 : -1) * 120
  state.vy = (Math.random() - 0.5) * 80
}

// ─── Player movement scripts ─────────────────────────────────────────────────
function p1Init(id: EntityId) {
  playerStates.set(id, { side: 'p1', room: room1 })
}

function p1Update(id: EntityId, world: ECSWorld, input: InputManager, dt: number) {
  if (!world.hasEntity(id)) return
  const t = world.getComponent<TransformComponent>(id, 'Transform')
  if (!t) return

  // WASD controls.
  if (input.isDown('KeyW'))     t.y = Math.max(WALL_T + PLAYER_SIZE / 2, t.y - PLAYER_SPD * dt)
  if (input.isDown('KeyS'))     t.y = Math.min(H - WALL_T - PLAYER_SIZE / 2, t.y + PLAYER_SPD * dt)
  if (input.isDown('KeyA'))     t.x = Math.max(GOAL_W + PLAYER_SIZE / 2, t.x - PLAYER_SPD * dt)
  if (input.isDown('KeyD'))     t.x = Math.min(W / 2 - PLAYER_SIZE / 2, t.x + PLAYER_SPD * dt)

  // Broadcast position via room1.
  // In production: import { syncEntity } from '@cubeforge/net'
  room1?.send({ type: 'player:pos', payload: { x: t.x, y: t.y } })
}

function p2Init(id: EntityId) {
  playerStates.set(id, { side: 'p2', room: room2 })
}

function p2Update(id: EntityId, world: ECSWorld, input: InputManager, dt: number) {
  if (!world.hasEntity(id)) return
  const t = world.getComponent<TransformComponent>(id, 'Transform')
  if (!t) return

  // Arrow key controls.
  if (input.isDown('ArrowUp'))    t.y = Math.max(WALL_T + PLAYER_SIZE / 2, t.y - PLAYER_SPD * dt)
  if (input.isDown('ArrowDown'))  t.y = Math.min(H - WALL_T - PLAYER_SIZE / 2, t.y + PLAYER_SPD * dt)
  if (input.isDown('ArrowLeft'))  t.x = Math.max(W / 2 + PLAYER_SIZE / 2, t.x - PLAYER_SPD * dt)
  if (input.isDown('ArrowRight')) t.x = Math.min(W - GOAL_W - PLAYER_SIZE / 2, t.x + PLAYER_SPD * dt)

  // Broadcast position via room2.
  room2?.send({ type: 'player:pos', payload: { x: t.x, y: t.y } })
}

// ─── Components ──────────────────────────────────────────────────────────────

export function GameManager() {
  return (
    <Entity id="mp-manager">
      <Transform x={0} y={0} />
      <Script init={managerInit} update={managerUpdate} />
    </Entity>
  )
}

export function Player1() {
  return (
    <Entity tags={['mp-p1']}>
      <Transform x={W * 0.25} y={H / 2} />
      <Sprite width={PLAYER_SIZE} height={PLAYER_SIZE} color="#4fc3f7" zIndex={10} />
      <Script init={p1Init} update={p1Update} />
    </Entity>
  )
}

export function Player2() {
  return (
    <Entity tags={['mp-p2']}>
      <Transform x={W * 0.75} y={H / 2} />
      <Sprite width={PLAYER_SIZE} height={PLAYER_SIZE} color="#ef5350" zIndex={10} />
      <Script init={p2Init} update={p2Update} />
    </Entity>
  )
}

export function Ball() {
  return (
    <Entity tags={['mp-ball']}>
      <Transform x={W / 2} y={H / 2} />
      <Sprite width={BALL_SIZE} height={BALL_SIZE} color="#ffd54f" zIndex={8} />
    </Entity>
  )
}

// ─── Static arena pieces ─────────────────────────────────────────────────────

export function TopWall() {
  return (
    <Entity tags={['wall']}>
      <Transform x={W / 2} y={WALL_T / 2} />
      <Sprite width={W} height={WALL_T} color="#1a1f33" zIndex={2} />
    </Entity>
  )
}

export function BottomWall() {
  return (
    <Entity tags={['wall']}>
      <Transform x={W / 2} y={H - WALL_T / 2} />
      <Sprite width={W} height={WALL_T} color="#1a1f33" zIndex={2} />
    </Entity>
  )
}

export function LeftGoal() {
  return (
    <Entity tags={['goal-left']}>
      <Transform x={GOAL_W / 2} y={H / 2} />
      <Sprite width={GOAL_W} height={H - WALL_T * 2} color="#1b2a3d" zIndex={1} />
    </Entity>
  )
}

export function RightGoal() {
  return (
    <Entity tags={['goal-right']}>
      <Transform x={W - GOAL_W / 2} y={H / 2} />
      <Sprite width={GOAL_W} height={H - WALL_T * 2} color="#3d1b1b" zIndex={1} />
    </Entity>
  )
}

export function CenterLine() {
  return (
    <Entity tags={['center-line']}>
      <Transform x={W / 2} y={H / 2} />
      <Sprite width={2} height={H - WALL_T * 2} color="#141924" zIndex={1} />
    </Entity>
  )
}
