import { useState, useEffect, useCallback, useRef } from 'react'

const GRID_SIZE = 3
const TOTAL_HOLES = GRID_SIZE * GRID_SIZE
const GAME_DURATION = 30
const HOLE_SIZE = 100
const GAP = 20
const BOARD_PADDING = 30
const BOARD_WIDTH = GRID_SIZE * HOLE_SIZE + (GRID_SIZE - 1) * GAP + BOARD_PADDING * 2
const BOARD_HEIGHT = GRID_SIZE * HOLE_SIZE + (GRID_SIZE - 1) * GAP + BOARD_PADDING * 2

const COLORS = {
  bg: '#0d1117',
  hole: '#1e2535',
  mole: '#8d6e63',
  moleEyes: '#3e2723',
  hit: '#66bb6a',
  board: '#161b22',
  border: '#30363d',
  textPrimary: '#e6edf3',
  textSecondary: '#8b949e',
  accent: '#58a6ff',
  danger: '#f85149',
}

type MoleState = 'hidden' | 'visible' | 'hit'

interface Mole {
  state: MoleState
  timer: number
}

type GamePhase = 'idle' | 'playing' | 'over'

function getSpawnInterval(timeLeft: number): number {
  // Speed increases as time progresses (lower timeLeft = faster spawns)
  const progress = 1 - timeLeft / GAME_DURATION
  return Math.max(400, 1200 - progress * 700)
}

function getMoleVisibleDuration(timeLeft: number): number {
  const progress = 1 - timeLeft / GAME_DURATION
  return Math.max(600, 1500 - progress * 800)
}

export function App() {
  const [phase, setPhase] = useState<GamePhase>('idle')
  const [score, setScore] = useState(0)
  const [highScore, setHighScore] = useState(() => {
    const saved = localStorage.getItem('whack-a-mole-highscore')
    return saved ? parseInt(saved, 10) : 0
  })
  const [timeLeft, setTimeLeft] = useState(GAME_DURATION)
  const [moles, setMoles] = useState<Mole[]>(() =>
    Array.from({ length: TOTAL_HOLES }, () => ({ state: 'hidden' as MoleState, timer: 0 }))
  )

  const timeLeftRef = useRef(timeLeft)
  timeLeftRef.current = timeLeft
  const phaseRef = useRef(phase)
  phaseRef.current = phase

  const startGame = useCallback(() => {
    setPhase('playing')
    setScore(0)
    setTimeLeft(GAME_DURATION)
    setMoles(Array.from({ length: TOTAL_HOLES }, () => ({ state: 'hidden', timer: 0 })))
  }, [])

  // Game timer countdown
  useEffect(() => {
    if (phase !== 'playing') return
    const interval = setInterval(() => {
      setTimeLeft(t => {
        if (t <= 1) {
          setPhase('over')
          return 0
        }
        return t - 1
      })
    }, 1000)
    return () => clearInterval(interval)
  }, [phase])

  // Save high score on game over
  useEffect(() => {
    if (phase === 'over') {
      setHighScore(prev => {
        const next = Math.max(prev, score)
        localStorage.setItem('whack-a-mole-highscore', String(next))
        return next
      })
    }
  }, [phase, score])

  // Mole spawning logic
  useEffect(() => {
    if (phase !== 'playing') return

    let spawnTimeout: ReturnType<typeof setTimeout>

    const scheduleSpawn = () => {
      const interval = getSpawnInterval(timeLeftRef.current)
      spawnTimeout = setTimeout(() => {
        if (phaseRef.current !== 'playing') return

        setMoles(prev => {
          const hiddenIndices = prev
            .map((m, i) => (m.state === 'hidden' ? i : -1))
            .filter(i => i >= 0)

          if (hiddenIndices.length === 0) return prev

          const idx = hiddenIndices[Math.floor(Math.random() * hiddenIndices.length)]
          const next = [...prev]
          next[idx] = { state: 'visible', timer: Date.now() }
          return next
        })

        scheduleSpawn()
      }, interval)
    }

    scheduleSpawn()
    return () => clearTimeout(spawnTimeout)
  }, [phase])

  // Auto-hide moles after their visible duration expires
  useEffect(() => {
    if (phase !== 'playing') return

    const interval = setInterval(() => {
      const now = Date.now()
      setMoles(prev => {
        let changed = false
        const next = prev.map(m => {
          if (m.state === 'visible' && now - m.timer > getMoleVisibleDuration(timeLeftRef.current)) {
            changed = true
            return { state: 'hidden' as MoleState, timer: 0 }
          }
          if (m.state === 'hit' && now - m.timer > 300) {
            changed = true
            return { state: 'hidden' as MoleState, timer: 0 }
          }
          return m
        })
        return changed ? next : prev
      })
    }, 50)

    return () => clearInterval(interval)
  }, [phase])

  const whack = useCallback((index: number) => {
    if (phaseRef.current !== 'playing') return

    setMoles(prev => {
      if (prev[index].state !== 'visible') return prev
      const next = [...prev]
      next[index] = { state: 'hit', timer: Date.now() }
      return next
    })

    // Check if mole was actually visible before scoring
    setMoles(prev => {
      // The state was already updated above, so we check for 'hit'
      if (prev[index].state === 'hit') {
        setScore(s => s + 1)
      }
      return prev
    })
  }, [])

  // We need to score on the whack, but the above double-setMoles is awkward.
  // Let's simplify: use a ref to track if we just scored.
  const whackHandler = useCallback((index: number) => {
    if (phaseRef.current !== 'playing') return

    setMoles(prev => {
      if (prev[index].state !== 'visible') return prev
      const next = [...prev]
      next[index] = { state: 'hit', timer: Date.now() }
      setScore(s => s + 1)
      return next
    })
  }, [])

  return (
    <div style={{
      display: 'flex',
      flexDirection: 'column',
      alignItems: 'center',
      gap: 16,
      fontFamily: "'Courier New', monospace",
      color: COLORS.textPrimary,
      userSelect: 'none',
    }}>
      <h1 style={{
        fontSize: 28,
        fontWeight: 700,
        letterSpacing: 2,
        color: COLORS.textPrimary,
        marginTop: 8,
      }}>
        WHACK-A-MOLE
      </h1>

      {/* HUD */}
      <div style={{
        display: 'flex',
        justifyContent: 'space-between',
        width: BOARD_WIDTH,
        padding: '0 4px',
      }}>
        <div style={{ fontSize: 16 }}>
          <span style={{ color: COLORS.textSecondary }}>Score: </span>
          <span style={{ color: COLORS.accent, fontWeight: 700 }}>{score}</span>
        </div>
        <div style={{ fontSize: 16 }}>
          <span style={{ color: COLORS.textSecondary }}>Time: </span>
          <span style={{
            color: timeLeft <= 5 ? COLORS.danger : COLORS.textPrimary,
            fontWeight: 700,
          }}>
            {timeLeft}s
          </span>
        </div>
        <div style={{ fontSize: 16 }}>
          <span style={{ color: COLORS.textSecondary }}>Best: </span>
          <span style={{ color: COLORS.hit, fontWeight: 700 }}>{highScore}</span>
        </div>
      </div>

      {/* Board */}
      <div style={{
        width: BOARD_WIDTH,
        height: BOARD_HEIGHT,
        background: COLORS.board,
        border: `2px solid ${COLORS.border}`,
        borderRadius: 16,
        padding: BOARD_PADDING,
        display: 'grid',
        gridTemplateColumns: `repeat(${GRID_SIZE}, ${HOLE_SIZE}px)`,
        gridTemplateRows: `repeat(${GRID_SIZE}, ${HOLE_SIZE}px)`,
        gap: GAP,
        cursor: phase === 'playing' ? 'pointer' : 'default',
      }}>
        {moles.map((mole, i) => (
          <Hole
            key={i}
            mole={mole}
            onClick={() => whackHandler(i)}
            playing={phase === 'playing'}
          />
        ))}
      </div>

      {/* Start / Game Over overlay */}
      {phase === 'idle' && (
        <button onClick={startGame} style={buttonStyle}>
          START GAME
        </button>
      )}

      {phase === 'over' && (
        <div style={{
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          gap: 12,
        }}>
          <div style={{ fontSize: 22, fontWeight: 700 }}>
            GAME OVER
          </div>
          <div style={{ fontSize: 16, color: COLORS.textSecondary }}>
            Final Score: <span style={{ color: COLORS.accent }}>{score}</span>
            {score >= highScore && score > 0 && (
              <span style={{ color: COLORS.hit, marginLeft: 8 }}>NEW BEST!</span>
            )}
          </div>
          <button onClick={startGame} style={buttonStyle}>
            PLAY AGAIN
          </button>
        </div>
      )}

      {phase === 'playing' && (
        <div style={{ fontSize: 13, color: COLORS.textSecondary }}>
          Click the moles before they hide!
        </div>
      )}
    </div>
  )
}

function Hole({ mole, onClick, playing }: {
  mole: Mole
  onClick: () => void
  playing: boolean
}) {
  const isUp = mole.state === 'visible'
  const isHit = mole.state === 'hit'
  const showMole = isUp || isHit

  return (
    <div
      onClick={playing ? onClick : undefined}
      style={{
        width: HOLE_SIZE,
        height: HOLE_SIZE,
        borderRadius: 16,
        background: COLORS.hole,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        overflow: 'hidden',
        position: 'relative',
        transition: 'box-shadow 0.15s ease',
        boxShadow: isHit
          ? `0 0 20px ${COLORS.hit}40`
          : isUp
            ? `inset 0 2px 8px rgba(0,0,0,0.5)`
            : `inset 0 4px 12px rgba(0,0,0,0.6)`,
      }}
    >
      {/* Mole body */}
      <div style={{
        width: 60,
        height: 60,
        borderRadius: 14,
        background: isHit ? COLORS.hit : COLORS.mole,
        transition: 'transform 0.15s ease, opacity 0.15s ease, background 0.1s ease',
        transform: showMole ? 'scale(1)' : 'scale(0.3)',
        opacity: showMole ? 1 : 0,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        flexDirection: 'column',
        gap: 6,
        position: 'relative',
      }}>
        {/* Eyes */}
        <div style={{
          display: 'flex',
          gap: 14,
          marginTop: 4,
        }}>
          <div style={{
            width: 8,
            height: isHit ? 3 : 10,
            borderRadius: isHit ? 2 : 5,
            background: COLORS.moleEyes,
            transition: 'height 0.1s ease',
          }} />
          <div style={{
            width: 8,
            height: isHit ? 3 : 10,
            borderRadius: isHit ? 2 : 5,
            background: COLORS.moleEyes,
            transition: 'height 0.1s ease',
          }} />
        </div>
        {/* Nose */}
        <div style={{
          width: 10,
          height: 8,
          borderRadius: '50%',
          background: isHit ? '#43a047' : '#6d4c41',
        }} />
      </div>
    </div>
  )
}

const buttonStyle: React.CSSProperties = {
  padding: '12px 32px',
  fontSize: 18,
  fontWeight: 700,
  fontFamily: "'Courier New', monospace",
  background: COLORS.accent,
  color: '#0d1117',
  border: 'none',
  borderRadius: 8,
  cursor: 'pointer',
  letterSpacing: 1,
}
