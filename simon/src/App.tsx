import { useState, useCallback, useRef, useEffect } from 'react'

/* ------------------------------------------------------------------ */
/*  Constants                                                          */
/* ------------------------------------------------------------------ */

type Color = 'red' | 'blue' | 'green' | 'yellow'
type GameState = 'idle' | 'showing' | 'input' | 'gameover'

const COLORS: Color[] = ['green', 'red', 'yellow', 'blue']

const COLOR_MAP: Record<Color, { base: string; lit: string }> = {
  red:    { base: '#ef5350', lit: '#ff8a80' },
  blue:   { base: '#4fc3f7', lit: '#b3e5fc' },
  green:  { base: '#66bb6a', lit: '#a5d6a7' },
  yellow: { base: '#fdd835', lit: '#fff9c4' },
}

const SHOW_DELAY = 600   // ms between sequence steps
const FLASH_TIME = 300   // ms a pad stays lit

/* ------------------------------------------------------------------ */
/*  Simon Button                                                       */
/* ------------------------------------------------------------------ */

interface PadProps {
  color: Color
  lit: boolean
  disabled: boolean
  onClick: () => void
  borderRadius: string
}

function Pad({ color, lit, disabled, onClick, borderRadius }: PadProps) {
  const { base, lit: litColor } = COLOR_MAP[color]

  return (
    <button
      onClick={onClick}
      disabled={disabled}
      style={{
        width: 160,
        height: 160,
        border: 'none',
        borderRadius,
        cursor: disabled ? 'default' : 'pointer',
        background: lit ? litColor : base,
        opacity: lit ? 1 : 0.55,
        transition: 'background 0.1s, opacity 0.1s',
        boxShadow: lit
          ? `0 0 30px ${litColor}, inset 0 0 20px rgba(255,255,255,0.25)`
          : `inset 0 0 12px rgba(0,0,0,0.35)`,
      }}
      aria-label={color}
    />
  )
}

/* ------------------------------------------------------------------ */
/*  App                                                                */
/* ------------------------------------------------------------------ */

export function App() {
  const [gameState, setGameState] = useState<GameState>('idle')
  const [sequence, setSequence] = useState<Color[]>([])
  const [inputIndex, setInputIndex] = useState(0)
  const [activePad, setActivePad] = useState<Color | null>(null)
  const [bestScore, setBestScore] = useState(0)

  // Keep mutable refs so timeouts always see fresh state
  const sequenceRef = useRef(sequence)
  sequenceRef.current = sequence
  const timeoutsRef = useRef<ReturnType<typeof setTimeout>[]>([])

  /* ---- helpers ---- */

  const clearTimeouts = useCallback(() => {
    timeoutsRef.current.forEach(clearTimeout)
    timeoutsRef.current = []
  }, [])

  const randomColor = (): Color => COLORS[Math.floor(Math.random() * 4)]

  const flashPad = useCallback((color: Color, duration = FLASH_TIME) => {
    setActivePad(color)
    const t = setTimeout(() => setActivePad(null), duration)
    timeoutsRef.current.push(t)
  }, [])

  const playSequence = useCallback(
    (seq: Color[]) => {
      setGameState('showing')
      setActivePad(null)

      seq.forEach((color, i) => {
        const tOn = setTimeout(() => {
          setActivePad(color)
        }, SHOW_DELAY * i)

        const tOff = setTimeout(() => {
          setActivePad(null)
        }, SHOW_DELAY * i + FLASH_TIME)

        timeoutsRef.current.push(tOn, tOff)
      })

      const tReady = setTimeout(() => {
        setGameState('input')
        setInputIndex(0)
      }, SHOW_DELAY * seq.length)
      timeoutsRef.current.push(tReady)
    },
    [],
  )

  const startGame = useCallback(() => {
    clearTimeouts()
    const first = randomColor()
    const newSeq = [first]
    setSequence(newSeq)
    setInputIndex(0)
    setActivePad(null)

    // Small delay before showing first sequence
    const t = setTimeout(() => playSequence(newSeq), 400)
    timeoutsRef.current.push(t)
  }, [clearTimeouts, playSequence])

  const handlePadClick = useCallback(
    (color: Color) => {
      if (gameState !== 'input') return

      flashPad(color)

      const expected = sequenceRef.current[inputIndex]
      if (color !== expected) {
        // Wrong — game over
        setGameState('gameover')
        const score = sequenceRef.current.length - 1
        setBestScore((prev) => Math.max(prev, score))
        return
      }

      const nextIndex = inputIndex + 1
      if (nextIndex >= sequenceRef.current.length) {
        // Completed round — extend sequence
        const next = randomColor()
        const newSeq = [...sequenceRef.current, next]
        setSequence(newSeq)

        const t = setTimeout(() => playSequence(newSeq), 800)
        timeoutsRef.current.push(t)
      } else {
        setInputIndex(nextIndex)
      }
    },
    [gameState, inputIndex, flashPad, playSequence],
  )

  // Cleanup on unmount
  useEffect(() => clearTimeouts, [clearTimeouts])

  /* ---- derived ---- */

  const round = gameState === 'idle' ? 0 : sequence.length
  const padsDisabled = gameState !== 'input'

  const statusText: Record<GameState, string> = {
    idle: 'Press Start to play',
    showing: 'Watch the sequence...',
    input: 'Your turn!',
    gameover: `Game over! Score: ${sequence.length - 1}`,
  }

  /* ---- render ---- */

  return (
    <div
      style={{
        width: 400,
        minHeight: 500,
        background: '#0d1117',
        borderRadius: 16,
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        padding: '24px 0',
        gap: 16,
        userSelect: 'none',
      }}
    >
      {/* Title */}
      <h1
        style={{
          fontSize: 28,
          fontWeight: 700,
          letterSpacing: 6,
          color: '#e0e0e0',
          textTransform: 'uppercase',
        }}
      >
        Simon
      </h1>

      {/* Score bar */}
      <div
        style={{
          display: 'flex',
          gap: 32,
          fontSize: 14,
          color: '#888',
        }}
      >
        <span>Round: {round}</span>
        <span>Best: {bestScore}</span>
      </div>

      {/* Status */}
      <p style={{ fontSize: 14, color: '#aaa', minHeight: 20 }}>
        {statusText[gameState]}
      </p>

      {/* Pad grid — classic quadrant layout */}
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: '160px 160px',
          gap: 8,
          marginTop: 8,
        }}
      >
        {/* Top-left: green, Top-right: red */}
        <Pad
          color="green"
          lit={activePad === 'green'}
          disabled={padsDisabled}
          onClick={() => handlePadClick('green')}
          borderRadius="80px 8px 8px 8px"
        />
        <Pad
          color="red"
          lit={activePad === 'red'}
          disabled={padsDisabled}
          onClick={() => handlePadClick('red')}
          borderRadius="8px 80px 8px 8px"
        />
        {/* Bottom-left: yellow, Bottom-right: blue */}
        <Pad
          color="yellow"
          lit={activePad === 'yellow'}
          disabled={padsDisabled}
          onClick={() => handlePadClick('yellow')}
          borderRadius="8px 8px 8px 80px"
        />
        <Pad
          color="blue"
          lit={activePad === 'blue'}
          disabled={padsDisabled}
          onClick={() => handlePadClick('blue')}
          borderRadius="8px 8px 80px 8px"
        />
      </div>

      {/* Start / Restart button */}
      <button
        onClick={startGame}
        style={{
          marginTop: 12,
          padding: '10px 32px',
          fontSize: 16,
          fontFamily: "'Courier New', monospace",
          fontWeight: 700,
          letterSpacing: 2,
          color: '#0d1117',
          background: '#e0e0e0',
          border: 'none',
          borderRadius: 8,
          cursor: 'pointer',
          textTransform: 'uppercase',
        }}
      >
        {gameState === 'idle' ? 'Start' : gameState === 'gameover' ? 'Restart' : 'Restart'}
      </button>
    </div>
  )
}
