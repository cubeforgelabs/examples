import { useEffect, useRef, useReducer, useState } from 'react'
import { Game, World, Camera2D, Entity, Transform, Sprite } from '@cubeforge/react'

// ─── Constants ────────────────────────────────────────────────────────────────
const W           = 360
const H           = 560
const GRAVITY     = 1100     // px/s²
const MOVE_SPEED  = 180      // px/s horizontal
const JUMP_VEL    = -430     // px/s upward
const WALL_SLIDE  = 60       // max downward speed while wall-sliding
const WALL_JUMP_VX = 220     // horizontal kick off wall
const WALL_JUMP_VY = -380    // vertical kick
const PLAYER_W    = 14
const PLAYER_H    = 18
const WALL_W      = 16       // thickness of side walls

// ─── Level design ─────────────────────────────────────────────────────────────
// Each "room" is H pixels tall in world space. We stack rooms upward.
// World Y increases downward. Room 0 is at bottom (world Y 0..H).
// Player starts at bottom, goal is to reach top of all rooms.

const ROOM_H      = H          // each room = one screen height
const NUM_ROOMS   = 6

interface Platform {
  x: number    // center X in room coords
  y: number    // center Y in room coords (from top of room, downward)
  w: number
  h: number
  color: string
}

interface Spike {
  x: number
  y: number
  w: number
  h: number
}

interface CheckpointDef {
  x: number
  y: number  // room-relative
}

interface RoomDef {
  platforms: Platform[]
  spikes:    Spike[]
  checkpoint: CheckpointDef | null
}

// Room Y in world: room index 0 = bottom, index (NUM_ROOMS-1) = top
// worldY of room top = totalH - (room+1)*ROOM_H

const TOTAL_H = NUM_ROOMS * ROOM_H

function roomWorldY(room: number): number {
  return TOTAL_H - (room + 1) * ROOM_H
}

const ROOMS: RoomDef[] = [
  // Room 0 — intro, wide platforms
  {
    platforms: [
      { x: W/2,  y: ROOM_H - 20, w: W,    h: 20,  color: '#1a2e1a' },   // floor
      { x: 100,  y: 380,          w: 80,   h: 14,  color: '#2a3a2a' },
      { x: 260,  y: 300,          w: 80,   h: 14,  color: '#2a3a2a' },
      { x: 100,  y: 220,          w: 80,   h: 14,  color: '#2a3a2a' },
      { x: 260,  y: 140,          w: 80,   h: 14,  color: '#2a3a2a' },
    ],
    spikes: [
      { x: 180, y: ROOM_H - 20, w: 40, h: 8 },
    ],
    checkpoint: { x: 260, y: 126 },
  },
  // Room 1 — narrower platforms, walls matter
  {
    platforms: [
      { x: W/2, y: ROOM_H - 10, w: W, h: 20, color: '#1a2e1a' },
      { x: 70,  y: 440,          w: 60, h: 14, color: '#2a3a2a' },
      { x: 250, y: 360,          w: 60, h: 14, color: '#2a3a2a' },
      { x: 80,  y: 280,          w: 60, h: 14, color: '#2a3a2a' },
      { x: 280, y: 200,          w: 60, h: 14, color: '#2a3a2a' },
      { x: 90,  y: 110,          w: 60, h: 14, color: '#2a3a2a' },
    ],
    spikes: [
      { x: 160, y: ROOM_H - 10, w: 60, h: 8 },
    ],
    checkpoint: { x: 90, y: 96 },
  },
  // Room 2 — wall-jump corridor
  {
    platforms: [
      { x: W/2,  y: ROOM_H - 10, w: W,  h: 20, color: '#1a2e1a' },
      { x: 70,   y: 440,          w: 60, h: 14, color: '#2a3a2a' },
      { x: 290,  y: 340,          w: 60, h: 14, color: '#2a3a2a' },
      { x: 70,   y: 240,          w: 60, h: 14, color: '#2a3a2a' },
      { x: 290,  y: 140,          w: 60, h: 14, color: '#2a3a2a' },
      { x: 180,  y: 60,           w: 80, h: 14, color: '#2a3a2a' },
    ],
    spikes: [
      { x: 160, y: ROOM_H - 10, w: 50, h: 8 },
      { x: 160, y: 246,          w: 40, h: 8 },
    ],
    checkpoint: { x: 180, y: 46 },
  },
  // Room 3 — tight gaps
  {
    platforms: [
      { x: W/2,  y: ROOM_H - 10, w: W,  h: 20, color: '#1e2a1e' },
      { x: 60,   y: 460,          w: 50, h: 14, color: '#2a3a2a' },
      { x: 200,  y: 400,          w: 50, h: 14, color: '#2a3a2a' },
      { x: 300,  y: 330,          w: 50, h: 14, color: '#2a3a2a' },
      { x: 120,  y: 260,          w: 50, h: 14, color: '#2a3a2a' },
      { x: 280,  y: 190,          w: 50, h: 14, color: '#2a3a2a' },
      { x: 80,   y: 120,          w: 50, h: 14, color: '#2a3a2a' },
      { x: 220,  y: 60,           w: 60, h: 14, color: '#2a3a2a' },
    ],
    spikes: [
      { x: 150, y: ROOM_H - 10, w: 50, h: 8 },
      { x: 300, y: 406,          w: 40, h: 8 },
    ],
    checkpoint: { x: 220, y: 46 },
  },
  // Room 4 — wall-reliant
  {
    platforms: [
      { x: W/2, y: ROOM_H - 10, w: W, h: 20, color: '#1e2a1e' },
      { x: 80,  y: 480,          w: 50, h: 14, color: '#2a3a2a' },
      { x: W/2, y: 380,          w: 50, h: 14, color: '#2a3a2a' },
      { x: 80,  y: 260,          w: 50, h: 14, color: '#2a3a2a' },
      { x: W/2, y: 160,          w: 50, h: 14, color: '#2a3a2a' },
      { x: 80,  y: 80,           w: 50, h: 14, color: '#2a3a2a' },
    ],
    spikes: [
      { x: 200, y: ROOM_H - 10, w: 60, h: 8 },
      { x: 260, y: 266,          w: 40, h: 8 },
    ],
    checkpoint: { x: 80, y: 66 },
  },
  // Room 5 — final challenge
  {
    platforms: [
      { x: W/2, y: ROOM_H - 10, w: W, h: 20, color: '#1e2a1e' },
      { x: 60,  y: 460,          w: 50, h: 14, color: '#2a3a2a' },
      { x: 300, y: 380,          w: 50, h: 14, color: '#2a3a2a' },
      { x: 60,  y: 300,          w: 50, h: 14, color: '#2a3a2a' },
      { x: 300, y: 220,          w: 50, h: 14, color: '#2a3a2a' },
      { x: 180, y: 140,          w: 50, h: 14, color: '#2a3a2a' },
      // Goal platform at top
      { x: W/2, y: 40,           w: 120, h: 14, color: '#ffd54f' },
    ],
    spikes: [
      { x: 160, y: ROOM_H - 10, w: 50, h: 8 },
      { x: 160, y: 306,          w: 40, h: 8 },
      { x: 160, y: 226,          w: 40, h: 8 },
    ],
    checkpoint: { x: W/2, y: 26 },
  },
]

// ─── Interfaces ───────────────────────────────────────────────────────────────
interface Rect {
  x: number; y: number; w: number; h: number
}

function rectsOverlap(a: Rect, b: Rect): boolean {
  return a.x < b.x + b.w && a.x + a.w > b.x &&
         a.y < b.y + b.h && a.y + a.h > b.y
}

interface GamePhysics {
  px: number; py: number    // player center in world coords
  vx: number; vy: number
  onGround: boolean
  onWallLeft: boolean       // touching left wall (WALL_W edge)
  onWallRight: boolean      // touching right side wall
  wallSliding: boolean
  facingRight: boolean
  // Camera
  camY: number              // world Y of camera center
  // Checkpoint
  checkX: number; checkY: number
  // Height score
  maxHeight: number         // max upward travel
}

function makePhysics(): GamePhysics {
  const startY = TOTAL_H - ROOM_H + 460
  return {
    px: W / 2, py: startY,
    vx: 0, vy: 0,
    onGround: false, onWallLeft: false, onWallRight: false,
    wallSliding: false, facingRight: true,
    camY: startY - 80,
    checkX: W / 2, checkY: startY,
    maxHeight: 0,
  }
}

// ─── Collect all platforms from all rooms into world coords ───────────────────
interface WorldPlatform extends Rect {
  color: string
  id: string
}

interface WorldSpike extends Rect {
  id: string
}

interface WorldCheckpoint {
  id: string
  x: number; y: number
  w: number; h: number
  room: number
}

function buildWorld() {
  const platforms: WorldPlatform[] = []
  const spikes: WorldSpike[] = []
  const checkpoints: WorldCheckpoint[] = []

  // Side walls
  platforms.push({ id: 'wall-l', x: 0, y: 0, w: WALL_W, h: TOTAL_H, color: '#1a1f2a' })
  platforms.push({ id: 'wall-r', x: W - WALL_W, y: 0, w: WALL_W, h: TOTAL_H, color: '#1a1f2a' })

  for (let r = 0; r < NUM_ROOMS; r++) {
    const def = ROOMS[r]
    const wy  = roomWorldY(r)

    for (let i = 0; i < def.platforms.length; i++) {
      const p = def.platforms[i]
      platforms.push({
        id:    `r${r}p${i}`,
        x:     p.x - p.w / 2,
        y:     wy + p.y - p.h / 2,
        w:     p.w,
        h:     p.h,
        color: p.color,
      })
    }

    for (let i = 0; i < def.spikes.length; i++) {
      const sp = def.spikes[i]
      spikes.push({
        id: `r${r}s${i}`,
        x:  sp.x - sp.w / 2,
        y:  wy + sp.y - sp.h / 2,
        w:  sp.w,
        h:  sp.h,
      })
    }

    if (def.checkpoint) {
      const cp = def.checkpoint
      checkpoints.push({
        id:   `r${r}cp`,
        x:    cp.x - 8,
        y:    wy + cp.y,
        w:    16,
        h:    20,
        room: r,
      })
    }
  }

  return { platforms, spikes, checkpoints }
}

const WORLD = buildWorld()
const ALL_PLATFORMS  = WORLD.platforms
const ALL_SPIKES     = WORLD.spikes
const ALL_CHECKPOINTS = WORLD.checkpoints

type GameState = 'idle' | 'playing' | 'win'

// ─── App ──────────────────────────────────────────────────────────────────────
export function App() {
  const [gameKey,   setGameKey]   = useState(0)
  const [score,     setScore]     = useState(0)
  const [gameState, setGameState] = useState<GameState>('idle')

  const physRef = useRef<GamePhysics>(makePhysics())
  const keysRef = useRef<Set<string>>(new Set())
  const visitedCheckpointsRef = useRef<Set<string>>(new Set())
  const [, tick] = useReducer(n => n + 1, 0)

  // ── Keyboard ──────────────────────────────────────────────────────────────
  useEffect(() => {
    const down = (e: KeyboardEvent) => {
      keysRef.current.add(e.code)
      if (['Space','ArrowUp','ArrowDown','ArrowLeft','ArrowRight'].includes(e.code)) {
        e.preventDefault()
      }
      if (gameState === 'idle' && (e.code === 'Space' || e.code === 'Enter')) start()
      if (gameState === 'win'  && (e.code === 'Space' || e.code === 'Enter')) start()
    }
    const up = (e: KeyboardEvent) => keysRef.current.delete(e.code)
    window.addEventListener('keydown', down)
    window.addEventListener('keyup', up)
    return () => {
      window.removeEventListener('keydown', down)
      window.removeEventListener('keyup', up)
    }
  }, [gameState]) // eslint-disable-line react-hooks/exhaustive-deps

  // ── rAF physics loop ──────────────────────────────────────────────────────
  useEffect(() => {
    if (gameState !== 'playing') return

    let prev  = performance.now()
    let rafId = 0

    const loop = (now: number) => {
      const dt   = Math.min((now - prev) / 1000, 0.05)
      prev = now

      const p    = physRef.current
      const keys = keysRef.current

      const leftKey  = keys.has('ArrowLeft')  || keys.has('KeyA')
      const rightKey = keys.has('ArrowRight') || keys.has('KeyD')
      const jumpKey  = keys.has('Space') || keys.has('ArrowUp') || keys.has('KeyW')

      // Horizontal
      if (leftKey)       { p.vx = -MOVE_SPEED; p.facingRight = false }
      else if (rightKey) { p.vx =  MOVE_SPEED; p.facingRight = true  }
      else               { p.vx = 0 }

      // Wall slide detection (will be set after collision)
      const wasOnWallLeft  = p.onWallLeft
      const wasOnWallRight = p.onWallRight

      // Gravity (reduced if wall sliding)
      const isSliding = (wasOnWallLeft || wasOnWallRight) && !p.onGround && p.vy > 0
      p.wallSliding = isSliding
      if (isSliding) {
        p.vy = Math.min(p.vy + GRAVITY * dt, WALL_SLIDE)
      } else {
        p.vy += GRAVITY * dt
      }
      p.vy = Math.min(p.vy, 900)

      // Wall jump
      const jumpPressed = keys.has('Space') || keys.has('ArrowUp') || keys.has('KeyW')
      if (jumpPressed && isSliding) {
        if (wasOnWallLeft) {
          p.vx = WALL_JUMP_VX
          p.facingRight = true
        } else {
          p.vx = -WALL_JUMP_VX
          p.facingRight = false
        }
        p.vy = WALL_JUMP_VY
        p.onGround = false
      } else if (jumpPressed && p.onGround) {
        p.vy = JUMP_VEL
        p.onGround = false
      }

      // Move
      let nx = p.px + p.vx * dt
      let ny = p.py + p.vy * dt

      // AABB vs platforms
      const pw2 = PLAYER_W / 2
      const ph2 = PLAYER_H / 2
      p.onGround     = false
      p.onWallLeft   = false
      p.onWallRight  = false

      // Resolve Y first
      for (const plat of ALL_PLATFORMS) {
        const playerRect: Rect = { x: nx - pw2, y: ny - ph2, w: PLAYER_W, h: PLAYER_H }
        if (!rectsOverlap(playerRect, plat)) continue

        if (p.vy >= 0) {
          // Moving down — land on top
          const prevBottom = p.py + ph2
          const platTop    = plat.y
          if (prevBottom <= platTop + 2) {
            ny         = plat.y - ph2
            p.vy       = 0
            p.onGround = true
          }
        }
        if (p.vy < 0) {
          // Moving up — hit underside
          const prevTop   = p.py - ph2
          const platBot   = plat.y + plat.h
          if (prevTop >= platBot - 2) {
            ny   = platBot + ph2
            p.vy = 0
          }
        }
      }

      // Resolve X
      for (const plat of ALL_PLATFORMS) {
        const playerRect: Rect = { x: nx - pw2, y: ny - ph2, w: PLAYER_W, h: PLAYER_H }
        if (!rectsOverlap(playerRect, plat)) continue

        if (p.vx > 0) {
          const prevRight = p.px + pw2
          const platLeft  = plat.x
          if (prevRight <= platLeft + 2) {
            nx = plat.x - pw2
            if (plat.id === 'wall-r') p.onWallRight = true
          }
        }
        if (p.vx < 0) {
          const prevLeft = p.px - pw2
          const platRight = plat.x + plat.w
          if (prevLeft >= platRight - 2) {
            nx = platRight + pw2
            if (plat.id === 'wall-l') p.onWallLeft = true
          }
        }
      }

      // Clamp X to screen
      nx = Math.max(WALL_W + pw2, Math.min(W - WALL_W - pw2, nx))

      p.px = nx
      p.py = ny

      // Fall off bottom → respawn at checkpoint
      if (p.py > TOTAL_H + 100) {
        p.px = p.checkX; p.py = p.checkY
        p.vx = 0; p.vy = 0
      }

      // Spike collision → respawn
      const pRect: Rect = { x: p.px - pw2, y: p.py - ph2, w: PLAYER_W, h: PLAYER_H }
      for (const spike of ALL_SPIKES) {
        if (rectsOverlap(pRect, spike)) {
          p.px = p.checkX; p.py = p.checkY
          p.vx = 0; p.vy = 0
          break
        }
      }

      // Checkpoint collection
      for (const cp of ALL_CHECKPOINTS) {
        if (visitedCheckpointsRef.current.has(cp.id)) continue
        const cpRect: Rect = { x: cp.x, y: cp.y, w: cp.w, h: cp.h }
        if (rectsOverlap(pRect, cpRect)) {
          visitedCheckpointsRef.current.add(cp.id)
          p.checkX = p.px
          p.checkY = p.py
          // Win if reached room 5's checkpoint
          if (cp.room === NUM_ROOMS - 1) {
            setGameState('win')
            cancelAnimationFrame(rafId)
            return
          }
        }
      }

      // Height score
      const height = Math.max(0, Math.round((TOTAL_H - p.py) / 10))
      if (height > p.maxHeight) {
        p.maxHeight = height
        setScore(height)
      }

      // Smooth camera toward player
      const targetCamY = p.py - H * 0.4
      p.camY += (targetCamY - p.camY) * Math.min(1, dt * 5)

      tick()
      rafId = requestAnimationFrame(loop)
    }

    rafId = requestAnimationFrame(loop)
    return () => cancelAnimationFrame(rafId)
  }, [gameState, gameKey]) // eslint-disable-line react-hooks/exhaustive-deps

  function start() {
    physRef.current = makePhysics()
    visitedCheckpointsRef.current = new Set()
    keysRef.current.clear()
    setScore(0)
    setGameState('playing')
    setGameKey(k => k + 1)
  }

  // ── Render ────────────────────────────────────────────────────────────────
  const p    = physRef.current
  const camY = p.camY

  // Filter to visible entities
  const visTop    = camY - H / 2 - 50
  const visBottom = camY + H / 2 + 50

  function toScreen(worldY: number): number {
    return worldY - camY + H / 2
  }

  const visPlatforms = ALL_PLATFORMS.filter(pl =>
    pl.y < visBottom && pl.y + pl.h > visTop
  )
  const visSpikes = ALL_SPIKES.filter(sp =>
    sp.y < visBottom && sp.y + sp.h > visTop
  )
  const visCheckpoints = ALL_CHECKPOINTS.filter(cp =>
    cp.y < visBottom && cp.y + cp.h > visTop
  )

  const playerScreenY = toScreen(p.py)
  const playerColor   = p.wallSliding ? '#80cbc4' : '#ffffff'

  // Goal marker (top of final room)
  const goalWorldY = roomWorldY(NUM_ROOMS - 1) + 20
  const goalVisible = goalWorldY < visBottom && goalWorldY > visTop

  return (
    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 0 }}>

      {/* ── HUD ──────────────────────────────────────────────────────────── */}
      <div style={{
        width: W,
        display: 'grid',
        gridTemplateColumns: '1fr 1fr 1fr',
        alignItems: 'center',
        padding: '7px 14px',
        background: '#0d0f1a',
        borderRadius: '10px 10px 0 0',
        fontSize: 12,
        color: '#90a4ae',
        letterSpacing: 1,
        userSelect: 'none',
      }}>
        <div style={{ fontSize: 10, color: '#546e7a' }}>WALL JUMP</div>
        <div style={{ textAlign: 'center' }}>
          <span style={{ color: '#4fc3f7', fontWeight: 700, fontSize: 15, letterSpacing: 2 }}>
            {String(score).padStart(4, '0')}m
          </span>
        </div>
        <div style={{ textAlign: 'right', fontSize: 10, color: '#37474f' }}>
          ↑ CLIMB
        </div>
      </div>

      {/* ── Canvas ──────────────────────────────────────────────────────── */}
      <div style={{ position: 'relative', width: W, height: H }}>
        <Game key={gameKey} width={W} height={H} gravity={0}>
          <World background="#0d1117">
            <Camera2D x={W / 2} y={H / 2} background="#0d1117" />

            {/* Platforms */}
            {visPlatforms.map(pl => (
              <Entity key={pl.id} tags={['platform']}>
                <Transform x={pl.x + pl.w / 2} y={toScreen(pl.y + pl.h / 2)} />
                <Sprite width={pl.w} height={pl.h} color={pl.color} zIndex={3} />
              </Entity>
            ))}

            {/* Platform top edge glow */}
            {visPlatforms.filter(pl => pl.id !== 'wall-l' && pl.id !== 'wall-r').map(pl => (
              <Entity key={`${pl.id}-top`} tags={['platform']}>
                <Transform x={pl.x + pl.w / 2} y={toScreen(pl.y) + 1} />
                <Sprite width={pl.w} height={2} color="#4a7a4a" zIndex={4} />
              </Entity>
            ))}

            {/* Spikes */}
            {visSpikes.map(sp => (
              <Entity key={sp.id} tags={['spike']}>
                <Transform x={sp.x + sp.w / 2} y={toScreen(sp.y + sp.h / 2)} />
                <Sprite width={sp.w} height={sp.h} color="#ef5350" zIndex={5} />
              </Entity>
            ))}
            {/* Spike triangles (decorative thin lines) */}
            {visSpikes.map(sp => (
              <Entity key={`${sp.id}-tip`} tags={['spike']}>
                <Transform x={sp.x + sp.w / 2} y={toScreen(sp.y) - 2} />
                <Sprite width={sp.w - 4} height={2} color="#ff1744" zIndex={6} />
              </Entity>
            ))}

            {/* Checkpoints */}
            {visCheckpoints.map(cp => {
              const collected = visitedCheckpointsRef.current.has(cp.id)
              return (
                <Entity key={cp.id} tags={['checkpoint']}>
                  <Transform x={cp.x + cp.w / 2} y={toScreen(cp.y + cp.h / 2)} />
                  <Sprite width={cp.w} height={cp.h} color={collected ? '#ffd54f' : '#37474f'} zIndex={5} />
                </Entity>
              )
            })}

            {/* Goal star at top */}
            {goalVisible && (
              <Entity key="goal" tags={['goal']}>
                <Transform x={W / 2} y={toScreen(goalWorldY)} />
                <Sprite width={24} height={24} color="#ffd54f" zIndex={10} />
              </Entity>
            )}

            {/* Player */}
            <Entity key="player" tags={['player']}>
              <Transform x={p.px} y={playerScreenY} />
              <Sprite width={PLAYER_W} height={PLAYER_H} color={playerColor} zIndex={10} />
            </Entity>

            {/* Wall-slide indicator */}
            {p.wallSliding && (
              <Entity key="slide-indicator" tags={['player']}>
                <Transform x={p.px + (p.onWallLeft ? -PLAYER_W : PLAYER_W)} y={playerScreenY} />
                <Sprite width={4} height={PLAYER_H - 4} color="#4fc3f7" zIndex={11} />
              </Entity>
            )}

            {/* Height progress bar (left edge) */}
            const progressH = Math.min(H, (p.maxHeight / (NUM_ROOMS * 56)) * H)
            <Entity key="progress" tags={['hud']}>
              <Transform x={3} y={H - progressH / 2} />
              <Sprite width={3} height={progressH} color="#4fc3f7" zIndex={20} />
            </Entity>

          </World>
        </Game>

        {/* ── Idle overlay ─────────────────────────────────────────────── */}
        {gameState === 'idle' && (
          <div style={overlayStyle}>
            <div style={cardStyle}>
              <p style={{ fontSize: 11, letterSpacing: 4, color: '#4fc3f7', marginBottom: 8 }}>CUBEFORGE</p>
              <p style={{ fontSize: 34, fontWeight: 900, color: '#fff', letterSpacing: 3 }}>WALL JUMP</p>
              <p style={{ fontSize: 12, color: '#90a4ae', marginTop: 16 }}>
                Climb to the top!
              </p>
              <p style={{ fontSize: 11, color: '#546e7a', marginTop: 8 }}>
                Press <strong style={{ color: '#fff' }}>SPACE</strong> to start
              </p>
            </div>
          </div>
        )}

        {/* ── Win overlay ──────────────────────────────────────────────── */}
        {gameState === 'win' && (
          <div style={overlayStyle}>
            <div style={cardStyle}>
              <p style={{ fontSize: 11, letterSpacing: 4, color: '#ffd54f', marginBottom: 8 }}>SUMMIT REACHED</p>
              <p style={{ fontSize: 34, fontWeight: 900, color: '#fff', letterSpacing: 3 }}>YOU WIN!</p>
              <p style={{ fontSize: 13, color: '#90a4ae', margin: '12px 0 4px' }}>
                Height &nbsp;<strong style={{ color: '#4fc3f7' }}>{score}m</strong>
              </p>
              <button onClick={start} style={btnStyle}>Play Again</button>
            </div>
          </div>
        )}
      </div>

      {/* ── Controls hint ────────────────────────────────────────────────── */}
      <div style={{
        width: W,
        background: '#0d0f1a',
        borderRadius: '0 0 10px 10px',
        padding: '6px 14px',
        fontSize: 11,
        color: '#37474f',
        letterSpacing: 1.5,
        display: 'flex',
        justifyContent: 'space-between',
      }}>
        <span>A/D — move &nbsp;·&nbsp; SPACE — jump &nbsp;·&nbsp; hold toward wall + SPACE — wall jump</span>
        <span style={{ color: '#263238' }}>Cubeforge</span>
      </div>
    </div>
  )
}

// ─── Styles ───────────────────────────────────────────────────────────────────
const overlayStyle: React.CSSProperties = {
  position:       'absolute',
  inset:          0,
  display:        'flex',
  alignItems:     'center',
  justifyContent: 'center',
  background:     'rgba(10, 10, 18, 0.82)',
  backdropFilter: 'blur(4px)',
}

const cardStyle: React.CSSProperties = {
  textAlign:    'center',
  fontFamily:   '"Courier New", monospace',
  padding:      '36px 44px',
  background:   '#0d0f1a',
  border:       '1px solid #1e2535',
  borderRadius: 12,
}

const btnStyle: React.CSSProperties = {
  marginTop:     24,
  padding:       '10px 32px',
  background:    '#4fc3f7',
  color:         '#0a0a0f',
  border:        'none',
  borderRadius:  6,
  fontFamily:    '"Courier New", monospace',
  fontSize:      13,
  fontWeight:    700,
  letterSpacing: 2,
  cursor:        'pointer',
}
