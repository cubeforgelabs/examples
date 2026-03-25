import { useEffect, useReducer, useRef, useState } from 'react'
import { Game, World, Camera2D, Entity, Transform, Sprite } from '@cubeforge/react'

// ─── Constants ────────────────────────────────────────────────────────────────
const W = 550
const H = 600
const ALIEN_COLS = 11
const ALIEN_ROWS = 5
const ALIEN_W = 32
const ALIEN_H = 24
const ALIEN_GAP_X = 10
const ALIEN_GAP_Y = 14
const ALIEN_STEP = 10
const ALIEN_DESCEND = 20
const PLAYER_W = 36
const PLAYER_H = 18
const PLAYER_SPEED = 4
const BULLET_W = 4
const BULLET_H = 14
const PLAYER_BULLET_SPEED = 8
const ALIEN_BULLET_SPEED = 4
const SHIELD_W = 52
const SHIELD_H = 18
const GROUND_Y = H - 40

type GameState = 'idle' | 'playing' | 'gameover' | 'win'

interface Alien {
  id: number
  col: number
  row: number
  alive: boolean
}

interface Bullet {
  id: number
  x: number
  y: number
  fromPlayer: boolean
}

interface GameData {
  aliens: Alien[]
  playerX: number
  playerBullet: Bullet | null
  alienBullets: Bullet[]
  alienOffsetX: number
  alienOffsetY: number
  alienDir: number // 1 = right, -1 = left
  alienSpeed: number // ticks per step
  tickCount: number
  stepCount: number
  bulletIdCounter: number
  alienShootTimer: number
  shields: { id: number; x: number; hp: number }[]
  explosions: { id: number; x: number; y: number; ttl: number }[]
}

function makeAliens(): Alien[] {
  const aliens: Alien[] = []
  let id = 0
  for (let r = 0; r < ALIEN_ROWS; r++) {
    for (let c = 0; c < ALIEN_COLS; c++) {
      aliens.push({ id: id++, col: c, row: r, alive: true })
    }
  }
  return aliens
}

function makeShields() {
  const positions = [80, 200, 320, 440]
  return positions.map((x, i) => ({ id: i, x, hp: 4 }))
}

function initGame(): GameData {
  return {
    aliens: makeAliens(),
    playerX: W / 2,
    playerBullet: null,
    alienBullets: [],
    alienOffsetX: 0,
    alienOffsetY: 0,
    alienDir: 1,
    alienSpeed: 40,
    tickCount: 0,
    stepCount: 0,
    bulletIdCounter: 1000,
    alienShootTimer: 0,
    shields: makeShields(),
    explosions: [],
  }
}

function alienScreenX(alien: Alien, offsetX: number) {
  const startX = 40
  return startX + alien.col * (ALIEN_W + ALIEN_GAP_X) + offsetX + ALIEN_W / 2
}

function alienScreenY(alien: Alien, offsetY: number) {
  const startY = 80
  return startY + alien.row * (ALIEN_H + ALIEN_GAP_Y) + offsetY + ALIEN_H / 2
}

function alienColor(row: number): string {
  if (row <= 0) return '#ce93d8'   // top: purple
  if (row <= 2) return '#4dd0e1'   // middle: teal
  return '#81c784'                  // bottom: green
}

export function App() {
  const [gameKey, setGameKey] = useState(0)
  const [score, setScore] = useState(0)
  const [bestScore, setBestScore] = useState(0)
  const [lives, setLives] = useState(3)
  const [gameState, setGameState] = useState<GameState>('idle')
  const gd = useRef<GameData>(initGame())
  const keysRef = useRef<Set<string>>(new Set())
  const [, tick] = useReducer(n => n + 1, 0)
  const rafRef = useRef<number>(0)
  const gameStateRef = useRef<GameState>('idle')
  const scoreRef = useRef(0)
  const livesRef = useRef(3)

  gameStateRef.current = gameState

  function getAliveCount() {
    return gd.current.aliens.filter(a => a.alive).length
  }

  function restart() {
    gd.current = initGame()
    scoreRef.current = 0
    livesRef.current = 3
    setScore(0)
    setLives(3)
    setGameState('playing')
    setGameKey(k => k + 1)
  }

  useEffect(() => {
    const down = (e: KeyboardEvent) => {
      keysRef.current.add(e.code)
      if (e.code === 'Space') e.preventDefault()
      if ((gameStateRef.current === 'idle' || gameStateRef.current === 'gameover' || gameStateRef.current === 'win') &&
        (e.code === 'Space' || e.code === 'Enter')) {
        restart()
      }
    }
    const up = (e: KeyboardEvent) => keysRef.current.delete(e.code)
    window.addEventListener('keydown', down)
    window.addEventListener('keyup', up)
    return () => {
      window.removeEventListener('keydown', down)
      window.removeEventListener('keyup', up)
    }
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    if (gameState !== 'playing') return
    let lastShot = false

    function frame() {
      if (gameStateRef.current !== 'playing') return
      const g = gd.current
      const keys = keysRef.current

      // Player movement
      if (keys.has('ArrowLeft') || keys.has('KeyA')) g.playerX = Math.max(PLAYER_W / 2, g.playerX - PLAYER_SPEED)
      if (keys.has('ArrowRight') || keys.has('KeyD')) g.playerX = Math.min(W - PLAYER_W / 2, g.playerX + PLAYER_SPEED)

      // Player shoot
      const shooting = keys.has('Space') || keys.has('ArrowUp') || keys.has('KeyW')
      if (shooting && !lastShot && !g.playerBullet) {
        g.playerBullet = { id: g.bulletIdCounter++, x: g.playerX, y: GROUND_Y - PLAYER_H, fromPlayer: true }
      }
      lastShot = shooting

      // Move player bullet
      if (g.playerBullet) {
        g.playerBullet.y -= PLAYER_BULLET_SPEED
        if (g.playerBullet.y < -10) g.playerBullet = null
      }

      // Move alien bullets
      g.alienBullets = g.alienBullets.filter(b => b.y < H + 10)
      for (const b of g.alienBullets) b.y += ALIEN_BULLET_SPEED

      g.tickCount++

      // Alien movement step
      const aliveCount = getAliveCount()
      const speedup = Math.max(4, g.alienSpeed - Math.floor((ALIEN_COLS * ALIEN_ROWS - aliveCount) / 5) * 3)
      if (g.tickCount % speedup === 0) {
        g.stepCount++
        const rightmost = Math.max(...g.aliens.filter(a => a.alive).map(a => alienScreenX(a, g.alienOffsetX)))
        const leftmost = Math.min(...g.aliens.filter(a => a.alive).map(a => alienScreenX(a, g.alienOffsetX)))

        if (g.alienDir === 1 && rightmost + ALIEN_W / 2 + ALIEN_STEP > W - 10) {
          g.alienOffsetY += ALIEN_DESCEND
          g.alienDir = -1
        } else if (g.alienDir === -1 && leftmost - ALIEN_W / 2 - ALIEN_STEP < 10) {
          g.alienOffsetY += ALIEN_DESCEND
          g.alienDir = 1
        } else {
          g.alienOffsetX += g.alienDir * ALIEN_STEP
        }
      }

      // Alien shoot
      g.alienShootTimer++
      const shootInterval = Math.max(30, 90 - Math.floor((ALIEN_COLS * ALIEN_ROWS - aliveCount) / 5) * 8)
      if (g.alienShootTimer >= shootInterval) {
        g.alienShootTimer = 0
        const alive = g.aliens.filter(a => a.alive)
        if (alive.length > 0) {
          // Pick bottom-most alien in a random column that has live aliens
          const cols = [...new Set(alive.map(a => a.col))]
          const col = cols[Math.floor(Math.random() * cols.length)]
          const shooter = alive.filter(a => a.col === col).sort((a, b) => b.row - a.row)[0]
          g.alienBullets.push({
            id: g.bulletIdCounter++,
            x: alienScreenX(shooter, g.alienOffsetX),
            y: alienScreenY(shooter, g.alienOffsetY) + ALIEN_H / 2,
            fromPlayer: false,
          })
        }
      }

      // Check player bullet vs aliens
      if (g.playerBullet) {
        for (const alien of g.aliens) {
          if (!alien.alive) continue
          const ax = alienScreenX(alien, g.alienOffsetX)
          const ay = alienScreenY(alien, g.alienOffsetY)
          const bx = g.playerBullet.x, by = g.playerBullet.y
          if (Math.abs(bx - ax) < ALIEN_W / 2 + BULLET_W / 2 && Math.abs(by - ay) < ALIEN_H / 2 + BULLET_H / 2) {
            alien.alive = false
            g.explosions.push({ id: g.bulletIdCounter++, x: ax, y: ay, ttl: 8 })
            g.playerBullet = null
            const pts = alien.row === 0 ? 30 : alien.row <= 2 ? 20 : 10
            scoreRef.current += pts
            setScore(scoreRef.current)
            break
          }
        }
      }

      // Check player bullet vs shields
      if (g.playerBullet) {
        for (const sh of g.shields) {
          if (sh.hp <= 0) continue
          const sy = GROUND_Y - PLAYER_H - 30
          if (Math.abs(g.playerBullet.x - sh.x) < SHIELD_W / 2 && Math.abs(g.playerBullet.y - sy) < SHIELD_H / 2) {
            sh.hp--
            g.playerBullet = null
            break
          }
        }
      }

      // Check alien bullets vs player
      for (let i = g.alienBullets.length - 1; i >= 0; i--) {
        const b = g.alienBullets[i]
        if (Math.abs(b.x - g.playerX) < PLAYER_W / 2 + BULLET_W / 2 && Math.abs(b.y - GROUND_Y) < PLAYER_H / 2 + BULLET_H / 2) {
          g.alienBullets.splice(i, 1)
          g.explosions.push({ id: g.bulletIdCounter++, x: g.playerX, y: GROUND_Y, ttl: 12 })
          livesRef.current--
          setLives(livesRef.current)
          if (livesRef.current <= 0) {
            setBestScore(b => Math.max(b, scoreRef.current))
            setGameState('gameover')
            return
          }
        }
      }

      // Check alien bullets vs shields
      for (let i = g.alienBullets.length - 1; i >= 0; i--) {
        const b = g.alienBullets[i]
        const sy = GROUND_Y - PLAYER_H - 30
        for (const sh of g.shields) {
          if (sh.hp <= 0) continue
          if (Math.abs(b.x - sh.x) < SHIELD_W / 2 && Math.abs(b.y - sy) < SHIELD_H / 2) {
            sh.hp--
            g.alienBullets.splice(i, 1)
            break
          }
        }
      }

      // Check aliens reached bottom
      const lowestAlienY = Math.max(...g.aliens.filter(a => a.alive).map(a => alienScreenY(a, g.alienOffsetY)))
      if (lowestAlienY + ALIEN_H / 2 >= GROUND_Y - PLAYER_H) {
        setBestScore(b => Math.max(b, scoreRef.current))
        setGameState('gameover')
        return
      }

      // Tick explosions
      g.explosions = g.explosions.filter(e => {
        e.ttl--
        return e.ttl > 0
      })

      // Check win
      if (aliveCount === 0) {
        setBestScore(b => Math.max(b, scoreRef.current))
        setGameState('win')
        return
      }

      tick()
      rafRef.current = requestAnimationFrame(frame)
    }

    rafRef.current = requestAnimationFrame(frame)
    return () => cancelAnimationFrame(rafRef.current)
  }, [gameState, gameKey]) // eslint-disable-line react-hooks/exhaustive-deps

  const g = gd.current

  return (
    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 0, fontFamily: '"Courier New", monospace' }}>
      {/* HUD */}
      <div style={{ width: W, display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', alignItems: 'center', padding: '7px 18px', background: '#0d0f1a', borderRadius: '10px 10px 0 0', fontSize: 13, color: '#90a4ae', letterSpacing: 1, userSelect: 'none', boxSizing: 'border-box' }}>
        <div style={{ display: 'flex', gap: 5 }}>
          {Array.from({ length: 3 }, (_, i) => (
            <span key={i} style={{ color: i < lives ? '#ef5350' : '#263238', fontSize: 16 }}>♥</span>
          ))}
        </div>
        <div style={{ textAlign: 'center' }}>
          <span style={{ color: '#ffd54f', fontWeight: 700, fontSize: 18, letterSpacing: 3 }}>{String(score).padStart(6, '0')}</span>
        </div>
        <div style={{ textAlign: 'right', fontSize: 11, color: '#37474f' }}>BEST {bestScore}</div>
      </div>

      {/* Canvas */}
      <div style={{ position: 'relative', width: W, height: H }}>
        <Game key={gameKey} width={W} height={H} gravity={0}>
          <World background="#0d1117">
            <Camera2D x={W / 2} y={H / 2} background="#0d1117" />

            {/* Ground line */}
            <Entity tags={['ground']}>
              <Transform x={W / 2} y={GROUND_Y + PLAYER_H / 2 + 2} />
              <Sprite width={W} height={2} color="#1e3a2f" zIndex={1} />
            </Entity>

            {/* Shields */}
            {g.shields.map(sh => {
              if (sh.hp <= 0) return null
              const sy = GROUND_Y - PLAYER_H - 30
              const alpha = sh.hp / 4
              const col = alpha > 0.7 ? '#2e7d32' : alpha > 0.4 ? '#558b2f' : '#9e9d24'
              return (
                <Entity key={sh.id} tags={['shield']}>
                  <Transform x={sh.x} y={sy} />
                  <Sprite width={SHIELD_W} height={SHIELD_H} color={col} zIndex={5} />
                </Entity>
              )
            })}

            {/* Aliens */}
            {g.aliens.map(alien => {
              if (!alien.alive) return null
              return (
                <Entity key={alien.id} tags={['alien']}>
                  <Transform x={alienScreenX(alien, g.alienOffsetX)} y={alienScreenY(alien, g.alienOffsetY)} />
                  <Sprite width={ALIEN_W} height={ALIEN_H} color={alienColor(alien.row)} zIndex={10} />
                </Entity>
              )
            })}

            {/* Player */}
            <Entity tags={['player']}>
              <Transform x={g.playerX} y={GROUND_Y} />
              <Sprite width={PLAYER_W} height={PLAYER_H} color="#e0e0e0" zIndex={15} />
            </Entity>
            {/* Player cannon nub */}
            <Entity tags={['player-cannon']}>
              <Transform x={g.playerX} y={GROUND_Y - PLAYER_H / 2 - 4} />
              <Sprite width={6} height={8} color="#e0e0e0" zIndex={15} />
            </Entity>

            {/* Player bullet */}
            {g.playerBullet && (
              <Entity tags={['bullet']} key={g.playerBullet.id}>
                <Transform x={g.playerBullet.x} y={g.playerBullet.y} />
                <Sprite width={BULLET_W} height={BULLET_H} color="#69f0ae" zIndex={20} />
              </Entity>
            )}

            {/* Alien bullets */}
            {g.alienBullets.map(b => (
              <Entity key={b.id} tags={['alien-bullet']}>
                <Transform x={b.x} y={b.y} />
                <Sprite width={BULLET_W} height={BULLET_H} color="#ff7043" zIndex={20} />
              </Entity>
            ))}

            {/* Explosions */}
            {g.explosions.map(ex => (
              <Entity key={ex.id} tags={['explosion']}>
                <Transform x={ex.x} y={ex.y} />
                <Sprite width={ex.ttl * 3 + 8} height={ex.ttl * 3 + 8} color={ex.ttl > 6 ? '#ffd54f' : '#ff7043'} zIndex={25} />
              </Entity>
            ))}

          </World>
        </Game>

        {gameState === 'idle' && (
          <div style={overlayStyle}>
            <div style={cardStyle}>
              <p style={{ fontSize: 11, letterSpacing: 4, color: '#69f0ae', marginBottom: 8 }}>CUBEFORGE</p>
              <p style={{ fontSize: 40, fontWeight: 900, color: '#fff', letterSpacing: 4 }}>SPACE INVADERS</p>
              <p style={{ fontSize: 12, color: '#90a4ae', marginTop: 16 }}>Defend Earth from the alien armada</p>
              <p style={{ fontSize: 13, color: '#90a4ae', marginTop: 12 }}>Press <strong style={{ color: '#fff' }}>SPACE</strong> to start</p>
            </div>
          </div>
        )}
        {gameState === 'gameover' && (
          <div style={overlayStyle}>
            <div style={cardStyle}>
              <p style={{ fontSize: 11, letterSpacing: 4, color: '#ef5350', marginBottom: 8 }}>EARTH INVADED</p>
              <p style={{ fontSize: 36, fontWeight: 900, color: '#fff', letterSpacing: 3 }}>GAME OVER</p>
              <p style={{ fontSize: 13, color: '#90a4ae', margin: '12px 0 4px' }}>Score <strong style={{ color: '#ffd54f' }}>{score}</strong></p>
              <button onClick={restart} style={btnStyle}>Try Again</button>
            </div>
          </div>
        )}
        {gameState === 'win' && (
          <div style={overlayStyle}>
            <div style={cardStyle}>
              <p style={{ fontSize: 11, letterSpacing: 4, color: '#69f0ae', marginBottom: 8 }}>EARTH SAVED!</p>
              <p style={{ fontSize: 36, fontWeight: 900, color: '#fff', letterSpacing: 3 }}>YOU WIN!</p>
              <p style={{ fontSize: 13, color: '#90a4ae', margin: '12px 0 4px' }}>Score <strong style={{ color: '#ffd54f' }}>{score}</strong></p>
              <button onClick={restart} style={btnStyle}>Play Again</button>
            </div>
          </div>
        )}
      </div>

      {/* Footer */}
      <div style={{ width: W, background: '#0d0f1a', borderRadius: '0 0 10px 10px', padding: '6px 18px', fontSize: 11, color: '#37474f', letterSpacing: 1.5, display: 'flex', justifyContent: 'space-between', boxSizing: 'border-box' }}>
        <span>A/D or Arrows — move &nbsp;·&nbsp; Space — shoot</span>
        <span style={{ color: '#263238' }}>Cubeforge Engine</span>
      </div>
    </div>
  )
}

const overlayStyle: React.CSSProperties = { position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'rgba(10,10,18,0.88)', backdropFilter: 'blur(4px)' }
const cardStyle: React.CSSProperties = { textAlign: 'center', fontFamily: '"Courier New",monospace', padding: '36px 48px', background: '#0d0f1a', border: '1px solid #1e2535', borderRadius: 12 }
const btnStyle: React.CSSProperties = { marginTop: 24, padding: '10px 32px', background: '#ffd54f', color: '#0a0a0f', border: 'none', borderRadius: 6, fontFamily: '"Courier New",monospace', fontSize: 13, fontWeight: 700, letterSpacing: 2, cursor: 'pointer' }
