import { useState, useEffect, useCallback } from 'react'
import { Game, World, Camera2D } from '@cubeforge/react'
import type { EntityId } from '@cubeforge/react'
import { Player, playerConfig } from './components/Player'
import { Goomba }        from './components/Goomba'
import { Ground }        from './components/Ground'
import { Coin }          from './components/Coin'
import { QuestionBlock } from './components/QuestionBlock'
import { Mushroom }      from './components/Mushroom'
import { GoalFlag }      from './components/GoalFlag'
import { gameEvents }    from './gameEvents'

// ─── Constants ────────────────────────────────────────────────────────────────
const W         = 800
const H         = 560
const WORLD_W   = 1800
const FLOOR_Y   = 506
const MAX_LIVES = 3
const TOTAL_COINS = 10

// ─── Coin layout ──────────────────────────────────────────────────────────────
const COIN_DEFS = [
  { id:  1, x:  160, y: 420 },
  { id:  2, x:  280, y: 340 },
  { id:  3, x:  430, y: 265 },
  { id:  4, x:  600, y: 390 },
  { id:  5, x:  740, y: 310 },
  { id:  6, x:  900, y: 240 },
  { id:  7, x: 1060, y: 390 },
  { id:  8, x: 1200, y: 300 },
  { id:  9, x: 1380, y: 220 },
  { id: 10, x: 1550, y: 390 },
]

// ─── Question block layout ────────────────────────────────────────────────────
interface BlockDef {
  id:      number
  x:       number
  y:       number
  reveals: 'coin' | 'mushroom'
}
const BLOCK_DEFS: BlockDef[] = [
  { id: 1, x:  350, y: 310, reveals: 'mushroom' },
  { id: 2, x:  820, y: 260, reveals: 'coin'     },
  { id: 3, x: 1300, y: 250, reveals: 'coin'     },
]

// ─── Types ────────────────────────────────────────────────────────────────────
type GameState = 'playing' | 'gameover' | 'win'

interface SpawnedReveal {
  id:   number
  type: 'coin' | 'mushroom'
  x:    number
  y:    number
}

// ─── Helpers ──────────────────────────────────────────────────────────────────
function Heart({ filled }: { filled: boolean }) {
  return (
    <span style={{ color: filled ? '#ef5350' : '#37474f', fontSize: 18, lineHeight: 1 }}>♥</span>
  )
}

// ─── App ──────────────────────────────────────────────────────────────────────
export function App() {
  const [gameKey,        setGameKey]        = useState(0)
  const [score,          setScore]          = useState(0)
  const [lives,          setLives]          = useState(MAX_LIVES)
  const [gameState,      setGameState]      = useState<GameState>('playing')
  const [collectedCoins, setCollectedCoins] = useState<Set<number>>(new Set())
  const [revealedBlocks, setRevealedBlocks] = useState<Set<number>>(new Set())
  const [spawnedReveals, setSpawnedReveals] = useState<SpawnedReveal[]>([])
  const [hasMushroom,    setHasMushroom]    = useState(false)

  // Wire game-script callbacks into React state
  useEffect(() => {
    gameEvents.onPlayerHurt = () => {
      setLives(prev => {
        const next = prev - 1
        if (next <= 0) setGameState('gameover')
        return Math.max(0, next)
      })
    }
    gameEvents.onEnemyKill = () => {
      setScore(s => s + 100)
    }
    gameEvents.onMushroomGet = () => {
      playerConfig.maxJumps = 2
      setHasMushroom(true)
      setScore(s => s + 50)
    }
    gameEvents.onGoalReached = () => {
      setGameState('win')
    }
    return () => {
      gameEvents.onPlayerHurt  = null
      gameEvents.onEnemyKill   = null
      gameEvents.onMushroomGet = null
      gameEvents.onGoalReached = null
    }
  }, [gameKey])

  // Coin collect handler — keyed by coin id
  const handleCoinCollect = useCallback((_eid: EntityId, coinId: number) => {
    setCollectedCoins(prev => new Set([...prev, coinId]))
    setScore(s => s + 10)
  }, [])

  // Revealed-spawn coin collect handler
  const handleRevealCoinCollect = useCallback((_eid: EntityId, revealId: number) => {
    setSpawnedReveals(prev => prev.filter(r => r.id !== revealId))
    setScore(s => s + 10)
  }, [])

  // Question block reveal
  const handleReveal = useCallback((blockId: number, type: 'coin' | 'mushroom', bx: number, by: number) => {
    setRevealedBlocks(prev => new Set([...prev, blockId]))
    // Spawn the item just above the block
    const revealId = blockId + 1000
    setSpawnedReveals(prev => [
      ...prev.filter(r => r.id !== revealId),
      { id: revealId, type, x: bx, y: by - 48 },
    ])
  }, [])

  function restart() {
    playerConfig.maxJumps = 1
    setScore(0)
    setLives(MAX_LIVES)
    setGameState('playing')
    setCollectedCoins(new Set())
    setRevealedBlocks(new Set())
    setSpawnedReveals([])
    setHasMushroom(false)
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
        background: '#1a1a2e',
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
          {hasMushroom && (
            <span style={{ marginLeft: 6, fontSize: 12, color: '#e53935' }}>2x</span>
          )}
        </div>

        {/* Score + coins */}
        <div style={{ textAlign: 'center', display: 'flex', flexDirection: 'column', gap: 1 }}>
          <span style={{ color: '#ffd700', fontWeight: 700, fontSize: 15, letterSpacing: 2 }}>
            {String(score).padStart(5, '0')}
          </span>
          <span style={{ fontSize: 10, color: '#546e7a' }}>
            {'●'.repeat(collected)}{'○'.repeat(TOTAL_COINS - collected)} {collected}/{TOTAL_COINS}
          </span>
        </div>

        {/* Right: lives label */}
        <div style={{ textAlign: 'right', fontSize: 11, color: '#455a64' }}>
          MARIO CLONE
        </div>
      </div>

      {/* ── Game canvas + overlays ──────────────────────────────────────────── */}
      <div style={{ position: 'relative', width: W, height: H }}>

        <Game key={gameKey} width={W} height={H} gravity={1000}>
          <World background="#5c94fc">
            <Camera2D followEntity="player" smoothing={0.88} background="#5c94fc" />

            {/* Player */}
            <Player x={80} y={420} />

            {/* ── Goombas ─────────────────────────────────────────────────── */}
            <Goomba x={320}  y={465} patrolLeft={200}  patrolRight={450}  />
            <Goomba x={680}  y={465} patrolLeft={580}  patrolRight={800}  />
            <Goomba x={500}  y={295} patrolLeft={420}  patrolRight={590}  />
            <Goomba x={1100} y={465} patrolLeft={970}  patrolRight={1230} />
            <Goomba x={1480} y={465} patrolLeft={1380} patrolRight={1600} />

            {/* ── Static coins ────────────────────────────────────────────── */}
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

            {/* ── Question blocks ──────────────────────────────────────────── */}
            {BLOCK_DEFS
              .filter(b => !revealedBlocks.has(b.id))
              .map(b => (
                <QuestionBlock
                  key={b.id}
                  x={b.x}
                  y={b.y}
                  reveals={b.reveals}
                  onReveal={() => handleReveal(b.id, b.reveals, b.x, b.y)}
                />
              ))
            }

            {/* ── Spawned reveals (coins / mushrooms from blocks) ──────────── */}
            {spawnedReveals.map(r => {
              if (r.type === 'mushroom') {
                return (
                  <Mushroom key={r.id} x={r.x} y={r.y} />
                )
              }
              return (
                <Coin
                  key={r.id}
                  x={r.x}
                  y={r.y}
                  onCollect={(eid) => handleRevealCoinCollect(eid, r.id)}
                />
              )
            })}

            {/* ── Goal flag ────────────────────────────────────────────────── */}
            <GoalFlag x={1740} y={460} />

            {/* ── Floor ────────────────────────────────────────────────────── */}
            <Ground x={WORLD_W / 2} y={FLOOR_Y} width={WORLD_W} height={28} color="#5a3e1b" />

            {/* ── Left / right walls ───────────────────────────────────────── */}
            <Ground x={-10}          y={300} width={20}  height={800} color="#5c94fc" />
            <Ground x={WORLD_W + 10} y={300} width={20}  height={800} color="#5c94fc" />

            {/* ── Left section platforms (x 0–700) ─────────────────────────── */}
            {/* Low platforms */}
            <Ground x={200}  y={456} width={130} height={18} color="#8b6914" />
            <Ground x={430}  y={430} width={120} height={18} color="#8b6914" />
            <Ground x={640}  y={456} width={120} height={18} color="#8b6914" />

            {/* Mid platforms */}
            <Ground x={280}  y={360} width={110} height={18} color="#7a5c10" />
            <Ground x={500}  y={310} width={120} height={18} color="#7a5c10" />

            {/* High platform */}
            <Ground x={400}  y={240} width={100} height={18} color="#6b4f0e" />

            {/* ── Center section (x 700–1200) ───────────────────────────────── */}
            <Ground x={760}  y={440} width={130} height={18} color="#8b6914" />
            <Ground x={950}  y={400} width={120} height={18} color="#8b6914" />

            <Ground x={840}  y={330} width={120} height={18} color="#7a5c10" />
            <Ground x={1040} y={280} width={110} height={18} color="#7a5c10" />

            <Ground x={920}  y={210} width={100} height={18} color="#6b4f0e" />

            {/* ── Right section (x 1200–1800) ───────────────────────────────── */}
            <Ground x={1250} y={440} width={130} height={18} color="#8b6914" />
            <Ground x={1450} y={400} width={130} height={18} color="#8b6914" />
            <Ground x={1650} y={440} width={150} height={18} color="#8b6914" />

            <Ground x={1330} y={330} width={120} height={18} color="#7a5c10" />
            <Ground x={1530} y={270} width={110} height={18} color="#7a5c10" />

            <Ground x={1420} y={200} width={100} height={18} color="#6b4f0e" />
          </World>
        </Game>

        {/* ── Win overlay ──────────────────────────────────────────────────── */}
        {gameState === 'win' && (
          <div style={overlayStyle}>
            <div style={cardStyle}>
              <p style={{ fontSize: 11, letterSpacing: 4, color: '#4caf50', marginBottom: 8 }}>
                FLAG REACHED
              </p>
              <p style={{ fontSize: 36, fontWeight: 900, color: '#fff', letterSpacing: 3 }}>
                YOU WIN!
              </p>
              <p style={{ fontSize: 13, color: '#90a4ae', margin: '12px 0 4px' }}>
                Score &nbsp;<strong style={{ color: '#ffd700' }}>{score}</strong>
              </p>
              <p style={{ fontSize: 12, color: '#546e7a' }}>
                Coins &nbsp;{collected}/{TOTAL_COINS}
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
                Score &nbsp;<strong style={{ color: '#ffd700' }}>{score}</strong>
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
        background: '#1a1a2e',
        borderRadius: '0 0 10px 10px',
        padding: '6px 18px',
        fontSize: 11,
        color: '#37474f',
        letterSpacing: 1.5,
        display: 'flex',
        justifyContent: 'space-between',
      }}>
        <span>WASD/Arrows — move · Space/Up — jump · Stomp enemies · Collect mushroom for double jump</span>
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
  background:    '#ffd700',
  color:         '#0a0a0f',
  border:        'none',
  borderRadius:  6,
  fontFamily:    '"Courier New", monospace',
  fontSize:      13,
  fontWeight:    700,
  letterSpacing: 2,
  cursor:        'pointer',
}
