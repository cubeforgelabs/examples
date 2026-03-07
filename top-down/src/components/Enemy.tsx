import { Entity, Transform, Sprite, RigidBody, BoxCollider, Script } from '@cubeforge/react'
import type { EntityId, ECSWorld, TransformComponent, RigidBodyComponent } from '@cubeforge/react'
import { gameEvents } from '../gameEvents'

interface EnemyState {
  vx: number
  vy: number
  health: number
  patrolAngle: number
  patrolCx: number
  patrolCy: number
  patrolRadius: number
  patrolSpeed: number
  stunTimer: number
}

const enemyStates = new Map<EntityId, EnemyState>()

const ENEMY_W = 22
const ENEMY_H = 22
const PLAYER_W = 24
const PLAYER_H = 32

function aabbOverlap(
  ax: number, ay: number, aw: number, ah: number,
  bx: number, by: number, bw: number, bh: number,
): boolean {
  return (
    Math.abs(ax - bx) < (aw + bw) / 2 &&
    Math.abs(ay - by) < (ah + bh) / 2
  )
}

function enemyInit(
  id: EntityId,
  cx: number,
  cy: number,
  radius: number,
  speed: number,
  startAngle: number,
) {
  enemyStates.set(id, {
    vx: 0,
    vy: 0,
    health: 1,
    patrolAngle: startAngle,
    patrolCx: cx,
    patrolCy: cy,
    patrolRadius: radius,
    patrolSpeed: speed,
    stunTimer: 0,
  })
}

function enemyUpdate(id: EntityId, world: ECSWorld, _input: unknown, dt: number) {
  if (!world.hasEntity(id)) return
  const state = enemyStates.get(id)
  if (!state) return

  const transform = world.getComponent<TransformComponent>(id, 'Transform')!
  const rb        = world.getComponent<RigidBodyComponent>(id, 'RigidBody')!

  // Stun timer
  if (state.stunTimer > 0) {
    state.stunTimer -= dt
    rb.vx = 0
    rb.vy = 0
    return
  }

  // Circular patrol
  state.patrolAngle += state.patrolSpeed * dt
  rb.vx = Math.cos(state.patrolAngle) * 40
  rb.vy = Math.sin(state.patrolAngle) * 40

  // Clamp to patrol area
  const dx = transform.x - state.patrolCx
  const dy = transform.y - state.patrolCy
  const dist = Math.sqrt(dx * dx + dy * dy)
  if (dist > state.patrolRadius + 5) {
    // Nudge back toward center
    rb.vx += (state.patrolCx - transform.x) * 0.5
    rb.vy += (state.patrolCy - transform.y) * 0.5
  }

  // Check sword hit
  for (const sid of world.findAllByTag('sword')) {
    if (!world.hasEntity(sid)) continue
    const st = world.getComponent<TransformComponent>(sid, 'Transform')
    if (!st) continue
    if (aabbOverlap(transform.x, transform.y, ENEMY_W, ENEMY_H, st.x, st.y, 20, 20)) {
      gameEvents.onEnemyKill?.()
      world.destroyEntity(id)
      return
    }
  }

  // Check player collision (hurt player)
  const pid = world.findByTag('player')
  if (pid) {
    const pt = world.getComponent<TransformComponent>(pid, 'Transform')
    if (pt && aabbOverlap(transform.x, transform.y, ENEMY_W, ENEMY_H, pt.x, pt.y, PLAYER_W, PLAYER_H)) {
      gameEvents.onPlayerHit?.()
      state.stunTimer = 0.3
    }
  }
}

interface EnemyProps {
  x: number
  y: number
  patrolRadius?: number
  patrolSpeed?: number
  startAngle?: number
}

export function Enemy({
  x,
  y,
  patrolRadius = 60,
  patrolSpeed = 1.2,
  startAngle = 0,
}: EnemyProps) {
  return (
    <Entity tags={['enemy']}>
      <Transform x={x} y={y} />
      <Sprite width={ENEMY_W} height={ENEMY_H} color="#66bb6a" zIndex={8} />
      <RigidBody gravityScale={0} friction={0} />
      <BoxCollider width={ENEMY_W} height={ENEMY_H} />
      <Script
        init={(id) => enemyInit(id, x, y, patrolRadius, patrolSpeed, startAngle)}
        update={enemyUpdate}
      />
    </Entity>
  )
}
