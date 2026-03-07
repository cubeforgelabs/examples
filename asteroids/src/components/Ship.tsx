import { Entity, Transform, Sprite, Script } from '@cubeforge/react'
import type { EntityId, ECSWorld, TransformComponent, SpriteComponent } from '@cubeforge/react'
import type { InputManager } from '@cubeforge/react'
import { createTransform } from '@cubeforge/core'
import { createSprite } from '@cubeforge/renderer'
import { createTag } from '@cubeforge/core'
import { gameEvents } from '../gameEvents'

// ─── Public constants ─────────────────────────────────────────────────────────
export const CANVAS_W   = 800
export const CANVAS_H   = 560
export const SHIP_R     = 14    // approx collision radius

// ─── Private constants ────────────────────────────────────────────────────────
const ROTATE_SPD   = 3.6
const THRUST       = 380
const DRAG         = 0.97
const MAX_SPEED    = 500
const BULLET_SPD   = 580
const SHOOT_COOL   = 0.22
const INVINCIBLE_T = 2.5
const BULLET_LIFE  = 1.4

// ─── State ────────────────────────────────────────────────────────────────────
interface BulletData { life: number }
interface ShipState {
  vx: number; vy: number
  shootCooldown:   number
  isInvincible:    boolean
  invincibleTimer: number
  flashTimer:      number
  bullets:         Map<EntityId, BulletData>
}
const states = new Map<EntityId, ShipState>()

// ─── Helpers ──────────────────────────────────────────────────────────────────
function wrap(v: number, max: number) {
  if (v < -30)      return max + 30
  if (v > max + 30) return -30
  return v
}

// ─── Script ───────────────────────────────────────────────────────────────────
function shipInit(id: EntityId) {
  states.set(id, {
    vx: 0, vy: 0,
    shootCooldown:   0,
    isInvincible:    true,
    invincibleTimer: INVINCIBLE_T,
    flashTimer:      0,
    bullets:         new Map(),
  })
}

function shipUpdate(id: EntityId, world: ECSWorld, input: InputManager, dt: number) {
  if (!world.hasEntity(id)) return
  const state = states.get(id)
  if (!state) return

  const transform = world.getComponent<TransformComponent>(id, 'Transform')
  const sprite    = world.getComponent<SpriteComponent>(id, 'Sprite')
  if (!transform || !sprite) return

  // ── Invincibility flash ──────────────────────────────────────────────────
  if (state.isInvincible) {
    state.invincibleTimer -= dt
    state.flashTimer      -= dt
    if (state.flashTimer <= 0) { sprite.visible = !sprite.visible; state.flashTimer = 0.1 }
    if (state.invincibleTimer <= 0) { state.isInvincible = false; sprite.visible = true }
  }

  // ── Rotate ──────────────────────────────────────────────────────────────
  if (input.isDown('ArrowLeft')  || input.isDown('KeyA')) transform.rotation -= ROTATE_SPD * dt
  if (input.isDown('ArrowRight') || input.isDown('KeyD')) transform.rotation += ROTATE_SPD * dt

  // ── Thrust ──────────────────────────────────────────────────────────────
  if (input.isDown('ArrowUp') || input.isDown('KeyW')) {
    state.vx += Math.sin(transform.rotation) * THRUST * dt
    state.vy -= Math.cos(transform.rotation) * THRUST * dt
  }
  state.vx *= Math.pow(DRAG, dt * 60)
  state.vy *= Math.pow(DRAG, dt * 60)
  const spd = Math.sqrt(state.vx * state.vx + state.vy * state.vy)
  if (spd > MAX_SPEED) { state.vx = state.vx / spd * MAX_SPEED; state.vy = state.vy / spd * MAX_SPEED }

  // ── Move + wrap ──────────────────────────────────────────────────────────
  transform.x = wrap(transform.x + state.vx * dt, CANVAS_W)
  transform.y = wrap(transform.y + state.vy * dt, CANVAS_H)

  // ── Shoot ────────────────────────────────────────────────────────────────
  state.shootCooldown -= dt
  if ((input.isDown('Space') || input.isDown('KeyZ')) && state.shootCooldown <= 0) {
    state.shootCooldown = SHOOT_COOL
    const angle = transform.rotation
    const bx = transform.x + Math.sin(angle) * 18
    const by = transform.y - Math.cos(angle) * 18
    const bid = world.createEntity()
    const bt  = createTransform(bx, by)
    bt.rotation = angle   // store firing angle in rotation field
    world.addComponent(bid, bt)
    world.addComponent(bid, createSprite({ width: 4, height: 4, color: '#fff', zIndex: 8 }))
    world.addComponent(bid, createTag('bullet'))
    state.bullets.set(bid, { life: BULLET_LIFE })
  }

  // ── Update bullets ────────────────────────────────────────────────────────
  const toRemove: EntityId[] = []
  for (const [bid, bdata] of state.bullets) {
    if (!world.hasEntity(bid)) { toRemove.push(bid); continue }
    const bt = world.getComponent<TransformComponent>(bid, 'Transform')
    if (!bt) { toRemove.push(bid); continue }
    bdata.life -= dt
    if (bdata.life <= 0) { world.destroyEntity(bid); toRemove.push(bid); continue }
    // bt.rotation holds the firing angle
    bt.x = wrap(bt.x + Math.sin(bt.rotation) * BULLET_SPD * dt, CANVAS_W)
    bt.y = wrap(bt.y - Math.cos(bt.rotation) * BULLET_SPD * dt, CANVAS_H)
  }
  for (const bid of toRemove) state.bullets.delete(bid)

  // ── Ship-asteroid collision ────────────────────────────────────────────────
  if (!state.isInvincible) {
    for (const eid of world.query('Tag', 'Transform')) {
      if (!world.hasEntity(eid)) continue
      const tag = world.getComponent<{ type: 'Tag'; tags: string[] }>(eid, 'Tag')
      if (!tag?.tags.includes('asteroid')) continue
      const at = world.getComponent<TransformComponent>(eid, 'Transform')
      const sp = world.getComponent<SpriteComponent>(eid, 'Sprite')
      if (!at || !sp) continue
      const ar = sp.width / 2
      const dx = transform.x - at.x
      const dy = transform.y - at.y
      if (Math.sqrt(dx * dx + dy * dy) < SHIP_R + ar) {
        state.isInvincible    = true
        state.invincibleTimer = INVINCIBLE_T
        state.flashTimer      = 0.1
        state.vx = 0; state.vy = 0
        gameEvents.onDeath?.()
        break
      }
    }
  }
}

// ─── Component ────────────────────────────────────────────────────────────────
export function Ship() {
  return (
    <Entity id="ship" tags={['ship']}>
      <Transform x={CANVAS_W / 2} y={CANVAS_H / 2} />
      <Sprite width={18} height={26} color="#4fc3f7" zIndex={10} />
      <Script init={shipInit} update={shipUpdate} />
    </Entity>
  )
}
