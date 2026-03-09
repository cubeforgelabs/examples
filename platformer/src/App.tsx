import { useState, useEffect, useCallback, useMemo } from 'react'
import { Game, World, Camera2D, MovingPlatform, usePause, AssetLoader } from '@cubeforge/react'
import type { EntityId } from '@cubeforge/react'
import { Player }       from './components/Player'
import { Enemy }        from './components/Enemy'
import { FlyingEnemy }  from './components/FlyingEnemy'
import { ChaserEnemy }  from './components/ChaserEnemy'
import { Ground }       from './components/Ground'
import { Coin }         from './components/Coin'
import { gameCallbacks } from './gameEvents'
import { generateLevel } from './levelGenerator'

// ─── Asset preload ────────────────────────────────────────────────────────────
const ASSETS = ['/player_alt.png', '/slime_sheet.png', '/coin.png', '/ground_cave.png', '/ground_rock.png', '/tile.png', '/enemy.png']

// ─── Constants ────────────────────────────────────────────────────────────────
const W          = 800
const H          = 560
const FLOOR_Y    = 506
const MAX_LIVES  = 3
const MAX_LEVELS = 3

// ─── Types ────────────────────────────────────────────────────────────────────
type GameState = 'playing' | 'gameover' | 'win' | 'levelcomplete'

// ─── Helpers ──────────────────────────────────────────────────────────────────
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

function PauseController({ onPauseChange }: { onPauseChange: (p: boolean) => void }) {
  const { paused, pause, resume } = usePause()
  useEffect(() => { onPauseChange(paused) }, [paused, onPauseChange])
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.code === 'KeyP' || e.code === 'Escape') paused ? resume() : pause()
    }
    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
  }, [paused, pause, resume])
  return null
}

// ─── App ──────────────────────────────────────────────────────────────────────
export function App() {
  const [levelNum,       setLevelNum]       = useState(1)
  const [seed,           setSeed]           = useState(() => Math.floor(Math.random() * 0xffffff))
  const [gameKey,        setGameKey]        = useState(0)
  const [score,          setScore]          = useState(0)
  const [lives,          setLives]          = useState(MAX_LIVES)
  const [gameState,      setGameState]      = useState<GameState>('playing')
  const [collectedCoins, setCollectedCoins] = useState<Set<number>>(new Set())
  const [time,           setTime]           = useState(0)
  const [paused,         setPaused]         = useState(false)

  // Procedurally generate the level — stable reference as long as levelNum/seed don't change
  const levelData = useMemo(() => generateLevel(levelNum, seed), [levelNum, seed])

  // Timer
  useEffect(() => {
    if (gameState !== 'playing' || paused) return
    const id = setInterval(() => setTime(t => t + 1), 1000)
    return () => clearInterval(id)
  }, [gameState, gameKey, paused])

  // Wire ECS callbacks → React state
  useEffect(() => {
    gameCallbacks.onPlayerHurt = () => {
      setLives(prev => {
        const next = prev - 1
        if (next <= 0) setGameState('gameover')
        return Math.max(0, next)
      })
    }
    gameCallbacks.onEnemyKill = () => setScore(s => s + 50)
    return () => {
      gameCallbacks.onPlayerHurt = null
      gameCallbacks.onEnemyKill  = null
    }
  }, [gameKey])

  const handleCoinCollect = useCallback((_eid: EntityId, coinId: number) => {
    setCollectedCoins(prev => {
      const next = new Set([...prev, coinId])
      if (next.size >= levelData.totalCoins) {
        if (levelNum >= MAX_LEVELS) setGameState('win')
        else                        setGameState('levelcomplete')
      }
      return next
    })
    setScore(s => s + 10)
  }, [levelData.totalCoins, levelNum])

  function nextLevel() {
    setLevelNum(n => n + 1)
    setSeed(Math.floor(Math.random() * 0xffffff))
    setCollectedCoins(new Set())
    setGameState('playing')
    setGameKey(k => k + 1)
  }

  function restart() {
    setLevelNum(1)
    setSeed(Math.floor(Math.random() * 0xffffff))
    setScore(0)
    setLives(MAX_LIVES)
    setGameState('playing')
    setCollectedCoins(new Set())
    setTime(0)
    setGameKey(k => k + 1)
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
        <div style={{ display: 'flex', gap: 4, alignItems: 'center' }}>
          {Array.from({ length: MAX_LIVES }, (_, i) => <Heart key={i} filled={i < lives} />)}
        </div>
        <div style={{ textAlign: 'center', display: 'flex', flexDirection: 'column', gap: 1 }}>
          <span style={{ color: '#ffd54f', fontWeight: 700, fontSize: 15, letterSpacing: 2 }}>
            {String(score).padStart(5, '0')}
          </span>
          <span style={{ fontSize: 10, color: '#546e7a' }}>
            {'●'.repeat(collected)}{'○'.repeat(levelData.totalCoins - collected)}{' '}
            {collected}/{levelData.totalCoins} &nbsp;·&nbsp; LV{levelNum}
          </span>
        </div>
        <div style={{ textAlign: 'right', fontVariantNumeric: 'tabular-nums', color: '#607d8b' }}>
          {fmtTime(time)}
        </div>
      </div>

      {/* ── Game canvas ─────────────────────────────────────────────────────── */}
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
          <World background={levelData.background}>
            <Camera2D followEntity="player" smoothing={0.88} background={levelData.background} />

            {/* Player */}
            <Player x={80} y={420} />

            {/* Generated enemies */}
            {levelData.enemies.map(e =>
              e.flying  ? <FlyingEnemy key={e.key} x={e.x} y={e.y} patrolLeft={e.patrolLeft} patrolRight={e.patrolRight} color={e.color} /> :
              e.chaser  ? <ChaserEnemy key={e.key} x={e.x} y={e.y} patrolLeft={e.patrolLeft} patrolRight={e.patrolRight} speed={e.speed} color={e.color} /> :
                          <Enemy       key={e.key} x={e.x} y={e.y} patrolLeft={e.patrolLeft} patrolRight={e.patrolRight} speed={e.speed} color={e.color} />
            )}

            {/* Generated coins */}
            {levelData.coins
              .filter(c => !collectedCoins.has(c.id))
              .map(c => (
                <Coin key={c.id} x={c.x} y={c.y} onCollect={(eid) => handleCoinCollect(eid, c.id)} />
              ))
            }

            {/* Floor */}
            <Ground key="floor"   x={levelData.worldWidth / 2} y={FLOOR_Y}               width={levelData.worldWidth} height={28} src={levelData.groundSrc} />
            {/* Left / right walls */}
            <Ground key="wall-l"  x={-10}                      y={300}                    width={20} height={800} color="#12131f" />
            <Ground key="wall-r"  x={levelData.worldWidth + 10} y={300}                   width={20} height={800} color="#12131f" />
            {/* Ceiling — prevents double-jumping out of bounds */}
            <Ground key="ceiling" x={levelData.worldWidth / 2} y={-100}                   width={levelData.worldWidth} height={20} color="#12131f" />

            {/* Generated platforms */}
            {levelData.platforms.map(p => (
              <Ground key={p.key} x={p.x} y={p.y} width={p.width} height={18} color={p.color} oneWay={p.oneWay} src={levelData.groundSrc} />
            ))}

            {/* Generated moving platforms */}
            {levelData.movingPlatforms.map(mp => (
              <MovingPlatform key={mp.key} x1={mp.x1} y1={mp.y1} x2={mp.x2} y2={mp.y2}
                width={mp.width} duration={mp.duration} color="#1a6b8a" />
            ))}
          </World>
          </AssetLoader>
        </Game>

        {/* ── Pause overlay ─────────────────────────────────────────────────── */}
        {paused && gameState === 'playing' && (
          <div style={overlayStyle}>
            <div style={cardStyle}>
              <p style={{ fontSize: 11, letterSpacing: 4, color: '#4fc3f7', marginBottom: 8 }}>PAUSED</p>
              <p style={{ fontSize: 30, fontWeight: 900, color: '#fff', letterSpacing: 3 }}>‖</p>
              <p style={{ fontSize: 11, color: '#546e7a', marginTop: 16 }}>Press P or Esc to resume</p>
            </div>
          </div>
        )}

        {/* ── Level complete overlay ────────────────────────────────────────── */}
        {gameState === 'levelcomplete' && (
          <div style={overlayStyle}>
            <div style={cardStyle}>
              <p style={{ fontSize: 11, letterSpacing: 4, color: '#4fc3f7', marginBottom: 8 }}>
                LEVEL {levelNum} COMPLETE
              </p>
              <p style={{ fontSize: 36, fontWeight: 900, color: '#fff', letterSpacing: 3 }}>
                STAGE CLEAR
              </p>
              <p style={{ fontSize: 13, color: '#90a4ae', margin: '12px 0 4px' }}>
                Score &nbsp;<strong style={{ color: '#ffd54f' }}>{score}</strong>
              </p>
              <p style={{ fontSize: 12, color: '#546e7a' }}>Time &nbsp;{fmtTime(time)}</p>
              <button onClick={nextLevel} style={btnStyle}>Level {levelNum + 1} →</button>
            </div>
          </div>
        )}

        {/* ── Win overlay ──────────────────────────────────────────────────── */}
        {gameState === 'win' && (
          <div style={overlayStyle}>
            <div style={cardStyle}>
              <p style={{ fontSize: 11, letterSpacing: 4, color: '#ffd54f', marginBottom: 8 }}>
                ALL LEVELS COMPLETE
              </p>
              <p style={{ fontSize: 36, fontWeight: 900, color: '#fff', letterSpacing: 3 }}>
                YOU WIN
              </p>
              <p style={{ fontSize: 13, color: '#90a4ae', margin: '12px 0 4px' }}>
                Score &nbsp;<strong style={{ color: '#ffd54f' }}>{score}</strong>
              </p>
              <p style={{ fontSize: 12, color: '#546e7a' }}>Time &nbsp;{fmtTime(time)}</p>
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
                Coins &nbsp;{collected}/{levelData.totalCoins}
              </p>
              <button onClick={restart} style={btnStyle}>Try Again</button>
            </div>
          </div>
        )}
      </div>

      {/* ── Controls hint ─────────────────────────────────────────────────────── */}
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
