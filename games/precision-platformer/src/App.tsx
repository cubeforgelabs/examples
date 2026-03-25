import { useEffect, useReducer, useRef, useState } from 'react'
import { Game, World, Camera2D, Entity, Transform, Sprite } from '@cubeforge/react'

// ─── Constants ────────────────────────────────────────────────────────────────
const W = 480
const H = 360
const GRAVITY = 680
const JUMP_VEL = -260
const MOVE_SPEED = 150
const ACCEL = 900
const FRICTION = 800
const DASH_SPEED = 320
const DASH_DURATION = 0.12
const WALL_SLIDE_SPEED = 50
const COYOTE_TIME = 0.08
const JUMP_BUFFER = 0.1
const PLAYER_W = 10
const PLAYER_H = 14

type GamePhase = 'idle' | 'playing' | 'gameover'

interface Platform { x: number; y: number; w: number; h: number; color: string }
interface Spike { x: number; y: number; w: number; h: number }
interface Checkpoint { x: number; y: number; active: boolean }
interface Room {
  platforms: Platform[]
  spikes: Spike[]
  checkpoints: Checkpoint[]
  spawn: { x: number; y: number }
}

// ─── Levels ──────────────────────────────────────────────────────────────────
const ROOMS: Room[] = [
  { // Room 0: basics
    spawn: { x: 40, y: 300 },
    platforms: [
      { x: 0, y: 340, w: 480, h: 20, color: '#37474f' },       // floor
      { x: 0, y: 0, w: 480, h: 10, color: '#37474f' },         // ceiling
      { x: 0, y: 0, w: 10, h: 360, color: '#37474f' },         // left wall
      { x: 470, y: 0, w: 10, h: 360, color: '#37474f' },       // right wall
      { x: 100, y: 280, w: 80, h: 10, color: '#455a64' },
      { x: 230, y: 240, w: 60, h: 10, color: '#455a64' },
      { x: 340, y: 200, w: 70, h: 10, color: '#455a64' },
      { x: 420, y: 140, w: 50, h: 10, color: '#455a64' },
    ],
    spikes: [
      { x: 180, y: 332, w: 40, h: 8 },
    ],
    checkpoints: [
      { x: 440, y: 122, active: false },
    ],
  },
  { // Room 1: wall jumps
    spawn: { x: 40, y: 300 },
    platforms: [
      { x: 0, y: 340, w: 160, h: 20, color: '#37474f' },
      { x: 0, y: 0, w: 480, h: 10, color: '#37474f' },
      { x: 0, y: 0, w: 10, h: 360, color: '#37474f' },
      { x: 470, y: 0, w: 10, h: 360, color: '#37474f' },
      { x: 150, y: 120, w: 10, h: 240, color: '#455a64' },     // wall to climb
      { x: 220, y: 80, w: 10, h: 280, color: '#455a64' },      // wall 2
      { x: 290, y: 120, w: 10, h: 240, color: '#455a64' },     // wall 3
      { x: 340, y: 260, w: 130, h: 10, color: '#455a64' },
      { x: 400, y: 340, w: 80, h: 20, color: '#37474f' },
    ],
    spikes: [
      { x: 160, y: 332, w: 60, h: 8 },
      { x: 300, y: 332, w: 100, h: 8 },
    ],
    checkpoints: [
      { x: 440, y: 242, active: false },
    ],
  },
  { // Room 2: dash gauntlet
    spawn: { x: 40, y: 300 },
    platforms: [
      { x: 0, y: 340, w: 80, h: 20, color: '#37474f' },
      { x: 0, y: 0, w: 480, h: 10, color: '#37474f' },
      { x: 0, y: 0, w: 10, h: 360, color: '#37474f' },
      { x: 470, y: 0, w: 10, h: 360, color: '#37474f' },
      { x: 140, y: 280, w: 40, h: 10, color: '#455a64' },
      { x: 260, y: 220, w: 40, h: 10, color: '#455a64' },
      { x: 380, y: 160, w: 40, h: 10, color: '#455a64' },
      { x: 420, y: 340, w: 60, h: 20, color: '#37474f' },
      { x: 380, y: 80, w: 90, h: 10, color: '#455a64' },
    ],
    spikes: [
      { x: 80, y: 332, w: 60, h: 8 },
      { x: 200, y: 332, w: 220, h: 8 },
      { x: 100, y: 270, w: 30, h: 8 },
      { x: 210, y: 210, w: 40, h: 8 },
      { x: 330, y: 150, w: 40, h: 8 },
    ],
    checkpoints: [
      { x: 440, y: 62, active: false },
    ],
  },
]

interface PlayerState {
  x: number; y: number; vx: number; vy: number
  grounded: boolean; wallDir: number // -1=left wall, 1=right wall, 0=none
  canDash: boolean; dashing: boolean; dashTimer: number; dashDx: number; dashDy: number
  coyoteTimer: number; jumpBuffer: number
  room: number; checkpoint: { x: number; y: number; room: number }
  dead: boolean; deathTimer: number
}

function makePlayer(room: number): PlayerState {
  const r = ROOMS[room]
  return {
    x: r.spawn.x, y: r.spawn.y, vx: 0, vy: 0,
    grounded: false, wallDir: 0,
    canDash: true, dashing: false, dashTimer: 0, dashDx: 0, dashDy: 0,
    coyoteTimer: 0, jumpBuffer: 0,
    room, checkpoint: { x: r.spawn.x, y: r.spawn.y, room },
    dead: false, deathTimer: 0,
  }
}

function rectOverlap(ax: number, ay: number, aw: number, ah: number, bx: number, by: number, bw: number, bh: number) {
  return ax < bx + bw && ax + aw > bx && ay < by + bh && ay + ah > by
}

// ─── App ──────────────────────────────────────────────────────────────────────
export function App() {
  const [gameKey, setGameKey] = useState(0)
  const [phase, setPhase] = useState<GamePhase>('idle')
  const [deaths, setDeaths] = useState(0)
  const [roomIdx, setRoomIdx] = useState(0)
  const [, render] = useReducer(n => n + 1, 0)

  const phaseRef = useRef<GamePhase>('idle')
  const playerRef = useRef<PlayerState>(makePlayer(0))
  const keysRef = useRef<Record<string, boolean>>({})
  const rafRef = useRef(0)
  const lastRef = useRef(0)
  const deathsRef = useRef(0)
  const roomsState = useRef(ROOMS.map(r => ({ checkpoints: r.checkpoints.map(c => ({ ...c })) })))
  const justJumped = useRef(false)
  const justDashed = useRef(false)

  function startGame() {
    deathsRef.current = 0
    setDeaths(0)
    roomsState.current = ROOMS.map(r => ({ checkpoints: r.checkpoints.map(c => ({ ...c, active: false })) }))
    playerRef.current = makePlayer(0)
    setRoomIdx(0)
    phaseRef.current = 'playing'
    setPhase('playing')
    setGameKey(k => k + 1)
  }

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      keysRef.current[e.code] = e.type === 'keydown'
      if (e.type === 'keydown' && (e.code === 'Space' || e.code === 'Enter')) {
        if (phaseRef.current === 'idle' || phaseRef.current === 'gameover') startGame()
      }
    }
    window.addEventListener('keydown', onKey)
    window.addEventListener('keyup', onKey)
    return () => { window.removeEventListener('keydown', onKey); window.removeEventListener('keyup', onKey) }
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    if (phase !== 'playing') return
    lastRef.current = performance.now()

    function loop(now: number) {
      const dt = Math.min((now - lastRef.current) / 1000, 0.05)
      lastRef.current = now
      if (phaseRef.current !== 'playing') return

      const p = playerRef.current
      const keys = keysRef.current
      const room = ROOMS[p.room]

      // Death respawn
      if (p.dead) {
        p.deathTimer -= dt
        if (p.deathTimer <= 0) {
          const cp = p.checkpoint
          p.x = cp.x; p.y = cp.y; p.vx = 0; p.vy = 0
          p.dead = false; p.canDash = true; p.dashing = false
          if (cp.room !== p.room) { p.room = cp.room; setRoomIdx(cp.room) }
        }
        render()
        rafRef.current = requestAnimationFrame(loop)
        return
      }

      const left = keys['ArrowLeft'] || keys['KeyA']
      const right = keys['ArrowRight'] || keys['KeyD']
      const jumpKey = keys['ArrowUp'] || keys['KeyW'] || keys['Space']
      const dashKey = keys['ShiftLeft'] || keys['ShiftRight'] || keys['KeyX']

      // ── Dash ──────────────────────────────────────────────────
      if (dashKey && !justDashed.current && p.canDash && !p.dashing) {
        p.dashing = true
        p.dashTimer = DASH_DURATION
        p.canDash = false
        let dx = 0, dy = 0
        if (left) dx = -1; if (right) dx = 1
        if (keys['ArrowUp'] || keys['KeyW']) dy = -1
        if (keys['ArrowDown'] || keys['KeyS']) dy = 1
        if (dx === 0 && dy === 0) dx = p.vx >= 0 ? 1 : -1
        const len = Math.hypot(dx, dy) || 1
        p.dashDx = (dx / len) * DASH_SPEED
        p.dashDy = (dy / len) * DASH_SPEED
      }
      justDashed.current = dashKey

      if (p.dashing) {
        p.dashTimer -= dt
        if (p.dashTimer <= 0) p.dashing = false
        else {
          p.vx = p.dashDx; p.vy = p.dashDy
        }
      }

      // ── Horizontal movement ───────────────────────────────────
      if (!p.dashing) {
        const targetVx = left ? -MOVE_SPEED : right ? MOVE_SPEED : 0
        if (targetVx !== 0) {
          p.vx += (targetVx > p.vx ? 1 : -1) * ACCEL * dt
          if (Math.abs(p.vx) > MOVE_SPEED) p.vx = Math.sign(p.vx) * MOVE_SPEED
        } else {
          const dec = FRICTION * dt
          if (Math.abs(p.vx) <= dec) p.vx = 0
          else p.vx -= Math.sign(p.vx) * dec
        }
      }

      // ── Gravity ───────────────────────────────────────────────
      if (!p.dashing) {
        // Wall slide
        if (p.wallDir !== 0 && p.vy > 0 && (left || right)) {
          p.vy = Math.min(p.vy + GRAVITY * dt * 0.3, WALL_SLIDE_SPEED)
        } else {
          p.vy += GRAVITY * dt
          // Variable jump height
          if (p.vy < 0 && !jumpKey) p.vy += GRAVITY * dt * 0.5
        }
      }

      // ── Jump buffer + coyote time ────────────────────────────
      if (jumpKey && !justJumped.current) p.jumpBuffer = JUMP_BUFFER
      if (p.jumpBuffer > 0) p.jumpBuffer -= dt
      justJumped.current = jumpKey

      const canJump = p.grounded || p.coyoteTimer > 0
      if (p.jumpBuffer > 0 && canJump) {
        p.vy = JUMP_VEL
        p.jumpBuffer = 0
        p.coyoteTimer = 0
      }

      // Wall jump
      if (p.jumpBuffer > 0 && p.wallDir !== 0 && !p.grounded) {
        p.vy = JUMP_VEL * 0.9
        p.vx = -p.wallDir * MOVE_SPEED * 1.2
        p.jumpBuffer = 0
        p.wallDir = 0
      }

      if (p.grounded) {
        p.coyoteTimer = COYOTE_TIME
        p.canDash = true
      } else {
        p.coyoteTimer -= dt
      }

      // ── Move + collide ────────────────────────────────────────
      p.x += p.vx * dt
      // Horizontal collision
      p.wallDir = 0
      for (const pl of room.platforms) {
        if (rectOverlap(p.x - PLAYER_W / 2, p.y - PLAYER_H / 2, PLAYER_W, PLAYER_H, pl.x, pl.y, pl.w, pl.h)) {
          if (p.vx > 0) { p.x = pl.x - PLAYER_W / 2; p.wallDir = 1 }
          else if (p.vx < 0) { p.x = pl.x + pl.w + PLAYER_W / 2; p.wallDir = -1 }
          p.vx = 0
        }
      }

      p.y += p.vy * dt
      p.grounded = false
      for (const pl of room.platforms) {
        if (rectOverlap(p.x - PLAYER_W / 2, p.y - PLAYER_H / 2, PLAYER_W, PLAYER_H, pl.x, pl.y, pl.w, pl.h)) {
          if (p.vy > 0) { p.y = pl.y - PLAYER_H / 2; p.grounded = true }
          else if (p.vy < 0) { p.y = pl.y + pl.h + PLAYER_H / 2 }
          p.vy = 0
        }
      }

      // ── Spikes ────────────────────────────────────────────────
      for (const sp of room.spikes) {
        if (rectOverlap(p.x - PLAYER_W / 2, p.y - PLAYER_H / 2, PLAYER_W, PLAYER_H, sp.x, sp.y, sp.w, sp.h)) {
          p.dead = true
          p.deathTimer = 0.3
          deathsRef.current++
          setDeaths(deathsRef.current)
        }
      }

      // ── Checkpoints ───────────────────────────────────────────
      const rs = roomsState.current[p.room]
      for (let i = 0; i < rs.checkpoints.length; i++) {
        const cp = rs.checkpoints[i]
        const rcp = room.checkpoints[i]
        if (!cp.active && Math.hypot(p.x - rcp.x, p.y - rcp.y) < 24) {
          cp.active = true
          p.checkpoint = { x: rcp.x, y: rcp.y, room: p.room }
          // Advance to next room
          if (p.room < ROOMS.length - 1) {
            const nextRoom = p.room + 1
            p.room = nextRoom
            const nr = ROOMS[nextRoom]
            p.x = nr.spawn.x; p.y = nr.spawn.y; p.vx = 0; p.vy = 0
            p.checkpoint = { x: nr.spawn.x, y: nr.spawn.y, room: nextRoom }
            setRoomIdx(nextRoom)
          } else {
            // Beat the game!
            phaseRef.current = 'gameover'
            setPhase('gameover')
          }
        }
      }

      render()
      rafRef.current = requestAnimationFrame(loop)
    }

    rafRef.current = requestAnimationFrame(loop)
    return () => cancelAnimationFrame(rafRef.current)
  }, [phase, gameKey]) // eslint-disable-line react-hooks/exhaustive-deps

  const p = playerRef.current
  const room = ROOMS[p.room]
  const rs = roomsState.current[p.room]

  return (
    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 0, fontFamily: '"Courier New", monospace' }}>
      {/* HUD */}
      <div style={{ width: W, display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', alignItems: 'center', padding: '7px 18px', background: '#0d0f1a', borderRadius: '10px 10px 0 0', fontSize: 13, color: '#90a4ae', letterSpacing: 1, userSelect: 'none', boxSizing: 'border-box' }}>
        <div>Deaths: <strong style={{ color: '#ef5350' }}>{deaths}</strong></div>
        <div style={{ textAlign: 'center', fontSize: 11, letterSpacing: 3, color: '#607d8b' }}>ROOM {roomIdx + 1}/{ROOMS.length}</div>
        <div style={{ textAlign: 'right' }}>
          {p.canDash ? <span style={{ color: '#4fc3f7' }}>DASH READY</span> : <span style={{ color: '#37474f' }}>DASH</span>}
        </div>
      </div>

      {/* Canvas */}
      <div style={{ position: 'relative', width: W, height: H }}>
        <Game key={gameKey} width={W} height={H} gravity={0}>
          <World background="#16213e">
            <Camera2D x={W / 2} y={H / 2} background="#16213e" />

            {/* Platforms */}
            {room.platforms.map((pl, i) => (
              <Entity key={`pl-${i}`} tags={['platform']}>
                <Transform x={pl.x + pl.w / 2} y={pl.y + pl.h / 2} />
                <Sprite width={pl.w} height={pl.h} color={pl.color} zIndex={2} />
              </Entity>
            ))}

            {/* Spikes */}
            {room.spikes.map((sp, i) => (
              <Entity key={`sp-${i}`} tags={['spike']}>
                <Transform x={sp.x + sp.w / 2} y={sp.y + sp.h / 2} />
                <Sprite width={sp.w} height={sp.h} color="#ef5350" zIndex={3} />
              </Entity>
            ))}

            {/* Checkpoints */}
            {room.checkpoints.map((cp, i) => (
              <Entity key={`cp-${i}`} tags={['checkpoint']}>
                <Transform x={cp.x} y={cp.y} />
                <Sprite width={12} height={16} color={rs.checkpoints[i].active ? '#66bb6a' : '#4caf50'} zIndex={4} />
              </Entity>
            ))}

            {/* Player */}
            {!p.dead && (
              <>
                <Entity tags={['player']}>
                  <Transform x={p.x} y={p.y} />
                  <Sprite width={PLAYER_W} height={PLAYER_H} color={p.dashing ? '#4fc3f7' : '#e0e0e0'} zIndex={10} />
                </Entity>
                {/* Hair/head indicator */}
                <Entity tags={['hair']}>
                  <Transform x={p.x} y={p.y - PLAYER_H / 2 + 2} />
                  <Sprite width={PLAYER_W + 2} height={4} color={p.canDash ? '#4fc3f7' : '#ef5350'} zIndex={11} />
                </Entity>
              </>
            )}

            {/* Death particles */}
            {p.dead && Array.from({ length: 6 }, (_, i) => {
              const angle = (i / 6) * Math.PI * 2
              const dist = (1 - p.deathTimer / 0.3) * 30
              return (
                <Entity key={`death-${i}`} tags={['particle']}>
                  <Transform x={p.x + Math.cos(angle) * dist} y={p.y + Math.sin(angle) * dist} />
                  <Sprite width={4} height={4} color="#e0e0e0" zIndex={10} />
                </Entity>
              )
            })}
          </World>
        </Game>

        {/* Idle overlay */}
        {phase === 'idle' && (
          <div style={overlayStyle}>
            <div style={cardStyle}>
              <p style={{ fontSize: 11, letterSpacing: 4, color: '#4fc3f7', marginBottom: 8 }}>CUBEFORGE</p>
              <p style={{ fontSize: 32, fontWeight: 900, color: '#fff', letterSpacing: 3 }}>PRECISION</p>
              <p style={{ fontSize: 32, fontWeight: 900, color: '#fff', letterSpacing: 3, marginTop: -6 }}>PLATFORMER</p>
              <p style={{ fontSize: 12, color: '#546e7a', marginTop: 16 }}>Dash, wall-jump, and survive</p>
              <button onClick={startGame} style={btnStyle}>Play</button>
            </div>
          </div>
        )}

        {/* Game complete overlay */}
        {phase === 'gameover' && (
          <div style={overlayStyle}>
            <div style={cardStyle}>
              <p style={{ fontSize: 11, letterSpacing: 4, color: '#66bb6a', marginBottom: 8 }}>ALL ROOMS CLEAR</p>
              <p style={{ fontSize: 36, fontWeight: 900, color: '#fff', letterSpacing: 3 }}>COMPLETE!</p>
              <p style={{ fontSize: 13, color: '#90a4ae', margin: '12px 0 4px' }}>
                Deaths: <strong style={{ color: '#ef5350' }}>{deaths}</strong>
              </p>
              <button onClick={startGame} style={btnStyle}>Play Again</button>
            </div>
          </div>
        )}
      </div>

      {/* Footer */}
      <div style={{ width: W, background: '#0d0f1a', borderRadius: '0 0 10px 10px', padding: '6px 18px', fontSize: 11, color: '#37474f', letterSpacing: 1.5, display: 'flex', justifyContent: 'space-between', boxSizing: 'border-box' }}>
        <span>Arrows — move &middot; Space — jump &middot; Shift — dash</span>
        <span style={{ color: '#263238' }}>Cubeforge Engine</span>
      </div>
    </div>
  )
}

const overlayStyle: React.CSSProperties = { position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'rgba(10,10,18,0.88)', backdropFilter: 'blur(4px)' }
const cardStyle: React.CSSProperties = { textAlign: 'center', fontFamily: '"Courier New",monospace', padding: '36px 48px', background: '#0d0f1a', border: '1px solid #1e2535', borderRadius: 12 }
const btnStyle: React.CSSProperties = { marginTop: 24, padding: '10px 32px', background: '#4fc3f7', color: '#0a0a0f', border: 'none', borderRadius: 6, fontFamily: '"Courier New",monospace', fontSize: 13, fontWeight: 700, letterSpacing: 2, cursor: 'pointer' }
