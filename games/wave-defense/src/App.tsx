import { useEffect, useReducer, useRef, useState, useCallback } from 'react'
import { Game, World, Camera2D, Entity, Transform, Sprite } from '@cubeforge/react'

// ─── Constants ────────────────────────────────────────────────────────────────
const W = 700
const H = 550
const TURRET_X = W / 2
const TURRET_Y = H / 2
const TURRET_SIZE = 22
const BULLET_SPEED = 500
const BULLET_SIZE = 7
const SHOOT_COOLDOWN = 0.18
const BETWEEN_WAVE_DURATION = 30 // seconds countdown
const DT = 1 / 60

type GameState = 'idle' | 'playing' | 'between-waves' | 'gameover'

// 5 enemy types
interface EnemyType {
  color: string; size: number; hp: number; speed: number; damage: number; score: number
}
const ENEMY_TYPES: EnemyType[] = [
  { color: '#ef5350', size: 14, hp: 1,  speed: 90,  damage: 10, score: 10 }, // basic
  { color: '#ff7043', size: 18, hp: 3,  speed: 60,  damage: 15, score: 25 }, // tank
  { color: '#ab47bc', size: 10, hp: 1,  speed: 140, damage: 8,  score: 20 }, // fast
  { color: '#fdd835', size: 22, hp: 6,  speed: 40,  damage: 20, score: 50 }, // brute
  { color: '#26c6da', size: 12, hp: 2,  speed: 100, damage: 12, score: 30 }, // shooter
]

interface Enemy {
  x: number; y: number; hp: number; maxHp: number; id: number
  type: number; size: number; speed: number; damage: number; score: number; color: string
}

interface Bullet {
  x: number; y: number; vx: number; vy: number; id: number
}

// ─── App ─────────────────────────────────────────────────────────────────────
export function App() {
  const [gameKey, setGameKey] = useState(0)
  const [score, setScore] = useState(0)
  const [wave, setWave] = useState(1)
  const [playerHp, setPlayerHp] = useState(100)
  const [gameState, setGameState] = useState<GameState>('idle')
  const [countdown, setCountdown] = useState(BETWEEN_WAVE_DURATION)

  const enemiesRef = useRef<Enemy[]>([])
  const bulletsRef = useRef<Bullet[]>([])
  const mouseRef = useRef({ x: W / 2, y: 0 })
  const shootingRef = useRef(false)
  const shootTimerRef = useRef(0)
  const nextIdRef = useRef(1)
  const playerHpRef = useRef(100)
  const waveRef = useRef(1)
  const comboRef = useRef(0)
  const comboTimerRef = useRef(0)
  const countdownRef = useRef(BETWEEN_WAVE_DURATION)

  const [, forceRender] = useReducer(n => n + 1, 0)

  const spawnWaveEnemies = useCallback((waveNum: number) => {
    const count = 6 + waveNum * 3
    for (let i = 0; i < count; i++) {
      const side = Math.floor(Math.random() * 4)
      let x: number, y: number
      if (side === 0) { x = Math.random() * W; y = -20 }
      else if (side === 1) { x = Math.random() * W; y = H + 20 }
      else if (side === 2) { x = -20; y = Math.random() * H }
      else { x = W + 20; y = Math.random() * H }

      // Higher waves unlock more enemy types
      const maxType = Math.min(ENEMY_TYPES.length - 1, Math.floor(waveNum / 2))
      const typeIdx = Math.floor(Math.random() * (maxType + 1))
      const et = ENEMY_TYPES[typeIdx]
      const hpScale = 1 + (waveNum - 1) * 0.25
      const hp = Math.ceil(et.hp * hpScale)
      enemiesRef.current.push({
        x, y, hp, maxHp: hp,
        id: nextIdRef.current++,
        type: typeIdx, size: et.size,
        speed: et.speed + waveNum * 2,
        damage: et.damage, score: et.score, color: et.color,
      })
    }
  }, [])

  // Main loop
  useEffect(() => {
    if (gameState !== 'playing') return
    const id = setInterval(() => {
      const mouse = mouseRef.current

      // Shoot
      shootTimerRef.current -= DT
      if (shootingRef.current && shootTimerRef.current <= 0) {
        shootTimerRef.current = SHOOT_COOLDOWN
        const dx = mouse.x - TURRET_X
        const dy = mouse.y - TURRET_Y
        const len = Math.sqrt(dx * dx + dy * dy) || 1
        bulletsRef.current.push({
          x: TURRET_X, y: TURRET_Y,
          vx: (dx / len) * BULLET_SPEED,
          vy: (dy / len) * BULLET_SPEED,
          id: nextIdRef.current++,
        })
      }

      // Move bullets
      bulletsRef.current = bulletsRef.current.filter(b => {
        b.x += b.vx * DT
        b.y += b.vy * DT
        return b.x > -10 && b.x < W + 10 && b.y > -10 && b.y < H + 10
      })

      // Combo decay
      if (comboTimerRef.current > 0) {
        comboTimerRef.current -= DT
        if (comboTimerRef.current <= 0) comboRef.current = 0
      }

      // Bullet-enemy collisions
      const bulletsToRemove = new Set<number>()
      const enemiesToRemove = new Set<number>()
      for (const e of enemiesRef.current) {
        for (const b of bulletsRef.current) {
          if (bulletsToRemove.has(b.id)) continue
          const bdx = b.x - e.x
          const bdy = b.y - e.y
          if (Math.abs(bdx) < (e.size + BULLET_SIZE) / 2 && Math.abs(bdy) < (e.size + BULLET_SIZE) / 2) {
            e.hp--
            bulletsToRemove.add(b.id)
            if (e.hp <= 0) {
              enemiesToRemove.add(e.id)
              comboRef.current++
              comboTimerRef.current = 2.5
              const multiplier = 1 + Math.floor(comboRef.current / 3) * 0.5
              setScore(s => s + Math.round(e.score * multiplier))
            }
          }
        }
      }
      bulletsRef.current = bulletsRef.current.filter(b => !bulletsToRemove.has(b.id))
      enemiesRef.current = enemiesRef.current.filter(e => !enemiesToRemove.has(e.id))

      // Move enemies toward center
      for (const e of enemiesRef.current) {
        const edx = TURRET_X - e.x
        const edy = TURRET_Y - e.y
        const elen = Math.sqrt(edx * edx + edy * edy) || 1
        e.x += (edx / elen) * e.speed * DT
        e.y += (edy / elen) * e.speed * DT

        // Contact with turret
        const dist = Math.sqrt((e.x - TURRET_X) ** 2 + (e.y - TURRET_Y) ** 2)
        if (dist < (TURRET_SIZE + e.size) / 2) {
          enemiesRef.current = enemiesRef.current.filter(en => en.id !== e.id)
          playerHpRef.current = Math.max(0, playerHpRef.current - e.damage)
          setPlayerHp(playerHpRef.current)
          if (playerHpRef.current <= 0) setGameState('gameover')
        }
      }

      // Wave cleared?
      if (enemiesRef.current.length === 0) {
        setGameState('between-waves')
        countdownRef.current = BETWEEN_WAVE_DURATION
        setCountdown(BETWEEN_WAVE_DURATION)
      }

      forceRender()
    }, DT * 1000)
    return () => clearInterval(id)
  }, [gameState])

  // Between-waves countdown
  useEffect(() => {
    if (gameState !== 'between-waves') return
    const id = setInterval(() => {
      countdownRef.current -= 1
      setCountdown(countdownRef.current)
      if (countdownRef.current <= 0) {
        const nextWave = waveRef.current + 1
        waveRef.current = nextWave
        setWave(nextWave)
        spawnWaveEnemies(nextWave)
        setGameState('playing')
      }
    }, 1000)
    return () => clearInterval(id)
  }, [gameState, spawnWaveEnemies])

  // Input
  useEffect(() => {
    const down = (e: KeyboardEvent) => {
      if ((gameState === 'idle' || gameState === 'gameover') && (e.code === 'Space' || e.code === 'Enter')) {
        e.preventDefault(); restart()
      }
      if (gameState === 'between-waves' && (e.code === 'Space' || e.code === 'Enter')) {
        e.preventDefault()
        countdownRef.current = 0
        setCountdown(0)
      }
    }
    window.addEventListener('keydown', down)
    return () => window.removeEventListener('keydown', down)
  }, [gameState])

  const handleMouseMove = useCallback((e: React.MouseEvent<HTMLDivElement>) => {
    const rect = e.currentTarget.getBoundingClientRect()
    mouseRef.current = { x: e.clientX - rect.left, y: e.clientY - rect.top }
  }, [])
  const handleMouseDown = useCallback(() => { shootingRef.current = true }, [])
  const handleMouseUp = useCallback(() => { shootingRef.current = false }, [])

  function restart() {
    enemiesRef.current = []
    bulletsRef.current = []
    nextIdRef.current = 1
    shootTimerRef.current = 0
    playerHpRef.current = 100
    waveRef.current = 1
    comboRef.current = 0
    comboTimerRef.current = 0
    countdownRef.current = BETWEEN_WAVE_DURATION
    shootingRef.current = false
    setScore(0)
    setWave(1)
    setPlayerHp(100)
    setCountdown(BETWEEN_WAVE_DURATION)
    // Spawn wave 1
    const tempEnemies: Enemy[] = []
    const count = 9
    for (let i = 0; i < count; i++) {
      const side = Math.floor(Math.random() * 4)
      let x: number, y: number
      if (side === 0) { x = Math.random() * W; y = -20 }
      else if (side === 1) { x = Math.random() * W; y = H + 20 }
      else if (side === 2) { x = -20; y = Math.random() * H }
      else { x = W + 20; y = Math.random() * H }
      const et = ENEMY_TYPES[0]
      tempEnemies.push({ x, y, hp: 1, maxHp: 1, id: nextIdRef.current++, type: 0, size: et.size, speed: et.speed, damage: et.damage, score: et.score, color: et.color })
    }
    enemiesRef.current = tempEnemies
    setGameState('playing')
    setGameKey(k => k + 1)
  }

  const enemies = enemiesRef.current
  const bullets = bulletsRef.current
  const combo = comboRef.current
  const multiplier = 1 + Math.floor(combo / 3) * 0.5

  return (
    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 0 }}>
      {/* HUD */}
      <div style={{
        width: W, display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', alignItems: 'center',
        padding: '7px 18px', background: '#0d0f1a', borderRadius: '10px 10px 0 0',
        fontSize: 13, color: '#90a4ae', letterSpacing: 1, userSelect: 'none',
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <span style={{ fontSize: 11, color: '#607d8b' }}>HP</span>
          <div style={{ width: 80, height: 6, background: '#1a1f2e', borderRadius: 3 }}>
            <div style={{
              width: `${playerHp}%`, height: '100%', borderRadius: 3,
              background: playerHp > 50 ? '#69f0ae' : playerHp > 25 ? '#fdd835' : '#ef5350',
              transition: 'width 0.1s',
            }} />
          </div>
        </div>
        <div style={{ textAlign: 'center' }}>
          <span style={{ color: '#4fc3f7', fontWeight: 700, fontSize: 18, letterSpacing: 3 }}>
            {String(score).padStart(6, '0')}
          </span>
        </div>
        <div style={{ textAlign: 'right', fontSize: 11, color: '#607d8b', display: 'flex', justifyContent: 'flex-end', gap: 12 }}>
          {combo >= 3 && <span style={{ color: '#fdd835' }}>x{multiplier.toFixed(1)}</span>}
          <span>WAVE {wave}</span>
        </div>
      </div>

      {/* Game */}
      <div
        style={{ position: 'relative', width: W, height: H, cursor: 'crosshair' }}
        onMouseMove={handleMouseMove}
        onMouseDown={handleMouseDown}
        onMouseUp={handleMouseUp}
      >
        <Game key={gameKey} width={W} height={H} gravity={0}>
          <World background="#0d1117">
            <Camera2D x={W / 2} y={H / 2} background="#0d1117" />

            {/* Range circle (decorative) */}
            <Entity tags={['range']}>
              <Transform x={TURRET_X} y={TURRET_Y} />
              <Sprite width={300} height={300} color="#4fc3f706" zIndex={1} />
            </Entity>

            {/* Bullets */}
            {bullets.map(b => (
              <Entity key={`b${b.id}`} tags={['bullet']}>
                <Transform x={b.x} y={b.y} />
                <Sprite width={BULLET_SIZE} height={BULLET_SIZE} color="#fdd835" zIndex={8} />
              </Entity>
            ))}

            {/* Enemies */}
            {enemies.map(e => (
              <Entity key={`e${e.id}`} tags={['enemy']}>
                <Transform x={e.x} y={e.y} />
                <Sprite
                  width={e.size} height={e.size}
                  color={e.hp / e.maxHp < 0.4 ? '#ff1744' : e.color}
                  zIndex={5}
                />
              </Entity>
            ))}

            {/* Turret */}
            <Entity tags={['turret']}>
              <Transform x={TURRET_X} y={TURRET_Y} />
              <Sprite width={TURRET_SIZE} height={TURRET_SIZE} color="#4fc3f7" zIndex={10} />
            </Entity>

            {/* Crosshair */}
            <Entity tags={['crosshair']}>
              <Transform x={mouseRef.current.x} y={mouseRef.current.y} />
              <Sprite width={2} height={14} color="#ffffff55" zIndex={15} />
            </Entity>
            <Entity tags={['crosshair']}>
              <Transform x={mouseRef.current.x} y={mouseRef.current.y} />
              <Sprite width={14} height={2} color="#ffffff55" zIndex={15} />
            </Entity>
          </World>
        </Game>

        {/* Idle overlay */}
        {gameState === 'idle' && (
          <div style={overlayStyle}>
            <div style={cardStyle}>
              <p style={{ fontSize: 11, letterSpacing: 4, color: '#4fc3f7', marginBottom: 8 }}>CUBEFORGE</p>
              <p style={{ fontSize: 32, fontWeight: 900, color: '#fff', letterSpacing: 2 }}>WAVE DEFENSE</p>
              <p style={{ fontSize: 12, color: '#90a4ae', marginTop: 16, lineHeight: 1.8 }}>
                You are a stationary turret at the center<br />
                Aim and shoot incoming enemies<br />
                Build combos for score multipliers
              </p>
              <p style={{ fontSize: 13, color: '#607d8b', marginTop: 20 }}>
                Press <strong style={{ color: '#fff' }}>SPACE</strong> to start
              </p>
            </div>
          </div>
        )}

        {/* Between waves overlay */}
        {gameState === 'between-waves' && (
          <div style={overlayStyle}>
            <div style={cardStyle}>
              <p style={{ fontSize: 11, letterSpacing: 4, color: '#69f0ae', marginBottom: 12 }}>WAVE {wave} CLEARED</p>
              <p style={{ fontSize: 28, fontWeight: 900, color: '#fff', marginBottom: 16 }}>Next Wave in</p>
              <p style={{ fontSize: 56, fontWeight: 900, color: '#4fc3f7', letterSpacing: 4 }}>{countdown}</p>
              <p style={{ fontSize: 11, color: '#546e7a', marginTop: 16 }}>
                Press <strong style={{ color: '#90a4ae' }}>SPACE</strong> to skip
              </p>
            </div>
          </div>
        )}

        {/* Game over */}
        {gameState === 'gameover' && (
          <div style={overlayStyle}>
            <div style={cardStyle}>
              <p style={{ fontSize: 11, letterSpacing: 4, color: '#ef5350', marginBottom: 8 }}>TURRET DESTROYED</p>
              <p style={{ fontSize: 36, fontWeight: 900, color: '#fff', letterSpacing: 3 }}>GAME OVER</p>
              <p style={{ fontSize: 13, color: '#90a4ae', margin: '12px 0 4px' }}>
                Score &nbsp;<strong style={{ color: '#4fc3f7' }}>{score}</strong>
                &nbsp;&middot;&nbsp; Wave &nbsp;<strong style={{ color: '#69f0ae' }}>{wave}</strong>
              </p>
              <button onClick={restart} style={btnStyle}>Try Again</button>
            </div>
          </div>
        )}
      </div>

      {/* Enemy legend + controls */}
      <div style={{
        width: W, background: '#0d0f1a', borderRadius: '0 0 10px 10px',
        padding: '6px 18px', fontSize: 11, color: '#37474f', letterSpacing: 1.3,
        display: 'flex', justifyContent: 'space-between', alignItems: 'center',
      }}>
        <span>Mouse aim &nbsp;&middot;&nbsp; Click to shoot &nbsp;&middot;&nbsp; Kill combos boost score multiplier</span>
        <span style={{ color: '#263238' }}>Cubeforge Engine</span>
      </div>
    </div>
  )
}

// ─── Styles ──────────────────────────────────────────────────────────────────
const overlayStyle: React.CSSProperties = {
  position: 'absolute', inset: 0, display: 'flex', alignItems: 'center',
  justifyContent: 'center', background: 'rgba(10,10,18,0.82)', backdropFilter: 'blur(4px)',
}
const cardStyle: React.CSSProperties = {
  textAlign: 'center', fontFamily: '"Courier New", monospace', padding: '36px 48px',
  background: '#0d0f1a', border: '1px solid #1e2535', borderRadius: 12,
}
const btnStyle: React.CSSProperties = {
  marginTop: 24, padding: '10px 32px', background: '#4fc3f7', color: '#0a0a0f',
  border: 'none', borderRadius: 6, fontFamily: '"Courier New", monospace',
  fontSize: 13, fontWeight: 700, letterSpacing: 2, cursor: 'pointer',
}
