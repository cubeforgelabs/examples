import { useState, useEffect, useCallback } from 'react'
import { Game, World, Camera2D, MovingPlatform, usePause, AssetLoader } from '@cubeforge/react'
import type { EntityId } from '@cubeforge/react'
import { Player }   from './components/Player'
import { Enemy }    from './components/Enemy'
import { Ground }   from './components/Ground'
import { Coin }     from './components/Coin'
import { gameCallbacks } from './gameEvents'

// ─── Asset preload ────────────────────────────────────────────────────────────
const ASSETS = ['/player_alt.png', '/slime_sheet.png', '/coin.png', '/ground_cave.png']

// ─── Constants ────────────────────────────────────────────────────────────────
const W           = 800   // canvas width
const H           = 560   // canvas height
const WORLD_W     = 1640  // scrollable world width
const FLOOR_Y     = 506   // world floor Y center
const TOTAL_COINS = 12
const MAX_LIVES   = 3

// ─── Coin layout ──────────────────────────────────────────────────────────────
// Placed above platforms; some are risky (high up or above enemies).
const COIN_DEFS = [
  { id:  1, x:  130, y: 390 },  // starter ledge
  { id:  2, x:  340, y: 335 },  // low-mid
  { id:  3, x:  550, y: 265 },  // high-left
  { id:  4, x:  420, y: 195 },  // very high left
  { id:  5, x:  720, y: 370 },  // center low
  { id:  6, x:  900, y: 300 },  // center mid
  { id:  7, x:  700, y: 215 },  // center high
  { id:  8, x:  920, y: 150 },  // top-center (risky)
  { id:  9, x: 1050, y: 375 },  // right low
  { id: 10, x: 1200, y: 305 },  // right mid
  { id: 11, x: 1300, y: 175 },  // right high
  { id: 12, x: 1500, y: 375 },  // end ledge
]

// ─── Types ────────────────────────────────────────────────────────────────────
type GameState = 'playing' | 'gameover' | 'win'

// ─── Helpers ─────────────────────────────────────────────────────────────────
function fmtTime(secs: number) {
  const m = Math.floor(secs / 60)
  const s = secs % 60
  return `${m}:${String(s).padStart(2, '0')}`
}

function Heart({ filled }: { filled: boolean }) {
  return (
    <span style={{ color: filled ? '#ef5350' : '#37474f', fontSize: 18, lineHeight: 1 }}>♥</span>
  )
}

// ─── PauseController — must be inside <Game> to access EngineContext ──────────
function PauseController({ onPauseChange }: { onPauseChange: (p: boolean) => void }) {
  const { paused, pause, resume } = usePause()
  useEffect(() => { onPauseChange(paused) }, [paused, onPauseChange])
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.code === 'KeyP' || e.code === 'Escape') {
        if (paused) resume()
        else pause()
      }
    }
    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
  }, [paused, pause, resume])
  return null
}

// ─── App ──────────────────────────────────────────────────────────────────────
export function App() {
  const [gameKey,        setGameKey]        = useState(0)
  const [score,          setScore]          = useState(0)
  const [lives,          setLives]          = useState(MAX_LIVES)
  const [gameState,      setGameState]      = useState<GameState>('playing')
  const [collectedCoins, setCollectedCoins] = useState<Set<number>>(new Set())
  const [time,           setTime]           = useState(0)
  const [paused,         setPaused]         = useState(false)

  // Timer (ticks while playing and not paused)
  useEffect(() => {
    if (gameState !== 'playing' || paused) return
    const id = setInterval(() => setTime(t => t + 1), 1000)
    return () => clearInterval(id)
  }, [gameState, gameKey, paused])

  // Wire game-script callbacks into React state
  useEffect(() => {
    gameCallbacks.onPlayerHurt = () => {
      setLives(prev => {
        const next = prev - 1
        if (next <= 0) setGameState('gameover')
        return Math.max(0, next)
      })
    }
    gameCallbacks.onEnemyKill = () => {
      setScore(s => s + 50)
    }
    return () => {
      gameCallbacks.onPlayerHurt = null
      gameCallbacks.onEnemyKill  = null
    }
  }, [gameKey])

  const handleCoinCollect = useCallback((_eid: EntityId, coinId: number) => {
    setCollectedCoins(prev => {
      const next = new Set([...prev, coinId])
      if (next.size >= TOTAL_COINS) setGameState('win')
      return next
    })
    setScore(s => s + 10)
  }, [])

  function restart() {
    setScore(0)
    setLives(MAX_LIVES)
    setGameState('playing')
    setCollectedCoins(new Set())
    setTime(0)
    setGameKey(k => k + 1)  // remount engine
  }

  const collected = collectedCoins.size

  return (
    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 0 }}>

      {/* ── HUD ────────────────────────────────────────────────────────────── */}
      <div style={{
        width: W,
        display: 'grid',
        gridTemplateColumns: '1fr 1fr 1fr',
        alignItems: 'center',
        padding: '7px 18px',
        background: '#0d0f1a',
        borderRadius: '10px 10px 0 0',
        fontSize: 13,
        color: '#90a4ae',
        letterSpacing: 1,
        userSelect: 'none',
      }}>
        {/* Lives */}
        <div style={{ display: 'flex', gap: 4, alignItems: 'center' }}>
          {Array.from({ length: MAX_LIVES }, (_, i) => (
            <Heart key={i} filled={i < lives} />
          ))}
        </div>

        {/* Score + coins */}
        <div style={{ textAlign: 'center', display: 'flex', flexDirection: 'column', gap: 1 }}>
          <span style={{ color: '#ffd54f', fontWeight: 700, fontSize: 15, letterSpacing: 2 }}>
            {String(score).padStart(5, '0')}
          </span>
          <span style={{ fontSize: 10, color: '#546e7a' }}>
            {'●'.repeat(collected)}{'○'.repeat(TOTAL_COINS - collected)} {collected}/{TOTAL_COINS}
          </span>
        </div>

        {/* Timer */}
        <div style={{ textAlign: 'right', fontVariantNumeric: 'tabular-nums', color: '#607d8b' }}>
          {fmtTime(time)}
        </div>
      </div>

      {/* ── Game canvas + overlays ──────────────────────────────────────────── */}
      <div style={{ position: 'relative', width: W, height: H }}>

        <Game key={gameKey} width={W} height={H} gravity={1000} asyncAssets>
          {gameState === 'playing' && <PauseController onPauseChange={setPaused} />}
          <AssetLoader assets={ASSETS} fallback={
            <div style={{
              position: 'absolute', inset: 0,
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              background: '#0a0a0f', color: '#546e7a',
              fontFamily: '"Courier New", monospace', fontSize: 13, letterSpacing: 3,
            }}>LOADING...</div>
          }>
          <World background="#12131f">
            <Camera2D followEntity="player" smoothing={0.88} background="#12131f" />

            {/* Player */}
            <Player x={80} y={420} />

            {/* Enemies — 4 total, floor + platform patrol */}
            <Enemy x={340}  y={465} patrolLeft={200}  patrolRight={490}  />
            <Enemy x={1090} y={465} patrolLeft={940}  patrolRight={1250} />
            <Enemy x={500}  y={308} patrolLeft={415}  patrolRight={595}  />
            <Enemy x={1200} y={278} patrolLeft={1110} patrolRight={1370} />

            {/* Coins */}
            {COIN_DEFS
              .filter(c => !collectedCoins.has(c.id))
              .map(c => (
                <Coin
                  key={c.id}
                  x={c.x}
                  y={c.y}
                  onCollect={(eid) => handleCoinCollect(eid, c.id)}
                />
              ))
            }

            {/* ── Floor ──────────────────────────────────────────────────── */}
            <Ground key="floor"  x={WORLD_W / 2} y={FLOOR_Y}      width={WORLD_W} height={28} color="#1e272e" />

            {/* ── Left wall / Right wall ──────────────────────────────────── */}
            <Ground key="wall-l" x={-10}          y={300} width={20}  height={800} color="#12131f" />
            <Ground key="wall-r" x={WORLD_W + 10} y={300} width={20}  height={800} color="#12131f" />

            {/* ── Left section (x 0–600) ──────────────────────────────────── */}
            {/* Tier 1 — low (one-way: jump through from below) */}
            <Ground key="l1a" x={130}  y={450} width={160} height={18} color="#263238" oneWay />
            <Ground key="l1b" x={340}  y={415} width={140} height={18} color="#263238" oneWay />
            <Ground key="l1c" x={530}  y={380} width={130} height={18} color="#2e3a40" oneWay />

            {/* Tier 2 — mid */}
            <Ground key="l2a" x={200}  y={320} width={120} height={18} color="#37474f" />
            <Ground key="l2b" x={420}  y={285} width={110} height={18} color="#37474f" />
            <Ground key="l2c" x={610}  y={310} width={120} height={18} color="#37474f" />

            {/* Moving platform — carries player left and right */}
            <MovingPlatform key="mp1" x1={250} y1={360} x2={480} y2={360} width={100} duration={3} color="#1a6b8a" />

            {/* Tier 3 — high */}
            <Ground key="l3a" x={300}  y={215} width={100} height={18} color="#455a64" />
            <Ground key="l3b" x={550}  y={185} width={110} height={18} color="#455a64" />

            {/* ── Center section (x 600–1100) ─────────────────────────────── */}
            {/* Tier 1 — low */}
            <Ground key="c1a" x={730}  y={445} width={140} height={18} color="#263238" />
            <Ground key="c1b" x={900}  y={405} width={130} height={18} color="#2e3a40" />

            {/* Tier 2 — mid */}
            <Ground key="c2a" x={780}  y={310} width={120} height={18} color="#37474f" />
            <Ground key="c2b" x={980}  y={265} width={110} height={18} color="#37474f" />

            {/* Tier 3 — high */}
            <Ground key="c3a" x={700}  y={210} width={100} height={18} color="#455a64" />
            <Ground key="c3b" x={920}  y={165} width={100} height={18} color="#546e7a" />

            {/* ── Right section (x 1100–1640) ──────────────────────────────── */}
            {/* Tier 1 — low */}
            <Ground key="r1a" x={1070} y={445} width={140} height={18} color="#263238" />
            <Ground key="r1b" x={1260} y={405} width={130} height={18} color="#2e3a40" />
            <Ground key="r1c" x={1490} y={445} width={150} height={18} color="#263238" />

            {/* Tier 2 — mid */}
            <Ground key="r2a" x={1160} y={295} width={120} height={18} color="#37474f" />
            <Ground key="r2b" x={1380} y={255} width={120} height={18} color="#37474f" />

            {/* Tier 3 — high */}
            <Ground key="r3a" x={1290} y={185} width={110} height={18} color="#455a64" />
            <Ground key="r3b" x={1490} y={150} width={100} height={18} color="#546e7a" />
          </World>
          </AssetLoader>
        </Game>

        {/* ── Pause overlay ────────────────────────────────────────────────── */}
        {paused && gameState === 'playing' && (
          <div style={overlayStyle}>
            <div style={cardStyle}>
              <p style={{ fontSize: 11, letterSpacing: 4, color: '#4fc3f7', marginBottom: 8 }}>PAUSED</p>
              <p style={{ fontSize: 30, fontWeight: 900, color: '#fff', letterSpacing: 3 }}>‖</p>
              <p style={{ fontSize: 11, color: '#546e7a', marginTop: 16 }}>Press P or Esc to resume</p>
            </div>
          </div>
        )}

        {/* ── Win overlay ──────────────────────────────────────────────────── */}
        {gameState === 'win' && (
          <div style={overlayStyle}>
            <div style={cardStyle}>
              <p style={{ fontSize: 11, letterSpacing: 4, color: '#ffd54f', marginBottom: 8 }}>
                ALL COINS COLLECTED
              </p>
              <p style={{ fontSize: 36, fontWeight: 900, color: '#fff', letterSpacing: 3 }}>
                YOU WIN
              </p>
              <p style={{ fontSize: 13, color: '#90a4ae', margin: '12px 0 4px' }}>
                Score &nbsp;<strong style={{ color: '#ffd54f' }}>{score}</strong>
              </p>
              <p style={{ fontSize: 12, color: '#546e7a' }}>
                Time &nbsp;{fmtTime(time)}
              </p>
              <button onClick={restart} style={btnStyle}>Play Again</button>
            </div>
          </div>
        )}

        {/* ── Game Over overlay ─────────────────────────────────────────────── */}
        {gameState === 'gameover' && (
          <div style={overlayStyle}>
            <div style={cardStyle}>
              <p style={{ fontSize: 11, letterSpacing: 4, color: '#ef5350', marginBottom: 8 }}>
                OUT OF LIVES
              </p>
              <p style={{ fontSize: 36, fontWeight: 900, color: '#fff', letterSpacing: 3 }}>
                GAME OVER
              </p>
              <p style={{ fontSize: 13, color: '#90a4ae', margin: '12px 0 4px' }}>
                Score &nbsp;<strong style={{ color: '#ffd54f' }}>{score}</strong>
              </p>
              <p style={{ fontSize: 12, color: '#546e7a' }}>
                Coins &nbsp;{collected}/{TOTAL_COINS}
              </p>
              <button onClick={restart} style={btnStyle}>Try Again</button>
            </div>
          </div>
        )}
      </div>

      {/* ── Controls hint ────────────────────────────────────────────────────── */}
      <div style={{
        width: W,
        background: '#0d0f1a',
        borderRadius: '0 0 10px 10px',
        padding: '6px 18px',
        fontSize: 11,
        color: '#37474f',
        letterSpacing: 1.5,
        display: 'flex',
        justifyContent: 'space-between',
      }}>
        <span>WASD / Arrows — move &nbsp;·&nbsp; Space / Up — jump (×2) &nbsp;·&nbsp; Jump on enemies to stomp &nbsp;·&nbsp; P — pause</span>
        <span style={{ color: '#263238' }}>Cubeforge Engine</span>
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
  padding:      '36px 48px',
  background:   '#0d0f1a',
  border:       '1px solid #1e2535',
  borderRadius: 12,
}

const btnStyle: React.CSSProperties = {
  marginTop:    24,
  padding:      '10px 32px',
  background:   '#4fc3f7',
  color:        '#0a0a0f',
  border:       'none',
  borderRadius: 6,
  fontFamily:   '"Courier New", monospace',
  fontSize:     13,
  fontWeight:   700,
  letterSpacing: 2,
  cursor:       'pointer',
}
