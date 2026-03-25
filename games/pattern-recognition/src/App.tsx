import { useEffect, useRef, useState, type CSSProperties } from 'react'

type Phase = 'idle' | 'preview' | 'input' | 'success' | 'miss' | 'victory' | 'gameover'

interface Cell {
  row: number
  col: number
}

const TOTAL_ROUNDS = 8
const START_LIVES = 3
const APP_FRAME_HEIGHT = 640

const COLORS = {
  bg: '#050816',
  panel: 'rgba(9, 14, 30, 0.78)',
  panelBorder: 'rgba(148, 163, 184, 0.18)',
  text: '#e2e8f0',
  muted: '#94a3b8',
  accent: '#7dd3fc',
  accent2: '#fbbf24',
  danger: '#fb7185',
  success: '#4ade80',
  tile: 'rgba(15, 23, 42, 0.88)',
  tileEdge: 'rgba(148, 163, 184, 0.12)',
  tileGlow: 'rgba(125, 211, 252, 0.9)',
}

function keyOf(cell: Cell): string {
  return `${cell.row}:${cell.col}`
}

function cellsEqual(a: Cell | null | undefined, b: Cell | null | undefined): boolean {
  return !!a && !!b && a.row === b.row && a.col === b.col
}

function randomInt(maxExclusive: number): number {
  return Math.floor(Math.random() * maxExclusive)
}

function gridSizeForRound(round: number): number {
  if (round < 4) return 4
  if (round < 7) return 5
  return 6
}

function patternLengthForRound(round: number): number {
  return Math.min(4 + round, 12)
}

function previewStepForRound(round: number): number {
  return Math.max(180, 500 - round * 30)
}

function generatePattern(gridSize: number, length: number): Cell[] {
  const maxAttempts = 60

  for (let attempt = 0; attempt < maxAttempts; attempt += 1) {
    const path: Cell[] = [{ row: randomInt(gridSize), col: randomInt(gridSize) }]
    const used = new Set([keyOf(path[0])])

    while (path.length < length) {
      const current = path[path.length - 1]
      const candidates = [
        { row: current.row - 1, col: current.col },
        { row: current.row + 1, col: current.col },
        { row: current.row, col: current.col - 1 },
        { row: current.row, col: current.col + 1 },
      ].filter(
        (cell) =>
          cell.row >= 0 &&
          cell.row < gridSize &&
          cell.col >= 0 &&
          cell.col < gridSize &&
          !used.has(keyOf(cell)),
      )

      if (candidates.length === 0) break

      const next = candidates[randomInt(candidates.length)]
      path.push(next)
      used.add(keyOf(next))
    }

    if (path.length === length) return path
  }

  const fallback: Cell[] = []
  for (let i = 0; i < length; i += 1) {
    fallback.push({ row: i % gridSize, col: (i * 2) % gridSize })
  }
  return fallback
}

function scoreForRound(round: number, patternLength: number, elapsedMs: number): number {
  const speedBonus = Math.max(0, Math.round(1800 - elapsedMs * 0.8))
  return patternLength * 120 + round * 75 + speedBonus
}

function formatTime(ms: number): string {
  return `${Math.max(0, Math.round(ms))} ms`
}

function formatScore(value: number): string {
  return value.toLocaleString()
}

function readBestScore(): number {
  try {
    const stored = window.localStorage.getItem('pattern-recognition-best-score')
    return stored ? Number(stored) : 0
  } catch {
    return 0
  }
}

function writeBestScore(value: number) {
  try {
    window.localStorage.setItem('pattern-recognition-best-score', String(value))
  } catch {
    // Ignore storage failures so the game still plays normally.
  }
}

export function App() {
  const [phase, setPhase] = useState<Phase>('idle')
  const [round, setRound] = useState(1)
  const [lives, setLives] = useState(START_LIVES)
  const [score, setScore] = useState(0)
  const [bestScore, setBestScore] = useState(() => readBestScore())
  const [pattern, setPattern] = useState<Cell[]>([])
  const [gridSize, setGridSize] = useState(4)
  const [inputIndex, setInputIndex] = useState(0)
  const [previewIndex, setPreviewIndex] = useState<number | null>(null)
  const [cursor, setCursor] = useState<Cell>({ row: 0, col: 0 })
  const [mistakeCell, setMistakeCell] = useState<Cell | null>(null)
  const [message, setMessage] = useState('Memorize the lit path, then recreate it from memory.')

  const boardRef = useRef<HTMLDivElement | null>(null)
  const timersRef = useRef<number[]>([])
  const roundStartedAtRef = useRef<number>(0)
  const patternRef = useRef<Cell[]>([])
  patternRef.current = pattern

  function clearTimers() {
    timersRef.current.forEach((timer) => window.clearTimeout(timer))
    timersRef.current = []
  }

  function commitBest(nextScore: number) {
    setBestScore((prev) => {
      const next = Math.max(prev, nextScore)
      writeBestScore(next)
      return next
    })
  }

  function beginRound(nextRound: number, nextPattern = generatePattern(gridSizeForRound(nextRound), patternLengthForRound(nextRound))) {
    clearTimers()
    const nextGridSize = gridSizeForRound(nextRound)
    const step = previewStepForRound(nextRound)
    const previewDuration = step * nextPattern.length + 180

    setRound(nextRound)
    setGridSize(nextGridSize)
    setPattern(nextPattern)
    setInputIndex(0)
    setPreviewIndex(null)
    setMistakeCell(null)
    setCursor(nextPattern[0] ?? { row: 0, col: 0 })
    setPhase('preview')
    setMessage(`Round ${nextRound} of ${TOTAL_ROUNDS}. Watch closely.`)

    nextPattern.forEach((_, index) => {
      timersRef.current.push(
        window.setTimeout(() => {
          setPreviewIndex(index)
        }, index * step),
      )
    })

    timersRef.current.push(
      window.setTimeout(() => {
        setPhase('input')
        setPreviewIndex(null)
        setInputIndex(0)
        setCursor(nextPattern[0] ?? { row: 0, col: 0 })
        setMessage('Your turn. Use click, Enter, Space, or arrow keys.')
        roundStartedAtRef.current = performance.now()
        boardRef.current?.focus()
      }, previewDuration),
    )
  }

  function startGame() {
    setLives(START_LIVES)
    setScore(0)
    setRound(1)
    setPattern([])
    setGridSize(4)
    setInputIndex(0)
    setPreviewIndex(null)
    setMistakeCell(null)
    setCursor({ row: 0, col: 0 })
    setPhase('preview')
    beginRound(1)
  }

  function finishGame(nextPhase: 'victory' | 'gameover', finalScore: number, text: string) {
    clearTimers()
    setPhase(nextPhase)
    setMessage(text)
    commitBest(finalScore)
  }

  function replayCurrentRound() {
    beginRound(round, patternRef.current)
  }

  function handleSelection(cell: Cell) {
    if (phase !== 'input') return

    const expected = patternRef.current[inputIndex]
    if (!expected) return

    if (!cellsEqual(cell, expected)) {
      clearTimers()
      setMistakeCell(cell)
      setPhase('miss')

      const nextLives = lives - 1
      setLives(nextLives)

      if (nextLives <= 0) {
        finishGame('gameover', score, 'Focus lost. The pattern slipped away.')
        return
      }

      setMessage('Incorrect tile. Replaying the same pattern.')
      timersRef.current.push(
        window.setTimeout(() => {
          replayCurrentRound()
        }, 900),
      )
      return
    }

    const nextIndex = inputIndex + 1
    setInputIndex(nextIndex)
    setCursor(cell)

    if (nextIndex === patternRef.current.length) {
      const elapsed = performance.now() - roundStartedAtRef.current
      const points = scoreForRound(round, patternRef.current.length, elapsed)
      const nextScore = score + points
      setScore(nextScore)
      setPhase('success')
      setMessage(`Perfect. +${formatScore(points)} points in ${formatTime(elapsed)}.`)

      timersRef.current.push(
        window.setTimeout(() => {
          if (round >= TOTAL_ROUNDS) {
            finishGame('victory', nextScore, `You cleared all ${TOTAL_ROUNDS} rounds. Final score: ${formatScore(nextScore)}.`)
          } else {
            beginRound(round + 1)
          }
        }, 950),
      )
    } else {
      setMessage(`${nextIndex}/${patternRef.current.length} tiles matched.`)
    }
  }

  function moveCursor(rowDelta: number, colDelta: number) {
    setCursor((current) => ({
      row: Math.min(gridSize - 1, Math.max(0, current.row + rowDelta)),
      col: Math.min(gridSize - 1, Math.max(0, current.col + colDelta)),
    }))
  }

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.repeat) return

      const actionKeys = ['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', 'Space', 'Enter', 'KeyR']
      if (actionKeys.includes(event.code)) {
        event.preventDefault()
      }

      if (event.code === 'KeyR') {
        startGame()
        return
      }

      if (phase === 'idle' || phase === 'victory' || phase === 'gameover') {
        if (event.code === 'Space' || event.code === 'Enter') {
          startGame()
        }
        return
      }

      if (phase !== 'input') return

      if (event.code === 'ArrowUp' || event.code === 'KeyW') {
        moveCursor(-1, 0)
        return
      }
      if (event.code === 'ArrowDown' || event.code === 'KeyS') {
        moveCursor(1, 0)
        return
      }
      if (event.code === 'ArrowLeft' || event.code === 'KeyA') {
        moveCursor(0, -1)
        return
      }
      if (event.code === 'ArrowRight' || event.code === 'KeyD') {
        moveCursor(0, 1)
        return
      }
      if (event.code === 'Space' || event.code === 'Enter') {
        handleSelection(cursor)
      }
    }

    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [cursor, gridSize, phase, score, lives, round, handleSelection])

  useEffect(() => {
    return () => {
      clearTimers()
    }
  }, [])

  const completedCount = phase === 'input' || phase === 'success' ? inputIndex : 0
  const progress = pattern.length === 0 ? 0 : Math.round((completedCount / pattern.length) * 100)

  const headline =
    phase === 'idle'
      ? 'PATTERN RECOGNITION'
      : phase === 'preview'
        ? 'Memorize the path'
        : phase === 'input'
          ? 'Recreate it'
          : phase === 'success'
            ? 'Clean'
            : phase === 'miss'
              ? 'Try again'
              : phase === 'victory'
                ? 'Perfect memory'
                : 'Game over'

  const controlsHint =
    phase === 'idle' || phase === 'victory' || phase === 'gameover'
      ? 'Press Space, Enter, or click Start to begin.'
      : 'Click tiles or use arrows and Enter. Press R to restart anytime.'

  const boardSize = 'min(92vw, 520px)'
  const canReplay = pattern.length > 0 && phase !== 'idle' && phase !== 'victory' && phase !== 'gameover'

  return (
    <div style={shellStyle}>
      <div style={glowStyle} />
      <div style={glowStyle2} />

      <main style={frameStyle}>
        <section style={heroStyle}>
          <div>
            <p style={eyebrowStyle}>CUBEFORGE MINI GAME</p>
            <h1 style={titleStyle}>{headline}</h1>
            <p style={bodyCopyStyle}>{message}</p>
          </div>

          <div style={topActionsStyle}>
            <button onClick={startGame} style={primaryButtonStyle} type="button">
              {phase === 'idle' || phase === 'victory' || phase === 'gameover' ? 'Start Run' : 'Restart'}
            </button>
            <button
              onClick={replayCurrentRound}
              style={{ ...secondaryButtonStyle, opacity: canReplay ? 1 : 0.5, cursor: canReplay ? 'pointer' : 'not-allowed' }}
              type="button"
              disabled={!canReplay}
            >
              Replay Round
            </button>
          </div>
        </section>

        <section style={hudStyle}>
          <Stat label="Round" value={`${Math.min(round, TOTAL_ROUNDS)} / ${TOTAL_ROUNDS}`} />
          <Stat label="Score" value={formatScore(score)} />
          <Stat label="Best" value={formatScore(bestScore)} />
          <Stat label="Lives" value={'♥'.repeat(lives) || '0'} tone={lives > 1 ? 'good' : lives === 1 ? 'warn' : 'bad'} />
        </section>

        <section style={boardShellStyle}>
          <div style={boardMetaStyle}>
            <span>Grid {gridSize} × {gridSize}</span>
            <span>Pattern {pattern.length}</span>
            <span>{controlsHint}</span>
          </div>

            <div
            ref={boardRef}
            tabIndex={0}
            aria-label="Pattern recognition board"
            style={{ ...boardStyle, width: boardSize, aspectRatio: '1 / 1', gridTemplateColumns: `repeat(${gridSize}, minmax(0, 1fr))` }}
            onClick={() => boardRef.current?.focus()}
          >
            {Array.from({ length: gridSize * gridSize }, (_, index) => {
              const row = Math.floor(index / gridSize)
              const col = index % gridSize
              const cell = { row, col }
              const key = keyOf(cell)
              const previewCell = previewIndex === null ? null : pattern[previewIndex] ?? null

              const isPreviewActive = phase === 'preview' && cellsEqual(previewCell, cell)
              const isCompleted = pattern.slice(0, inputIndex).some((step) => keyOf(step) === key)
              const isExpected = phase === 'input' && cellsEqual(pattern[inputIndex], cell)
              const isCursor = phase === 'input' && cellsEqual(cursor, cell)
              const isMistake = cellsEqual(mistakeCell, cell)

              return (
                <button
                  key={key}
                  type="button"
                  onClick={() => handleSelection(cell)}
                  style={{
                    ...tileStyle,
                    background: isPreviewActive
                      ? 'rgba(251, 191, 36, 0.85)'
                      : isMistake
                        ? 'rgba(251, 113, 133, 0.78)'
                        : isCompleted
                          ? 'rgba(34, 197, 94, 0.52)'
                          : isExpected
                            ? 'rgba(125, 211, 252, 0.22)'
                            : tileBackground(row, col),
                    boxShadow: isPreviewActive
                      ? `0 0 0 1px rgba(251, 191, 36, 0.85), 0 0 24px rgba(251, 191, 36, 0.55)`
                      : isMistake
                        ? `0 0 0 1px rgba(251, 113, 133, 0.85), 0 0 24px rgba(251, 113, 133, 0.45)`
                        : isCompleted
                          ? `0 0 0 1px rgba(74, 222, 128, 0.6), 0 0 22px rgba(74, 222, 128, 0.22)`
                          : isCursor
                            ? `0 0 0 2px rgba(125, 211, 252, 0.95), 0 0 18px rgba(125, 211, 252, 0.28)`
                            : `0 1px 0 rgba(255,255,255,0.03) inset, 0 10px 20px rgba(0,0,0,0.18)`,
                    transform: isPreviewActive || isMistake ? 'translateY(-2px) scale(0.985)' : isCursor ? 'translateY(-1px)' : 'translateY(0)',
                    cursor: phase === 'input' ? 'pointer' : 'default',
                    opacity: phase === 'preview' || phase === 'input' ? 1 : 0.98,
                  }}
                  aria-label={`Row ${row + 1}, column ${col + 1}`}
                >
                  <span style={tileDotStyle} />
                  {(isPreviewActive || isCompleted || isCursor) && <span style={tilePulseStyle} />}
                </button>
              )
            })}
          </div>

          <div style={progressBarOuterStyle}>
            <div style={{ ...progressBarInnerStyle, width: `${progress}%` }} />
          </div>
        </section>

        <section style={footerGridStyle}>
          <InfoCard label="Status" value={phase === 'input' ? `${inputIndex}/${pattern.length} matched` : phase} />
          <InfoCard label="Difficulty" value={`Step ${previewStepForRound(round)}ms`} />
          <InfoCard label="Scoring" value="Pattern length + speed bonus" />
        </section>
      </main>

      {(phase === 'victory' || phase === 'gameover') && (
        <div style={overlayStyle}>
          <div style={overlayCardStyle}>
            <p style={overlayKickerStyle}>{phase === 'victory' ? 'Run complete' : 'Run ended'}</p>
            <h2 style={overlayTitleStyle}>
              {phase === 'victory' ? 'You solved every pattern.' : 'The sequence slipped away.'}
            </h2>
            <p style={overlayCopyStyle}>Final score: {formatScore(score)}</p>
            <div style={overlayActionsStyle}>
              <button onClick={startGame} style={primaryButtonStyle} type="button">
                Play again
              </button>
              <button onClick={replayCurrentRound} style={secondaryButtonStyle} type="button">
                Review last round
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

function Stat({ label, value, tone = 'neutral' }: { label: string; value: string; tone?: 'neutral' | 'good' | 'warn' | 'bad' }) {
  const colors = {
    neutral: COLORS.text,
    good: COLORS.success,
    warn: COLORS.accent2,
    bad: COLORS.danger,
  }

  return (
    <div style={statCardStyle}>
      <span style={statLabelStyle}>{label}</span>
      <strong style={{ ...statValueStyle, color: colors[tone] }}>{value}</strong>
    </div>
  )
}

function InfoCard({ label, value }: { label: string; value: string }) {
  return (
    <div style={infoCardStyle}>
      <span style={infoLabelStyle}>{label}</span>
      <strong style={infoValueStyle}>{value}</strong>
    </div>
  )
}

function tileBackground(row: number, col: number): string {
  const mix = (row * 23 + col * 31) % 18
  return `rgba(${18 + mix}, ${24 + mix}, ${42 + mix}, 0.96)`
}

const shellStyle: CSSProperties = {
  width: '100%',
  display: 'flex',
  justifyContent: 'center',
  color: COLORS.text,
}

const glowStyle: CSSProperties = {
  display: 'none',
}

const glowStyle2: CSSProperties = {
  display: 'none',
}

const frameStyle: CSSProperties = {
  width: 'min(100%, 980px)',
  height: APP_FRAME_HEIGHT,
  display: 'flex',
  flexDirection: 'column',
  gap: 18,
  padding: 22,
  borderRadius: 28,
  border: `1px solid ${COLORS.panelBorder}`,
  background: 'rgba(8, 13, 24, 0.96)',
  boxShadow: '0 24px 70px rgba(0, 0, 0, 0.44), inset 0 1px 0 rgba(255, 255, 255, 0.04)',
  overflow: 'auto',
}

const heroStyle: CSSProperties = {
  display: 'flex',
  justifyContent: 'space-between',
  gap: 16,
  alignItems: 'start',
  flexWrap: 'wrap',
}

const eyebrowStyle: CSSProperties = {
  fontSize: 11,
  letterSpacing: 4,
  color: COLORS.muted,
  marginBottom: 8,
}

const titleStyle: CSSProperties = {
  fontSize: 'clamp(28px, 4vw, 46px)',
  lineHeight: 1.02,
  letterSpacing: 1.4,
  marginBottom: 10,
  textTransform: 'uppercase',
}

const bodyCopyStyle: CSSProperties = {
  fontSize: 14,
  lineHeight: 1.6,
  color: COLORS.muted,
  maxWidth: 640,
}

const topActionsStyle: CSSProperties = {
  display: 'flex',
  gap: 10,
  flexWrap: 'wrap',
  justifyContent: 'flex-end',
}

const buttonBase: CSSProperties = {
  border: 'none',
  borderRadius: 14,
  padding: '12px 18px',
  fontWeight: 800,
  letterSpacing: 0.4,
  cursor: 'pointer',
  transition: 'transform 140ms ease, box-shadow 140ms ease, opacity 140ms ease',
}

const primaryButtonStyle: CSSProperties = {
  ...buttonBase,
  color: '#07111d',
  background: '#38bdf8',
  boxShadow: '0 12px 26px rgba(56, 189, 248, 0.22)',
}

const secondaryButtonStyle: CSSProperties = {
  ...buttonBase,
  color: COLORS.text,
  background: 'rgba(15, 23, 42, 0.9)',
  border: '1px solid rgba(148, 163, 184, 0.18)',
}

const hudStyle: CSSProperties = {
  display: 'grid',
  gridTemplateColumns: 'repeat(auto-fit, minmax(140px, 1fr))',
  gap: 12,
}

const statCardStyle: CSSProperties = {
  padding: '14px 16px',
  borderRadius: 18,
  background: 'rgba(15, 23, 42, 0.78)',
  border: '1px solid rgba(148, 163, 184, 0.14)',
}

const statLabelStyle: CSSProperties = {
  display: 'block',
  fontSize: 11,
  letterSpacing: 3,
  color: COLORS.muted,
  marginBottom: 8,
  textTransform: 'uppercase',
}

const statValueStyle: CSSProperties = {
  display: 'block',
  fontSize: 18,
  lineHeight: 1.2,
}

const boardShellStyle: CSSProperties = {
  display: 'grid',
  gap: 12,
  justifyItems: 'center',
}

const boardMetaStyle: CSSProperties = {
  width: 'min(100%, 520px)',
  display: 'flex',
  justifyContent: 'space-between',
  gap: 12,
  flexWrap: 'wrap',
  fontSize: 12,
  color: COLORS.muted,
  letterSpacing: 1.1,
  textTransform: 'uppercase',
}

const boardStyle: CSSProperties = {
  display: 'grid',
  gap: 12,
  padding: 12,
  borderRadius: 26,
  background: 'rgba(2, 6, 23, 0.82)',
  border: '1px solid rgba(148, 163, 184, 0.12)',
  boxShadow: 'inset 0 1px 0 rgba(255,255,255,0.03), 0 22px 60px rgba(0,0,0,0.34)',
  outline: 'none',
}

const tileStyle: CSSProperties = {
  position: 'relative',
  border: '1px solid rgba(255,255,255,0.04)',
  borderRadius: 22,
  overflow: 'hidden',
  minWidth: 0,
  minHeight: 0,
  aspectRatio: '1 / 1',
  transition: 'transform 130ms ease, box-shadow 130ms ease, background 130ms ease, opacity 130ms ease',
}

const tileDotStyle: CSSProperties = {
  position: 'absolute',
  inset: '50% auto auto 50%',
  width: 14,
  height: 14,
  marginLeft: -7,
  marginTop: -7,
  borderRadius: '50%',
  background: 'rgba(255,255,255,0.62)',
  boxShadow: '0 0 18px rgba(255,255,255,0.26)',
}

const tilePulseStyle: CSSProperties = {
  position: 'absolute',
  inset: 10,
  borderRadius: 18,
  border: '1px solid rgba(255,255,255,0.22)',
  boxShadow: 'inset 0 0 0 1px rgba(255,255,255,0.04)',
}

const progressBarOuterStyle: CSSProperties = {
  width: 'min(100%, 520px)',
  height: 10,
  borderRadius: 999,
  background: 'rgba(15, 23, 42, 0.9)',
  border: '1px solid rgba(148, 163, 184, 0.12)',
  overflow: 'hidden',
}

const progressBarInnerStyle: CSSProperties = {
  height: '100%',
  borderRadius: 999,
  background: '#38bdf8',
  boxShadow: '0 0 18px rgba(56, 189, 248, 0.38)',
  transition: 'width 180ms ease',
}

const footerGridStyle: CSSProperties = {
  display: 'grid',
  gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))',
  gap: 12,
}

const infoCardStyle: CSSProperties = {
  padding: '14px 16px',
  borderRadius: 18,
  background: 'rgba(15, 23, 42, 0.74)',
  border: '1px solid rgba(148, 163, 184, 0.14)',
}

const infoLabelStyle: CSSProperties = {
  display: 'block',
  fontSize: 11,
  letterSpacing: 3,
  color: COLORS.muted,
  marginBottom: 8,
  textTransform: 'uppercase',
}

const infoValueStyle: CSSProperties = {
  display: 'block',
  fontSize: 14,
  lineHeight: 1.4,
  color: COLORS.text,
}

const overlayStyle: CSSProperties = {
  position: 'fixed',
  inset: 0,
  display: 'grid',
  placeItems: 'center',
  background: 'rgba(2, 6, 23, 0.68)',
  backdropFilter: 'blur(12px)',
  zIndex: 5,
  padding: 24,
}

const overlayCardStyle: CSSProperties = {
  width: 'min(100%, 560px)',
  padding: 28,
  borderRadius: 28,
  background: 'rgba(9, 14, 30, 0.94)',
  border: '1px solid rgba(148, 163, 184, 0.18)',
  boxShadow: '0 22px 80px rgba(0,0,0,0.48)',
  textAlign: 'center',
}

const overlayKickerStyle: CSSProperties = {
  fontSize: 11,
  letterSpacing: 4,
  color: COLORS.accent2,
  textTransform: 'uppercase',
  marginBottom: 10,
}

const overlayTitleStyle: CSSProperties = {
  fontSize: 'clamp(26px, 4vw, 38px)',
  lineHeight: 1.08,
  marginBottom: 12,
}

const overlayCopyStyle: CSSProperties = {
  fontSize: 15,
  color: COLORS.muted,
  marginBottom: 22,
}

const overlayActionsStyle: CSSProperties = {
  display: 'flex',
  justifyContent: 'center',
  gap: 12,
  flexWrap: 'wrap',
}
