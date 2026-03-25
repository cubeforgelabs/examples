import { useState, useEffect, useRef, useCallback } from 'react'
import { Game, World, Camera2D, Entity, Transform, Sprite } from '@cubeforge/react'

// ─── Constants ────────────────────────────────────────────────────────────────
const W = 640
const H = 480
const PW = 14
const PH = 20
const GRAVITY = 800
const MOVE_SPEED = 140
const JUMP_VEL = -380
const DASH_VEL = 320
const DASH_DUR = 0.18
const WALL_JUMP_VEL_X = 200
const WALL_JUMP_VEL_Y = -320
const MAX_HP = 6
const HURT_COOLDOWN = 1.2

// ─── Types ────────────────────────────────────────────────────────────────────
interface Rect { x: number; y: number; w: number; h: number }

interface Platform extends Rect { color: string }
interface Door {
  x: number; y: number; w: number; h: number
  requires: 'doubleJump' | 'dash' | 'wallJump'
  color: string
  open: boolean
  id: string
}
interface AbilityPickup {
  x: number; y: number; w: number; h: number
  ability: 'doubleJump' | 'dash' | 'wallJump'
  color: string
  id: string
  collected: boolean
}
interface Enemy {
  id: string
  x: number; y: number; vx: number; vy: number
  w: number; h: number
  hp: number; maxHp: number
  patrolLeft: number; patrolRight: number
  color: string
  type: 'walker' | 'flyer' | 'jumper'
  hurtTimer: number
  dead: boolean
}
interface RoomDef {
  id: number
  x: number; y: number        // world position of room top-left
  w: number; h: number
  bg: string
  platforms: Platform[]
  doors: { id: string; requires: 'doubleJump' | 'dash' | 'wallJump'; side: 'left' | 'right' | 'top' | 'bottom' }[]
  connects: { roomId: number; side: 'left' | 'right' | 'top' | 'bottom'; offset: number }[]
  abilities: { id: string; ability: 'doubleJump' | 'dash' | 'wallJump'; px: number; py: number }[]
  enemies: { id: string; px: number; py: number; type: 'walker' | 'flyer' | 'jumper'; left: number; right: number }[]
  playerSpawnX: number
  playerSpawnY: number
}

// ─── Room Layout ─────────────────────────────────────────────────────────────
// 8 rooms, laid out in a cross pattern:
//         [7]
//          |
//  [4]-[0]-[1]-[2]
//              |
//             [3]
//              |
//  [5]-[6] (reached via dash door from 3)
//
// Room 0: Start room (center)
// Room 1: right of 0
// Room 2: right of 1 (needs no gate)
// Room 3: below 2 (doubleJump door)
// Room 4: left of 0
// Room 5: below-left area (dash door from room 6)
// Room 6: below room 3 (wallJump door coming down from 3)
// Room 7: above room 0 (doubleJump door going up)

const ROOM_W = 640
const ROOM_H = 480

const ROOMS: RoomDef[] = [
  // Room 0 — start
  {
    id: 0,
    x: 0, y: 0, w: ROOM_W, h: ROOM_H,
    bg: '#0d1117',
    platforms: [
      { x: 0, y: 460, w: 640, h: 20, color: '#1e2535' },
      { x: 80, y: 360, w: 120, h: 14, color: '#263040' },
      { x: 350, y: 320, w: 100, h: 14, color: '#263040' },
      { x: 500, y: 260, w: 80, h: 14, color: '#263040' },
    ],
    doors: [],
    connects: [
      { roomId: 1, side: 'right', offset: 0 },
      { roomId: 4, side: 'left', offset: 0 },
      { roomId: 7, side: 'top', offset: 0 },
    ],
    abilities: [],
    enemies: [
      { id: 'e0-0', px: 300, py: 430, type: 'walker', left: 150, right: 490 },
    ],
    playerSpawnX: 80,
    playerSpawnY: 420,
  },
  // Room 1 — right of 0
  {
    id: 1,
    x: ROOM_W, y: 0, w: ROOM_W, h: ROOM_H,
    bg: '#0d1219',
    platforms: [
      { x: 0, y: 460, w: 640, h: 20, color: '#1e2535' },
      { x: 100, y: 380, w: 140, h: 14, color: '#263040' },
      { x: 320, y: 300, w: 100, h: 14, color: '#263040' },
      { x: 480, y: 220, w: 120, h: 14, color: '#263040' },
      { x: 200, y: 200, w: 80, h: 14, color: '#263040' },
    ],
    doors: [],
    connects: [
      { roomId: 0, side: 'left', offset: 0 },
      { roomId: 2, side: 'right', offset: 0 },
    ],
    abilities: [],
    enemies: [
      { id: 'e1-0', px: 250, py: 430, type: 'walker', left: 80, right: 500 },
      { id: 'e1-1', px: 400, py: 270, type: 'flyer', left: 300, right: 560 },
    ],
    playerSpawnX: 40,
    playerSpawnY: 420,
  },
  // Room 2 — right of 1
  {
    id: 2,
    x: ROOM_W * 2, y: 0, w: ROOM_W, h: ROOM_H,
    bg: '#0d1520',
    platforms: [
      { x: 0, y: 460, w: 640, h: 20, color: '#1e2535' },
      { x: 60, y: 380, w: 160, h: 14, color: '#263040' },
      { x: 280, y: 300, w: 120, h: 14, color: '#263040' },
      { x: 460, y: 220, w: 100, h: 14, color: '#263040' },
    ],
    doors: [
      { id: 'd2-down', requires: 'doubleJump', side: 'bottom', offset: 0 },
    ],
    connects: [
      { roomId: 1, side: 'left', offset: 0 },
      { roomId: 3, side: 'bottom', offset: 0 },
    ],
    abilities: [],
    enemies: [
      { id: 'e2-0', px: 200, py: 430, type: 'jumper', left: 60, right: 420 },
      { id: 'e2-1', px: 480, py: 190, type: 'walker', left: 420, right: 580 },
    ],
    playerSpawnX: 40,
    playerSpawnY: 420,
  },
  // Room 3 — below room 2 (doubleJump needed to get back up)
  {
    id: 3,
    x: ROOM_W * 2, y: ROOM_H, w: ROOM_W, h: ROOM_H,
    bg: '#100d17',
    platforms: [
      { x: 0, y: 460, w: 640, h: 20, color: '#1e2535' },
      { x: 100, y: 360, w: 160, h: 14, color: '#2a1f3a' },
      { x: 350, y: 280, w: 120, h: 14, color: '#2a1f3a' },
      { x: 500, y: 200, w: 100, h: 14, color: '#2a1f3a' },
    ],
    doors: [
      { id: 'd3-down', requires: 'wallJump', side: 'bottom', offset: 0 },
    ],
    connects: [
      { roomId: 2, side: 'top', offset: 0 },
      { roomId: 6, side: 'bottom', offset: 0 },
    ],
    abilities: [
      { id: 'a-dj', ability: 'doubleJump', px: 320, py: 250 },
    ],
    enemies: [
      { id: 'e3-0', px: 200, py: 430, type: 'walker', left: 50, right: 550 },
      { id: 'e3-1', px: 400, py: 250, type: 'flyer', left: 300, right: 580 },
    ],
    playerSpawnX: 300,
    playerSpawnY: 80,
  },
  // Room 4 — left of room 0
  {
    id: 4,
    x: -ROOM_W, y: 0, w: ROOM_W, h: ROOM_H,
    bg: '#0f120d',
    platforms: [
      { x: 0, y: 460, w: 640, h: 20, color: '#1e2535' },
      { x: 80, y: 360, w: 120, h: 14, color: '#1e2f1a' },
      { x: 300, y: 280, w: 100, h: 14, color: '#1e2f1a' },
      { x: 460, y: 360, w: 120, h: 14, color: '#1e2f1a' },
    ],
    doors: [],
    connects: [
      { roomId: 0, side: 'right', offset: 0 },
    ],
    abilities: [],
    enemies: [
      { id: 'e4-0', px: 150, py: 430, type: 'walker', left: 50, right: 400 },
      { id: 'e4-1', px: 450, py: 330, type: 'jumper', left: 380, right: 580 },
    ],
    playerSpawnX: 600,
    playerSpawnY: 420,
  },
  // Room 5 — (connected from 6 via dash door)
  {
    id: 5,
    x: ROOM_W, y: ROOM_H * 2, w: ROOM_W, h: ROOM_H,
    bg: '#1a0d10',
    platforms: [
      { x: 0, y: 460, w: 640, h: 20, color: '#1e2535' },
      { x: 60, y: 380, w: 140, h: 14, color: '#3a1e22' },
      { x: 280, y: 300, w: 120, h: 14, color: '#3a1e22' },
      { x: 460, y: 220, w: 140, h: 14, color: '#3a1e22' },
    ],
    doors: [],
    connects: [
      { roomId: 6, side: 'right', offset: 0 },
    ],
    abilities: [],
    enemies: [
      { id: 'e5-0', px: 100, py: 430, type: 'walker', left: 30, right: 600 },
      { id: 'e5-1', px: 300, py: 270, type: 'flyer', left: 200, right: 560 },
      { id: 'e5-2', px: 500, py: 190, type: 'jumper', left: 380, right: 600 },
    ],
    playerSpawnX: 600,
    playerSpawnY: 420,
  },
  // Room 6 — below room 3, wallJump gate coming in
  {
    id: 6,
    x: ROOM_W * 2, y: ROOM_H * 2, w: ROOM_W, h: ROOM_H,
    bg: '#0d1720',
    platforms: [
      { x: 0, y: 460, w: 640, h: 20, color: '#1e2535' },
      { x: 100, y: 380, w: 120, h: 14, color: '#1a2f3a' },
      { x: 300, y: 300, w: 100, h: 14, color: '#1a2f3a' },
      { x: 460, y: 200, w: 120, h: 14, color: '#1a2f3a' },
    ],
    doors: [
      { id: 'd6-left', requires: 'dash', side: 'left', offset: 0 },
    ],
    connects: [
      { roomId: 3, side: 'top', offset: 0 },
      { roomId: 5, side: 'left', offset: 0 },
    ],
    abilities: [
      { id: 'a-wj', ability: 'wallJump', px: 480, py: 170 },
    ],
    enemies: [
      { id: 'e6-0', px: 200, py: 430, type: 'walker', left: 50, right: 580 },
      { id: 'e6-1', px: 350, py: 270, type: 'jumper', left: 200, right: 500 },
    ],
    playerSpawnX: 300,
    playerSpawnY: 80,
  },
  // Room 7 — above room 0 (doubleJump gate going up)
  {
    id: 7,
    x: 0, y: -ROOM_H, w: ROOM_W, h: ROOM_H,
    bg: '#0d1a14',
    platforms: [
      { x: 0, y: 460, w: 640, h: 20, color: '#1e2535' },
      { x: 100, y: 360, w: 140, h: 14, color: '#1a3025' },
      { x: 340, y: 280, w: 120, h: 14, color: '#1a3025' },
      { x: 500, y: 180, w: 120, h: 14, color: '#1a3025' },
    ],
    doors: [
      { id: 'd7-bottom', requires: 'doubleJump', side: 'bottom', offset: 0 },
    ],
    connects: [
      { roomId: 0, side: 'bottom', offset: 0 },
    ],
    abilities: [
      { id: 'a-dash', ability: 'dash', px: 320, py: 250 },
    ],
    enemies: [
      { id: 'e7-0', px: 200, py: 430, type: 'walker', left: 60, right: 520 },
      { id: 'e7-1', px: 400, py: 250, type: 'flyer', left: 250, right: 580 },
    ],
    playerSpawnX: 300,
    playerSpawnY: 400,
  },
]

// Ability colors
const ABILITY_COLORS: Record<string, string> = {
  doubleJump: '#42a5f5',
  dash: '#ff7043',
  wallJump: '#66bb6a',
}
const DOOR_COLORS: Record<string, string> = {
  doubleJump: '#1565c0',
  dash: '#bf360c',
  wallJump: '#1b5e20',
}

// ─── Physics helpers ──────────────────────────────────────────────────────────
function overlaps(a: Rect, b: Rect) {
  return a.x < b.x + b.w && a.x + a.w > b.x && a.y < b.y + b.h && a.y + a.h > b.y
}

function resolveAABB(movingRect: { x: number; y: number; w: number; h: number; vx: number; vy: number },
  platforms: Platform[]): { x: number; y: number; vx: number; vy: number; onGround: boolean; onWallLeft: boolean; onWallRight: boolean } {
  let { x, y, vx, vy, w, h } = movingRect
  let onGround = false
  let onWallLeft = false
  let onWallRight = false

  // Move X first
  x += vx / 60
  for (const p of platforms) {
    if (overlaps({ x, y, w, h }, p)) {
      if (vx > 0) { x = p.x - w; onWallRight = true }
      else if (vx < 0) { x = p.x + p.w; onWallLeft = true }
      vx = 0
    }
  }

  // Move Y
  y += vy / 60
  for (const p of platforms) {
    if (overlaps({ x, y, w, h }, p)) {
      if (vy > 0) { y = p.y - h; onGround = true }
      else if (vy < 0) { y = p.y + p.h }
      vy = 0
    }
  }

  return { x, y, vx, vy, onGround, onWallLeft, onWallRight }
}

// ─── State ────────────────────────────────────────────────────────────────────
interface GameState {
  px: number; py: number
  pvx: number; pvy: number
  onGround: boolean
  onWallLeft: boolean
  onWallRight: boolean
  facingRight: boolean
  jumpCount: number
  dashing: boolean
  dashTimer: number
  dashDir: number
  hurtTimer: number
  hp: number
  abilities: Set<string>
  currentRoom: number
  collectedAbilities: Set<string>
  deadEnemies: Set<string>
  openDoors: Set<string>
  gameOver: boolean
  win: boolean
  attacking: boolean
  attackTimer: number
  attackDir: number
}

function makeEnemies(roomDef: RoomDef): Enemy[] {
  return roomDef.enemies.map(e => ({
    id: e.id,
    x: e.px - 12, y: e.py - 14, vx: e.type === 'walker' ? 60 : e.type === 'jumper' ? 80 : 40,
    vy: 0,
    w: 24, h: 14,
    hp: e.type === 'flyer' ? 2 : 3,
    maxHp: e.type === 'flyer' ? 2 : 3,
    patrolLeft: e.left, patrolRight: e.right,
    color: e.type === 'walker' ? '#ef5350' : e.type === 'flyer' ? '#ce93d8' : '#ff8f00',
    type: e.type,
    hurtTimer: 0,
    dead: false,
  }))
}

// ─── App ─────────────────────────────────────────────────────────────────────
export function App() {
  const W_CANVAS = W
  const H_CANVAS = H

  const stateRef = useRef<GameState>({
    px: 80, py: 420,
    pvx: 0, pvy: 0,
    onGround: false,
    onWallLeft: false, onWallRight: false,
    facingRight: true,
    jumpCount: 0,
    dashing: false, dashTimer: 0, dashDir: 1,
    hurtTimer: 0, hp: MAX_HP,
    abilities: new Set(),
    currentRoom: 0,
    collectedAbilities: new Set(),
    deadEnemies: new Set(),
    openDoors: new Set(),
    gameOver: false,
    win: false,
    attacking: false,
    attackTimer: 0,
    attackDir: 1,
  })

  const keysRef = useRef<Set<string>>(new Set())
  const justPressedRef = useRef<Set<string>>(new Set())

  const enemiesRef = useRef<Map<number, Enemy[]>>(new Map())

  // Initialize enemies for each room
  useEffect(() => {
    ROOMS.forEach(r => {
      enemiesRef.current.set(r.id, makeEnemies(r))
    })
  }, [])

  // Render tick to force re-renders
  const [tick, setTick] = useState(0)
  const [gameKey, setGameKey] = useState(0)

  // Doors and abilities derived from state
  const doorsRef = useRef<Map<string, Door>>(new Map())
  const abilitiesRef = useRef<Map<string, AbilityPickup>>(new Map())

  useEffect(() => {
    // Build doors and ability pickups
    ROOMS.forEach(room => {
      room.doors.forEach(d => {
        const doorW = 16
        const doorH = 80
        let dx = 0, dy = 0
        if (d.side === 'left') { dx = 0; dy = room.h / 2 - doorH / 2 + d.offset }
        else if (d.side === 'right') { dx = room.w - doorW; dy = room.h / 2 - doorH / 2 + d.offset }
        else if (d.side === 'top') { dx = room.w / 2 - 40 + d.offset; dy = 0; }
        else if (d.side === 'bottom') { dx = room.w / 2 - 40 + d.offset; dy = room.h - doorW; }
        doorsRef.current.set(d.id, {
          x: room.x + dx, y: room.y + dy,
          w: d.side === 'top' || d.side === 'bottom' ? 80 : doorW,
          h: d.side === 'top' || d.side === 'bottom' ? doorW : doorH,
          requires: d.requires,
          color: DOOR_COLORS[d.requires],
          open: false,
          id: d.id,
        })
      })
      room.abilities.forEach(a => {
        abilitiesRef.current.set(a.id, {
          x: room.x + a.px - 10, y: room.y + a.py - 10,
          w: 20, h: 20,
          ability: a.ability,
          color: ABILITY_COLORS[a.ability],
          id: a.id,
          collected: false,
        })
      })
    })
  }, [gameKey])

  // Input
  useEffect(() => {
    const onDown = (e: KeyboardEvent) => {
      if (['ArrowLeft','ArrowRight','ArrowUp','ArrowDown','KeyA','KeyD','KeyW','KeyS',
           'Space','KeyX','KeyZ'].includes(e.code)) {
        e.preventDefault()
      }
      keysRef.current.add(e.code)
      justPressedRef.current.add(e.code)
    }
    const onUp = (e: KeyboardEvent) => { keysRef.current.delete(e.code) }
    window.addEventListener('keydown', onDown)
    window.addEventListener('keyup', onUp)
    return () => { window.removeEventListener('keydown', onDown); window.removeEventListener('keyup', onUp) }
  }, [gameKey])

  // Game loop
  useEffect(() => {
    let last = performance.now()
    let rafId: number

    function loop(now: number) {
      const dt = Math.min((now - last) / 1000, 0.05)
      last = now

      const s = stateRef.current
      if (s.gameOver || s.win) { setTick(t => t + 1); rafId = requestAnimationFrame(loop); return }

      const keys = keysRef.current
      const jp = justPressedRef.current

      const room = ROOMS[s.currentRoom]
      const roomEnemies = enemiesRef.current.get(s.currentRoom) ?? []

      // Open doors if ability acquired
      doorsRef.current.forEach(door => {
        if (s.abilities.has(door.requires)) door.open = true
      })

      // Attack
      if ((jp.has('KeyZ')) && !s.attacking) {
        s.attacking = true
        s.attackTimer = 0.25
        s.attackDir = s.facingRight ? 1 : -1
      }
      if (s.attacking) {
        s.attackTimer -= dt
        if (s.attackTimer <= 0) { s.attacking = false }
        // Check hits
        const attackBox = {
          x: s.attacking && s.attackDir > 0 ? s.px + PW : s.px - 28,
          y: s.py,
          w: 28, h: PH,
        }
        roomEnemies.forEach(enemy => {
          if (!enemy.dead && enemy.hurtTimer <= 0 && overlaps(attackBox, { x: enemy.x, y: enemy.y, w: enemy.w, h: enemy.h })) {
            enemy.hp--
            enemy.hurtTimer = 0.4
            if (enemy.hp <= 0) {
              enemy.dead = true
              s.deadEnemies.add(enemy.id)
            }
          }
        })
      }

      // Dash
      let dashingNow = s.dashing
      if (!s.dashing && jp.has('KeyX') && s.abilities.has('dash')) {
        s.dashing = true
        s.dashTimer = DASH_DUR
        s.dashDir = s.facingRight ? 1 : -1
        s.pvy = 0
      }
      if (s.dashing) {
        s.dashTimer -= dt
        if (s.dashTimer <= 0) { s.dashing = false }
      }

      // Movement
      let vx = s.pvx
      let vy = s.pvy

      if (s.dashing) {
        vx = DASH_VEL * s.dashDir
        vy = 0
      } else {
        const left = keys.has('ArrowLeft') || keys.has('KeyA')
        const right = keys.has('ArrowRight') || keys.has('KeyD')
        vx = left ? -MOVE_SPEED : right ? MOVE_SPEED : 0
        if (vx > 0) s.facingRight = true
        if (vx < 0) s.facingRight = false

        // Jump
        const jumpPressed = jp.has('Space') || jp.has('ArrowUp') || jp.has('KeyW')
        if (jumpPressed) {
          if (s.onGround) {
            vy = JUMP_VEL
            s.jumpCount = 1
          } else if ((s.onWallLeft || s.onWallRight) && s.abilities.has('wallJump')) {
            vy = WALL_JUMP_VEL_Y
            vx = s.onWallLeft ? WALL_JUMP_VEL_X : -WALL_JUMP_VEL_X
            s.jumpCount = 1
          } else if (s.jumpCount < 2 && s.abilities.has('doubleJump')) {
            vy = JUMP_VEL
            s.jumpCount = 2
          }
        }

        vy += GRAVITY * dt
      }

      // Clamp to room bounds (world coords)
      const allPlats = room.platforms.map(p => ({
        ...p, x: room.x + p.x, y: room.y + p.y,
      }))
      // Room walls/ceiling/floor (as platforms)
      const walls: Platform[] = [
        { x: room.x - 20, y: room.y, w: 20, h: room.h + 20, color: '' },
        { x: room.x + room.w, y: room.y, w: 20, h: room.h + 20, color: '' },
        { x: room.x, y: room.y - 20, w: room.w, h: 20, color: '' },
        { x: room.x, y: room.y + room.h, w: room.w, h: 20, color: '' },
      ]

      // Add closed doors as walls
      const closedDoorWalls: Platform[] = []
      doorsRef.current.forEach(door => {
        if (!door.open) {
          closedDoorWalls.push({ x: door.x, y: door.y, w: door.w, h: door.h, color: '' })
        }
      })

      const resolved = resolveAABB(
        { x: s.px, y: s.py, w: PW, h: PH, vx, vy },
        [...allPlats, ...walls, ...closedDoorWalls]
      )

      s.px = resolved.x
      s.py = resolved.y
      s.pvx = resolved.vx
      s.pvy = resolved.vy
      s.onGround = resolved.onGround
      s.onWallLeft = resolved.onWallLeft
      s.onWallRight = resolved.onWallRight
      if (s.onGround) s.jumpCount = 0

      // Hurt timer
      if (s.hurtTimer > 0) s.hurtTimer -= dt

      // Collect abilities
      abilitiesRef.current.forEach(pickup => {
        if (!pickup.collected && overlaps({ x: s.px, y: s.py, w: PW, h: PH }, pickup)) {
          pickup.collected = true
          s.abilities.add(pickup.ability)
          s.collectedAbilities.add(pickup.id)
        }
      })

      // Update enemies
      roomEnemies.forEach(enemy => {
        if (enemy.dead) return
        if (enemy.hurtTimer > 0) enemy.hurtTimer -= dt

        if (enemy.type === 'walker' || enemy.type === 'jumper') {
          enemy.x += enemy.vx * dt
          if (enemy.type === 'walker') {
            enemy.vy += GRAVITY * dt
            enemy.y += enemy.vy * dt
            // Floor
            const floor = room.y + room.h - 20
            if (enemy.y + enemy.h >= floor) { enemy.y = floor - enemy.h; enemy.vy = 0 }
            if (enemy.type === 'walker' && Math.random() < 0.01 && enemy.vy === 0) {
              // Occasionally the jumper jumps handled below
            }
          }
          if (enemy.type === 'jumper') {
            enemy.vy += GRAVITY * dt
            enemy.y += enemy.vy * dt
            const floor = room.y + room.h - 20
            if (enemy.y + enemy.h >= floor) { enemy.y = floor - enemy.h; enemy.vy = 0; if (Math.random() < 0.03) enemy.vy = -250 }
          }
          if (enemy.x <= room.x + enemy.patrolLeft) { enemy.vx = Math.abs(enemy.vx); }
          if (enemy.x + enemy.w >= room.x + enemy.patrolRight) { enemy.vx = -Math.abs(enemy.vx); }
        } else if (enemy.type === 'flyer') {
          enemy.x += enemy.vx * dt
          enemy.y += Math.sin(Date.now() / 600 + enemy.x * 0.01) * 0.8
          if (enemy.x <= room.x + enemy.patrolLeft) enemy.vx = Math.abs(enemy.vx)
          if (enemy.x + enemy.w >= room.x + enemy.patrolRight) enemy.vx = -Math.abs(enemy.vx)
        }

        // Enemy hurts player
        if (s.hurtTimer <= 0 && overlaps({ x: s.px, y: s.py, w: PW, h: PH }, { x: enemy.x, y: enemy.y, w: enemy.w, h: enemy.h })) {
          s.hp--
          s.hurtTimer = HURT_COOLDOWN
          if (s.hp <= 0) s.gameOver = true
        }
      })

      // Room transitions
      const playerCenter = { x: s.px + PW / 2, y: s.py + PH / 2 }
      for (const conn of room.connects) {
        let triggered = false
        let spawnX = 0, spawnY = 0
        const targetRoom = ROOMS[conn.roomId]

        if (conn.side === 'right' && playerCenter.x >= room.x + room.w - 5) {
          // Check door
          const door = [...doorsRef.current.values()].find(d => d.id.startsWith(`d${conn.roomId}-`) || d.id.startsWith(`d${room.id}-right`))
          if (door && !door.open) { /* blocked */ } else {
            triggered = true
            spawnX = targetRoom.x + targetRoom.playerSpawnX
            spawnY = targetRoom.y + targetRoom.playerSpawnY
          }
        }
        if (conn.side === 'left' && playerCenter.x <= room.x + 5) {
          triggered = true
          spawnX = targetRoom.x + targetRoom.playerSpawnX
          spawnY = targetRoom.y + targetRoom.playerSpawnY
        }
        if (conn.side === 'bottom' && playerCenter.y >= room.y + room.h - 5) {
          // Check for bottom door in this room
          const bottomDoor = [...doorsRef.current.values()].find(d => d.id === `d${room.id}-down` || d.id === `d${room.id}-bottom`)
          if (bottomDoor && !bottomDoor.open) { /* blocked */ } else {
            triggered = true
            spawnX = targetRoom.x + targetRoom.playerSpawnX
            spawnY = targetRoom.y + targetRoom.playerSpawnY
          }
        }
        if (conn.side === 'top' && playerCenter.y <= room.y + 5) {
          // Check for gate up from above room
          const topDoor = [...doorsRef.current.values()].find(d => d.id === `d${room.id}-bottom` || d.id === `d${targetRoom.id}-bottom`)
          if (topDoor && !topDoor.open) { /* blocked */ } else {
            triggered = true
            spawnX = targetRoom.x + targetRoom.playerSpawnX
            spawnY = targetRoom.y + targetRoom.playerSpawnY
          }
        }

        if (triggered) {
          s.currentRoom = conn.roomId
          s.px = spawnX
          s.py = spawnY
          s.pvx = 0; s.pvy = 0
          break
        }
      }

      // Win condition - collected all 3 abilities
      if (s.abilities.size >= 3 && !s.win) {
        s.win = true
      }

      justPressedRef.current.clear()
      setTick(t => t + 1)
      rafId = requestAnimationFrame(loop)
    }

    rafId = requestAnimationFrame(loop)
    return () => cancelAnimationFrame(rafId)
  }, [gameKey])

  function restart() {
    stateRef.current = {
      px: 80, py: 420,
      pvx: 0, pvy: 0,
      onGround: false,
      onWallLeft: false, onWallRight: false,
      facingRight: true,
      jumpCount: 0,
      dashing: false, dashTimer: 0, dashDir: 1,
      hurtTimer: 0, hp: MAX_HP,
      abilities: new Set(),
      currentRoom: 0,
      collectedAbilities: new Set(),
      deadEnemies: new Set(),
      openDoors: new Set(),
      gameOver: false,
      win: false,
      attacking: false,
      attackTimer: 0,
      attackDir: 1,
    }
    // Reset enemies
    ROOMS.forEach(r => enemiesRef.current.set(r.id, makeEnemies(r)))
    // Reset doors & abilities
    doorsRef.current.clear()
    abilitiesRef.current.clear()
    ROOMS.forEach(room => {
      room.doors.forEach(d => {
        const doorW = 16, doorH = 80
        let dx = 0, dy = 0
        if (d.side === 'left') { dx = 0; dy = room.h / 2 - doorH / 2 + d.offset }
        else if (d.side === 'right') { dx = room.w - doorW; dy = room.h / 2 - doorH / 2 + d.offset }
        else if (d.side === 'top') { dx = room.w / 2 - 40 + d.offset; dy = 0 }
        else if (d.side === 'bottom') { dx = room.w / 2 - 40 + d.offset; dy = room.h - doorW }
        doorsRef.current.set(d.id, {
          x: room.x + dx, y: room.y + dy,
          w: d.side === 'top' || d.side === 'bottom' ? 80 : doorW,
          h: d.side === 'top' || d.side === 'bottom' ? doorW : doorH,
          requires: d.requires, color: DOOR_COLORS[d.requires],
          open: false, id: d.id,
        })
      })
      room.abilities.forEach(a => {
        abilitiesRef.current.set(a.id, {
          x: room.x + a.px - 10, y: room.y + a.py - 10,
          w: 20, h: 20, ability: a.ability,
          color: ABILITY_COLORS[a.ability], id: a.id, collected: false,
        })
      })
    })
    keysRef.current.clear()
    justPressedRef.current.clear()
    setGameKey(k => k + 1)
  }

  const s = stateRef.current
  const room = ROOMS[s.currentRoom]
  const roomEnemies = (enemiesRef.current.get(s.currentRoom) ?? []).filter(e => !e.dead)

  // Camera: follow player but clamp to room bounds
  const camX = Math.max(W_CANVAS / 2, Math.min(room.x + room.w - W_CANVAS / 2,
    s.px + PW / 2))
  const camY = Math.max(H_CANVAS / 2, Math.min(room.y + room.h - H_CANVAS / 2,
    s.py + PH / 2))

  // World-to-screen
  const wx = (wx: number) => wx - camX + W_CANVAS / 2
  const wy = (wy: number) => wy - camY + H_CANVAS / 2

  // Mini-map data
  const roomPositions: Record<number, { mx: number; my: number }> = {
    0: { mx: 2, my: 1 }, 1: { mx: 3, my: 1 }, 2: { mx: 4, my: 1 },
    3: { mx: 4, my: 2 }, 4: { mx: 1, my: 1 },
    5: { mx: 2, my: 3 }, 6: { mx: 4, my: 3 }, 7: { mx: 2, my: 0 },
  }
  const visited = new Set<number>()
  visited.add(s.currentRoom)
  // Mark adjacent rooms as visited (simplification - all reachable from current)
  ROOMS[s.currentRoom].connects.forEach(c => visited.add(c.roomId))

  const playerFlash = s.hurtTimer > 0 && Math.floor(s.hurtTimer * 8) % 2 === 0

  // Visible platforms / doors / pickups
  const visPlats = room.platforms.map((p, i) => ({
    ...p, wx: room.x + p.x + p.w / 2, wy: room.y + p.y + p.h / 2, key: `plat-${i}`,
  }))

  const visEnemies = roomEnemies
  const visPickups = [...abilitiesRef.current.values()].filter(a => !a.collected && ROOMS.findIndex(r => r.id === s.currentRoom) === ROOMS.findIndex(r => r.abilities.some(ab => ab.id === a.id)))
  const visDoors = [...doorsRef.current.values()].filter(d => !d.open && ROOMS[s.currentRoom].doors.some(rd => rd.id === d.id))

  return (
    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 0, fontFamily: '"Courier New", monospace' }}>
      {/* HUD */}
      <div style={{
        width: W_CANVAS, display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        padding: '6px 16px', background: '#0d0f1a', borderRadius: '10px 10px 0 0',
        fontSize: 12, color: '#90a4ae', letterSpacing: 1, userSelect: 'none',
      }}>
        <div style={{ display: 'flex', gap: 3 }}>
          {Array.from({ length: MAX_HP }, (_, i) => (
            <span key={i} style={{ color: i < s.hp ? '#ef5350' : '#37474f', fontSize: 14 }}>♥</span>
          ))}
        </div>
        <div style={{ display: 'flex', gap: 10 }}>
          {(['doubleJump', 'dash', 'wallJump'] as const).map(ab => (
            <span key={ab} style={{
              padding: '2px 6px', borderRadius: 4,
              background: s.abilities.has(ab) ? ABILITY_COLORS[ab] + '33' : '#1e2535',
              border: `1px solid ${s.abilities.has(ab) ? ABILITY_COLORS[ab] : '#2a3344'}`,
              color: s.abilities.has(ab) ? ABILITY_COLORS[ab] : '#3a4a5a',
              fontSize: 10,
            }}>
              {ab === 'doubleJump' ? '2xJUMP' : ab === 'dash' ? 'DASH' : 'WALLJUMP'}
            </span>
          ))}
        </div>
        <div style={{ fontSize: 11, color: '#607d8b' }}>ROOM {s.currentRoom + 1}/8</div>
      </div>

      {/* Canvas */}
      <div style={{ position: 'relative', width: W_CANVAS, height: H_CANVAS }}>
        <Game key={gameKey} width={W_CANVAS} height={H_CANVAS} gravity={0}>
          <World background={room.bg}>
            <Camera2D x={camX} y={camY} background={room.bg} />

            {/* Room floor/ceiling/walls as sprite entities */}
            <Entity id="floor"><Transform x={room.x + room.w / 2} y={room.y + room.h + 10} /><Sprite width={room.w} height={20} color="#1e2535" zIndex={1} /></Entity>
            <Entity id="ceil"><Transform x={room.x + room.w / 2} y={room.y - 10} /><Sprite width={room.w} height={20} color="#1e2535" zIndex={1} /></Entity>
            <Entity id="wallL"><Transform x={room.x - 10} y={room.y + room.h / 2} /><Sprite width={20} height={room.h} color="#1e2535" zIndex={1} /></Entity>
            <Entity id="wallR"><Transform x={room.x + room.w + 10} y={room.y + room.h / 2} /><Sprite width={20} height={room.h} color="#1e2535" zIndex={1} /></Entity>

            {/* Platforms */}
            {visPlats.map(p => (
              <Entity key={p.key} id={p.key}>
                <Transform x={p.wx} y={p.wy} />
                <Sprite width={p.w} height={p.h} color={p.color} zIndex={1} />
              </Entity>
            ))}

            {/* Doors */}
            {visDoors.map(d => (
              <Entity key={d.id} id={d.id}>
                <Transform x={d.x + d.w / 2} y={d.y + d.h / 2} />
                <Sprite width={d.w} height={d.h} color={d.color} zIndex={2} />
              </Entity>
            ))}

            {/* Ability pickups */}
            {[...abilitiesRef.current.values()].filter(a => !a.collected).map(a => {
              const thisRoom = ROOMS.find(r => r.id === s.currentRoom)
              if (!thisRoom?.abilities.some(ab => ab.id === a.id)) return null
              return (
                <Entity key={a.id} id={a.id}>
                  <Transform x={a.x + a.w / 2} y={a.y + a.h / 2} />
                  <Sprite width={a.w} height={a.h} color={a.color} zIndex={3} />
                </Entity>
              )
            })}

            {/* Enemies */}
            {visEnemies.map(e => (
              <Entity key={e.id} id={e.id}>
                <Transform x={e.x + e.w / 2} y={e.y + e.h / 2} />
                <Sprite width={e.w} height={e.h}
                  color={e.hurtTimer > 0 ? '#ffffff' : e.color} zIndex={2} />
              </Entity>
            ))}

            {/* Player */}
            {!playerFlash && (
              <Entity id="player">
                <Transform x={s.px + PW / 2} y={s.py + PH / 2} />
                <Sprite width={PW} height={PH} color={s.dashing ? '#80deea' : '#26c6da'} zIndex={5} />
              </Entity>
            )}

            {/* Attack hitbox visual */}
            {s.attacking && (
              <Entity id="attack-box">
                <Transform
                  x={(s.attackDir > 0 ? s.px + PW + 14 : s.px - 14)}
                  y={s.py + PH / 2}
                />
                <Sprite width={28} height={PH} color="#ffd54f44" zIndex={4} />
              </Entity>
            )}
          </World>
        </Game>

        {/* Enemy HP bars (overlay) */}
        {visEnemies.map(e => {
          const sx = wx(e.x + e.w / 2) - 12
          const sy = wy(e.y) - 8
          return (
            <div key={`hp-${e.id}`} style={{
              position: 'absolute', left: sx, top: sy,
              width: 24, height: 4, background: '#1e2535', borderRadius: 2, pointerEvents: 'none',
            }}>
              <div style={{
                width: `${(e.hp / e.maxHp) * 100}%`, height: '100%',
                background: '#ef5350', borderRadius: 2, transition: 'width 0.1s',
              }} />
            </div>
          )
        })}

        {/* Ability pickup labels */}
        {[...abilitiesRef.current.values()].filter(a => !a.collected).map(a => {
          const thisRoom = ROOMS.find(r => r.id === s.currentRoom)
          if (!thisRoom?.abilities.some(ab => ab.id === a.id)) return null
          const sx = wx(a.x + a.w / 2) - 22
          const sy = wy(a.y) - 16
          return (
            <div key={`lbl-${a.id}`} style={{
              position: 'absolute', left: sx, top: sy,
              fontSize: 9, color: a.color, letterSpacing: 1,
              pointerEvents: 'none', textAlign: 'center', width: 44,
            }}>
              {a.ability === 'doubleJump' ? '2x JUMP' : a.ability === 'dash' ? 'DASH' : 'WALL JMP'}
            </div>
          )
        })}

        {/* Mini-map */}
        <div style={{
          position: 'absolute', bottom: 12, right: 12,
          background: 'rgba(13,15,26,0.85)', border: '1px solid #1e2535',
          borderRadius: 6, padding: 8, pointerEvents: 'none',
        }}>
          <div style={{ fontSize: 8, color: '#37474f', letterSpacing: 2, marginBottom: 4 }}>MAP</div>
          <div style={{ position: 'relative', width: 60, height: 48 }}>
            {ROOMS.map(r => {
              const mp = roomPositions[r.id]
              const isCurrent = r.id === s.currentRoom
              const isVisited = visited.has(r.id)
              return (
                <div key={r.id} style={{
                  position: 'absolute',
                  left: mp.mx * 12, top: mp.my * 12,
                  width: 10, height: 10,
                  background: isCurrent ? '#26c6da' : isVisited ? '#2a3a4a' : '#1a2030',
                  border: `1px solid ${isCurrent ? '#26c6da' : '#2a3a4a'}`,
                  borderRadius: 2,
                }} />
              )
            })}
          </div>
        </div>

        {/* Game Over overlay */}
        {s.gameOver && (
          <div style={overlayStyle}>
            <div style={cardStyle}>
              <p style={{ fontSize: 11, letterSpacing: 4, color: '#ef5350', marginBottom: 8 }}>DEFEATED</p>
              <p style={{ fontSize: 32, fontWeight: 900, color: '#fff', letterSpacing: 3 }}>GAME OVER</p>
              <p style={{ fontSize: 11, color: '#546e7a', margin: '12px 0' }}>
                Abilities: {s.abilities.size}/3
              </p>
              <button onClick={restart} style={btnStyle}>Try Again</button>
            </div>
          </div>
        )}

        {/* Win overlay */}
        {s.win && (
          <div style={overlayStyle}>
            <div style={cardStyle}>
              <p style={{ fontSize: 11, letterSpacing: 4, color: '#26c6da', marginBottom: 8 }}>ALL ABILITIES COLLECTED</p>
              <p style={{ fontSize: 32, fontWeight: 900, color: '#fff', letterSpacing: 3 }}>YOU WIN!</p>
              <p style={{ fontSize: 11, color: '#546e7a', margin: '12px 0' }}>
                Rooms explored: 8
              </p>
              <button onClick={restart} style={btnStyle}>Play Again</button>
            </div>
          </div>
        )}
      </div>

      {/* Controls */}
      <div style={{
        width: W_CANVAS, background: '#0d0f1a', borderRadius: '0 0 10px 10px',
        padding: '6px 16px', fontSize: 10, color: '#37474f', letterSpacing: 1.2,
        display: 'flex', justifyContent: 'space-between', userSelect: 'none',
      }}>
        <span>WASD/Arrows — move · Space — jump · X — dash · Z — attack</span>
        <span style={{ color: '#263238' }}>Cubeforge Engine</span>
      </div>
    </div>
  )
}

// ─── Styles ───────────────────────────────────────────────────────────────────
const overlayStyle: React.CSSProperties = {
  position: 'absolute', inset: 0, display: 'flex',
  alignItems: 'center', justifyContent: 'center',
  background: 'rgba(10,10,18,0.85)', backdropFilter: 'blur(4px)',
}
const cardStyle: React.CSSProperties = {
  textAlign: 'center', fontFamily: '"Courier New", monospace',
  padding: '36px 48px', background: '#0d0f1a',
  border: '1px solid #1e2535', borderRadius: 12,
}
const btnStyle: React.CSSProperties = {
  marginTop: 20, padding: '10px 28px', background: '#26c6da',
  color: '#0a0a0f', border: 'none', borderRadius: 6,
  fontFamily: '"Courier New", monospace', fontSize: 13,
  fontWeight: 700, letterSpacing: 2, cursor: 'pointer',
}
