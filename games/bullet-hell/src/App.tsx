import { useEffect, useReducer, useRef, useState } from 'react'
import { Game, World, Camera2D, Entity, Transform, Sprite } from '@cubeforge/react'

// ─── Constants ────────────────────────────────────────────────────────────────
const W = 480
const H = 600
const PLAYER_SIZE = 8
const PLAYER_SPEED = 220
const PLAYER_BULLET_SPEED = 480
const PLAYER_SHOOT_CD = 0.14
const BOSS_SIZE = 36
const BOSS_BULLET_SIZE = 7
const BOSS_X = W / 2
const BOSS_Y = 80
const BOSS_MAX_HP = 600
const DT = 1 / 60

type GameState = 'idle' | 'playing' | 'gameover'

interface Bullet {
  x: number; y: number; vx: number; vy: number; id: number; color: string; size: number
}

interface PlayerBullet {
  x: number; y: number; vy: number; id: number
}

// ─── App ─────────────────────────────────────────────────────────────────────
export function App() {
  const [gameKey, setGameKey] = useState(0)
  const [score, setScore] = useState(0)
  const [lives, setLives] = useState(3)
  const [bossHp, setBossHp] = useState(BOSS_MAX_HP)
  const [gameState, setGameState] = useState<GameState>('idle')

  const playerRef = useRef({ x: W / 2, y: H - 60 })
  const bossHpRef = useRef(BOSS_MAX_HP)
  const bulletsRef = useRef<Bullet[]>([])        // boss bullets
  const playerBulletsRef = useRef<PlayerBullet[]>([])
  const keysRef = useRef(new Set<string>())
  const nextIdRef = useRef(1)
  const shootTimerRef = useRef(0)
  const bossPatternTimerRef = useRef(0)
  const bossPatternRef = useRef(0)     // which pattern
  const patternPhaseRef = useRef(0)    // rotation/angle accumulator
  const scoreTimerRef = useRef(0)
  const livesRef = useRef(3)
  const invulnRef = useRef(0)
  const bossMoveDirRef = useRef(1)
  const bossMoveXRef = useRef(BOSS_X)

  const [, forceRender] = useReducer(n => n + 1, 0)

  // Spawn boss bullet helpers
  const addBossBullet = (x: number, y: number, vx: number, vy: number, color: string, size = BOSS_BULLET_SIZE) => {
    bulletsRef.current.push({ x, y, vx, vy, id: nextIdRef.current++, color, size })
  }

  // Main loop
  useEffect(() => {
    if (gameState !== 'playing') return
    const id = setInterval(() => {
      const player = playerRef.current
      const keys = keysRef.current

      // Player movement
      let dx = 0, dy = 0
      if (keys.has('KeyW') || keys.has('ArrowUp')) dy = -1
      if (keys.has('KeyS') || keys.has('ArrowDown')) dy = 1
      if (keys.has('KeyA') || keys.has('ArrowLeft')) dx = -1
      if (keys.has('KeyD') || keys.has('ArrowRight')) dx = 1
      if (dx !== 0 || dy !== 0) {
        const len = Math.sqrt(dx * dx + dy * dy)
        const spd = keys.has('ShiftLeft') || keys.has('ShiftRight') ? PLAYER_SPEED * 0.4 : PLAYER_SPEED
        player.x = Math.max(PLAYER_SIZE / 2, Math.min(W - PLAYER_SIZE / 2, player.x + (dx / len) * spd * DT))
        player.y = Math.max(PLAYER_SIZE / 2, Math.min(H - PLAYER_SIZE / 2, player.y + (dy / len) * spd * DT))
      }

      // Player shooting
      shootTimerRef.current -= DT
      if ((keys.has('Space') || keys.has('KeyZ')) && shootTimerRef.current <= 0) {
        shootTimerRef.current = PLAYER_SHOOT_CD
        playerBulletsRef.current.push({ x: player.x, y: player.y - PLAYER_SIZE / 2, vy: -PLAYER_BULLET_SPEED, id: nextIdRef.current++ })
      }

      // Move player bullets
      playerBulletsRef.current = playerBulletsRef.current.filter(pb => {
        pb.y += pb.vy * DT
        return pb.y > -10
      })

      // Boss movement
      bossMoveXRef.current += bossMoveDirRef.current * 60 * DT
      if (bossMoveXRef.current > W - 80) bossMoveDirRef.current = -1
      if (bossMoveXRef.current < 80) bossMoveDirRef.current = 1

      // Boss fire patterns
      bossPatternTimerRef.current -= DT
      patternPhaseRef.current += DT

      const bossX = bossMoveXRef.current
      const phase = patternPhaseRef.current

      const patternCycle = Math.floor(phase / 8) % 4  // rotate through 4 patterns every 8s

      if (bossPatternTimerRef.current <= 0) {
        switch (patternCycle) {
          case 0: {
            // Spiral: fires bullets in a rotating spiral
            const spiralCount = 8
            for (let i = 0; i < spiralCount; i++) {
              const angle = (Math.PI * 2 / spiralCount) * i + phase * 1.8
              const speed = 120
              addBossBullet(bossX, BOSS_Y, Math.cos(angle) * speed, Math.sin(angle) * speed, '#ef5350', 7)
            }
            bossPatternTimerRef.current = 0.22
            break
          }
          case 1: {
            // Burst: aimed at player with spread
            const spread = 5
            for (let i = -spread; i <= spread; i++) {
              const baseAngle = Math.atan2(player.y - BOSS_Y, player.x - bossX)
              const angle = baseAngle + (i * Math.PI / 18)
              const speed = 150
              addBossBullet(bossX, BOSS_Y, Math.cos(angle) * speed, Math.sin(angle) * speed, '#fdd835', 6)
            }
            bossPatternTimerRef.current = 0.9
            break
          }
          case 2: {
            // Ring: 16 bullets in a ring, medium speed, every 0.5s
            const ringCount = 16
            for (let i = 0; i < ringCount; i++) {
              const angle = (Math.PI * 2 / ringCount) * i
              const speed = 95
              addBossBullet(bossX, BOSS_Y, Math.cos(angle) * speed, Math.sin(angle) * speed, '#ab47bc', 8)
            }
            bossPatternTimerRef.current = 0.5
            break
          }
          case 3: {
            // Curtain: 3 rows of slow bullets, slightly aimed
            const rows = 3
            for (let row = 0; row < rows; row++) {
              const count = 6 + row * 2
              for (let j = 0; j < count; j++) {
                const xOff = (j - (count - 1) / 2) * 30
                const speed = 70 + row * 20
                const aimAngle = Math.atan2(player.y - BOSS_Y, player.x - bossX)
                const spreadAngle = aimAngle + (Math.random() - 0.5) * 0.4
                addBossBullet(bossX + xOff * 0.5, BOSS_Y + row * 12, Math.cos(spreadAngle) * speed, Math.sin(spreadAngle) * speed, '#26c6da', 6)
              }
            }
            bossPatternTimerRef.current = 1.2
            break
          }
        }
        bossPatternRef.current = patternCycle
      }

      // Move boss bullets
      bulletsRef.current = bulletsRef.current.filter(b => {
        b.x += b.vx * DT
        b.y += b.vy * DT
        return b.x > -20 && b.x < W + 20 && b.y > -20 && b.y < H + 20
      })

      // Player bullet vs boss collision
      const playerBulletsToRemove = new Set<number>()
      for (const pb of playerBulletsRef.current) {
        const ddx = pb.x - bossX
        const ddy = pb.y - BOSS_Y
        if (Math.abs(ddx) < (BOSS_SIZE + 5) / 2 && Math.abs(ddy) < (BOSS_SIZE + 5) / 2) {
          playerBulletsToRemove.add(pb.id)
          bossHpRef.current = Math.max(0, bossHpRef.current - 5)
          setBossHp(bossHpRef.current)
          if (bossHpRef.current <= 0) {
            setScore(s => s + 5000)
            // Respawn boss with more HP
            bossHpRef.current = Math.floor(BOSS_MAX_HP * 1.3)
            setBossHp(bossHpRef.current)
            bulletsRef.current = []
          }
        }
      }
      playerBulletsRef.current = playerBulletsRef.current.filter(pb => !playerBulletsToRemove.has(pb.id))

      // Boss bullet vs player collision
      if (invulnRef.current > 0) {
        invulnRef.current -= DT
      } else {
        for (const b of bulletsRef.current) {
          const bdx = b.x - player.x
          const bdy = b.y - player.y
          if (Math.sqrt(bdx * bdx + bdy * bdy) < (PLAYER_SIZE / 2 + b.size / 2 - 1)) {
            invulnRef.current = 2.0
            livesRef.current--
            setLives(livesRef.current)
            if (livesRef.current <= 0) setGameState('gameover')
            // Clear bullets on hit
            bulletsRef.current = []
            break
          }
        }
      }

      // Score per second
      scoreTimerRef.current += DT
      if (scoreTimerRef.current >= 1) {
        scoreTimerRef.current -= 1
        setScore(s => s + 10)
      }

      forceRender()
    }, DT * 1000)
    return () => clearInterval(id)
  }, [gameState])

  // Input
  useEffect(() => {
    const down = (e: KeyboardEvent) => {
      keysRef.current.add(e.code)
      if ((gameState === 'idle' || gameState === 'gameover') && (e.code === 'Space' || e.code === 'Enter')) {
        e.preventDefault(); restart()
      }
    }
    const up = (e: KeyboardEvent) => keysRef.current.delete(e.code)
    window.addEventListener('keydown', down)
    window.addEventListener('keyup', up)
    return () => { window.removeEventListener('keydown', down); window.removeEventListener('keyup', up) }
  }, [gameState])

  function restart() {
    playerRef.current = { x: W / 2, y: H - 60 }
    bossHpRef.current = BOSS_MAX_HP
    bulletsRef.current = []
    playerBulletsRef.current = []
    keysRef.current.clear()
    nextIdRef.current = 1
    shootTimerRef.current = 0
    bossPatternTimerRef.current = 0
    bossPatternRef.current = 0
    patternPhaseRef.current = 0
    scoreTimerRef.current = 0
    livesRef.current = 3
    invulnRef.current = 0
    bossMoveDirRef.current = 1
    bossMoveXRef.current = BOSS_X
    setBossHp(BOSS_MAX_HP)
    setScore(0)
    setLives(3)
    setGameState('playing')
    setGameKey(k => k + 1)
  }

  const player = playerRef.current
  const bullets = bulletsRef.current
  const playerBullets = playerBulletsRef.current
  const bossX = bossMoveXRef.current
  const isFlashing = invulnRef.current > 0 && Math.floor(invulnRef.current * 10) % 2 === 0
  const patternNames = ['SPIRAL', 'BURST', 'RING', 'CURTAIN']
  const currentPattern = patternNames[Math.floor(patternPhaseRef.current / 8) % 4]

  return (
    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 0 }}>
      {/* HUD */}
      <div style={{
        width: W, display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', alignItems: 'center',
        padding: '7px 18px', background: '#0d0f1a', borderRadius: '10px 10px 0 0',
        fontSize: 13, color: '#90a4ae', letterSpacing: 1, userSelect: 'none',
      }}>
        <div style={{ display: 'flex', gap: 4 }}>
          {Array.from({ length: 3 }, (_, i) => (
            <span key={i} style={{ color: i < lives ? '#ef5350' : '#37474f', fontSize: 18 }}>&#9829;</span>
          ))}
        </div>
        <div style={{ textAlign: 'center' }}>
          <span style={{ color: '#4fc3f7', fontWeight: 700, fontSize: 18, letterSpacing: 3 }}>
            {String(score).padStart(7, '0')}
          </span>
        </div>
        <div style={{ textAlign: 'right', fontSize: 10, color: '#546e7a' }}>
          {gameState === 'playing' ? currentPattern : ''}
        </div>
      </div>

      {/* Boss HP bar */}
      <div style={{ width: W, height: 5, background: '#1a1f2e' }}>
        <div style={{
          width: `${(bossHp / BOSS_MAX_HP) * 100}%`, height: '100%',
          background: bossHp / BOSS_MAX_HP > 0.5 ? '#ef5350' : '#ff1744',
          transition: 'width 0.1s',
        }} />
      </div>

      {/* Game canvas */}
      <div style={{ position: 'relative', width: W, height: H }}>
        <Game key={gameKey} width={W} height={H} gravity={0}>
          <World background="#050810">
            <Camera2D x={W / 2} y={H / 2} background="#050810" />

            {/* Boss */}
            <Entity tags={['boss']}>
              <Transform x={bossX} y={BOSS_Y} />
              <Sprite width={BOSS_SIZE} height={BOSS_SIZE} color="#c62828" zIndex={10} />
            </Entity>
            {/* Boss eye / core */}
            <Entity tags={['boss-core']}>
              <Transform x={bossX} y={BOSS_Y} />
              <Sprite width={12} height={12} color="#ff5252" zIndex={11} />
            </Entity>

            {/* Boss bullets */}
            {bullets.map(b => (
              <Entity key={`b${b.id}`} tags={['boss-bullet']}>
                <Transform x={b.x} y={b.y} />
                <Sprite width={b.size} height={b.size} color={b.color} zIndex={6} />
              </Entity>
            ))}

            {/* Player bullets */}
            {playerBullets.map(pb => (
              <Entity key={`pb${pb.id}`} tags={['player-bullet']}>
                <Transform x={pb.x} y={pb.y} />
                <Sprite width={4} height={10} color="#80deea" zIndex={8} />
              </Entity>
            ))}

            {/* Player */}
            <Entity tags={['player']}>
              <Transform x={player.x} y={player.y} />
              <Sprite
                width={PLAYER_SIZE} height={PLAYER_SIZE}
                color={isFlashing ? '#050810' : '#4fc3f7'}
                zIndex={15}
              />
            </Entity>

            {/* Invuln flash ring */}
            {isFlashing && (
              <Entity tags={['invuln']}>
                <Transform x={player.x} y={player.y} />
                <Sprite width={20} height={20} color="#4fc3f733" zIndex={14} />
              </Entity>
            )}
          </World>
        </Game>

        {/* Idle overlay */}
        {gameState === 'idle' && (
          <div style={overlayStyle}>
            <div style={cardStyle}>
              <p style={{ fontSize: 11, letterSpacing: 4, color: '#ef5350', marginBottom: 8 }}>CUBEFORGE</p>
              <p style={{ fontSize: 32, fontWeight: 900, color: '#fff', letterSpacing: 2 }}>BULLET HELL</p>
              <p style={{ fontSize: 12, color: '#90a4ae', marginTop: 16, lineHeight: 1.9 }}>
                Dodge the boss bullet patterns<br />
                Shoot back to deplete its HP bar<br />
                Hold <strong style={{ color: '#fff' }}>SHIFT</strong> to slow focus mode
              </p>
              <p style={{ fontSize: 13, color: '#607d8b', marginTop: 20 }}>
                Press <strong style={{ color: '#fff' }}>SPACE</strong> to start
              </p>
            </div>
          </div>
        )}

        {/* Game over */}
        {gameState === 'gameover' && (
          <div style={overlayStyle}>
            <div style={cardStyle}>
              <p style={{ fontSize: 11, letterSpacing: 4, color: '#ef5350', marginBottom: 8 }}>OBLITERATED</p>
              <p style={{ fontSize: 36, fontWeight: 900, color: '#fff', letterSpacing: 3 }}>GAME OVER</p>
              <p style={{ fontSize: 13, color: '#90a4ae', margin: '12px 0 4px' }}>
                Score &nbsp;<strong style={{ color: '#4fc3f7' }}>{score}</strong>
              </p>
              <button onClick={restart} style={btnStyle}>Try Again</button>
            </div>
          </div>
        )}
      </div>

      {/* Controls */}
      <div style={{
        width: W, background: '#0d0f1a', borderRadius: '0 0 10px 10px',
        padding: '6px 18px', fontSize: 11, color: '#37474f', letterSpacing: 1.5,
        display: 'flex', justifyContent: 'space-between',
      }}>
        <span>WASD move &nbsp;&middot;&nbsp; Space shoot &nbsp;&middot;&nbsp; Shift slow focus</span>
        <span style={{ color: '#263238' }}>Cubeforge Engine</span>
      </div>
    </div>
  )
}

// ─── Styles ──────────────────────────────────────────────────────────────────
const overlayStyle: React.CSSProperties = {
  position: 'absolute', inset: 0, display: 'flex', alignItems: 'center',
  justifyContent: 'center', background: 'rgba(5,8,16,0.88)', backdropFilter: 'blur(4px)',
}
const cardStyle: React.CSSProperties = {
  textAlign: 'center', fontFamily: '"Courier New", monospace', padding: '36px 48px',
  background: '#0d0f1a', border: '1px solid #1e2535', borderRadius: 12,
}
const btnStyle: React.CSSProperties = {
  marginTop: 24, padding: '10px 32px', background: '#ef5350', color: '#fff',
  border: 'none', borderRadius: 6, fontFamily: '"Courier New", monospace',
  fontSize: 13, fontWeight: 700, letterSpacing: 2, cursor: 'pointer',
}
