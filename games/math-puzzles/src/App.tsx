import type { CSSProperties } from 'react'
import { useCallback, useEffect, useRef, useState } from 'react'

type Phase = 'idle' | 'playing' | 'over'

interface Question {
  id: number
  expression: string
  answer: number
  difficulty: number
  timeLimitMs: number
  startedAt: number
}

const SESSION_SECONDS = 75
const MIN_QUESTION_MS = 3000
const MAX_QUESTION_MS = 8000
const TICK_MS = 50
const APP_FRAME_HEIGHT = 640

const COLORS = {
  bg: '#08111f',
  panel: 'rgba(12, 20, 37, 0.82)',
  panelStrong: 'rgba(15, 23, 42, 0.94)',
  border: 'rgba(148, 163, 184, 0.18)',
  borderStrong: 'rgba(125, 211, 252, 0.3)',
  text: '#e2e8f0',
  muted: '#94a3b8',
  accent: '#7dd3fc',
  accentSoft: '#38bdf8',
  gold: '#fbbf24',
  good: '#34d399',
  bad: '#fb7185',
  shadow: '0 24px 80px rgba(2, 6, 23, 0.45)',
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value))
}

function randInt(min: number, max: number): number {
  return Math.floor(Math.random() * (max - min + 1)) + min
}

function formatClock(ms: number): string {
  const safe = Math.max(0, ms)
  const totalSeconds = Math.ceil(safe / 1000)
  const minutes = Math.floor(totalSeconds / 60)
  const seconds = totalSeconds % 60
  return `${minutes}:${seconds.toString().padStart(2, '0')}`
}

function questionTimeLimitMs(difficulty: number): number {
  return clamp(MAX_QUESTION_MS - (difficulty - 1) * 700, MIN_QUESTION_MS, MAX_QUESTION_MS)
}

function difficultyFor(solved: number, combo: number): number {
  return clamp(1 + Math.floor(solved / 4) + Math.floor(combo / 3), 1, 8)
}

function buildQuestion(difficulty: number): { expression: string; answer: number } {
  const tier = clamp(difficulty, 1, 8)

  if (tier === 1) {
    const a = randInt(1, 10)
    const b = randInt(1, 10)
    return { expression: `${a} + ${b}`, answer: a + b }
  }

  if (tier === 2) {
    const a = randInt(8, 24)
    const b = randInt(1, 12)
    return { expression: `${a} - ${b}`, answer: a - b }
  }

  if (tier === 3) {
    const a = randInt(2, 12)
    const b = randInt(2, 12)
    return { expression: `${a} × ${b}`, answer: a * b }
  }

  if (tier === 4) {
    if (Math.random() < 0.5) {
      const a = randInt(2, 12)
      const b = randInt(2, 12)
      const c = randInt(1, 20)
      return { expression: `${a} × ${b} + ${c}`, answer: a * b + c }
    }
    const a = randInt(12, 30)
    const b = randInt(2, 10)
    const c = randInt(2, 8)
    return { expression: `${a} + ${b} × ${c}`, answer: a + b * c }
  }

  if (tier === 5) {
    if (Math.random() < 0.5) {
      const a = randInt(16, 50)
      const b = randInt(2, 12)
      const c = randInt(1, 12)
      return { expression: `(${a} + ${b}) - ${c}`, answer: a + b - c }
    }
    const a = randInt(28, 72)
    const b = randInt(2, 14)
    const c = randInt(1, 12)
    return { expression: `(${a} - ${b}) + ${c}`, answer: a - b + c }
  }

  if (tier === 6) {
    const divisor = randInt(2, 12)
    const quotient = randInt(2, 12)
    const dividend = divisor * quotient

    if (Math.random() < 0.5) {
      const extra = randInt(1, 16)
      return { expression: `${dividend} ÷ ${divisor} + ${extra}`, answer: quotient + extra }
    }

    const extra = randInt(1, 10)
    return { expression: `${dividend} + ${extra} × ${divisor}`, answer: dividend + extra * divisor }
  }

  if (tier === 7) {
    if (Math.random() < 0.5) {
      const a = randInt(2, 12)
      const b = randInt(2, 12)
      const c = randInt(1, 12)
      return { expression: `(${a} × ${b}) - ${c}`, answer: a * b - c }
    }

    const a = randInt(2, 9)
    const b = randInt(2, 9)
    const c = randInt(2, 9)
    return { expression: `${a} + ${b} × ${c}`, answer: a + b * c }
  }

  const divisor = randInt(2, 9)
  const base = randInt(2, 10)
  const bonus = randInt(1, 10)
  const dividend = divisor * (base + bonus)
  return { expression: `(${dividend} - ${bonus} × ${divisor}) ÷ ${divisor}`, answer: base }
}

function loadBestScore(): number {
  const saved = localStorage.getItem('math-puzzles-best-score')
  return saved ? Number.parseInt(saved, 10) || 0 : 0
}

function loadBestCombo(): number {
  const saved = localStorage.getItem('math-puzzles-best-combo')
  return saved ? Number.parseInt(saved, 10) || 0 : 0
}

function statCardStyle(active = false): CSSProperties {
  return {
    border: `1px solid ${active ? COLORS.borderStrong : COLORS.border}`,
    background: active ? 'rgba(14, 28, 48, 0.88)' : COLORS.panel,
    borderRadius: 18,
    padding: '14px 16px',
    boxShadow: active ? '0 0 0 1px rgba(125, 211, 252, 0.18) inset' : 'none',
  }
}

function KeyButton({
  label,
  onClick,
  tone = 'neutral',
}: {
  label: string
  onClick: () => void
  tone?: 'neutral' | 'accent' | 'danger'
}) {
  const borderColor =
    tone === 'accent' ? 'rgba(125, 211, 252, 0.34)' : tone === 'danger' ? 'rgba(251, 113, 133, 0.34)' : 'rgba(148, 163, 184, 0.16)'
  const background =
    tone === 'accent'
      ? 'rgba(56, 189, 248, 0.22)'
      : tone === 'danger'
        ? 'rgba(251, 113, 133, 0.16)'
        : 'rgba(15, 23, 42, 0.96)'

  return (
    <button
      type="button"
      onClick={onClick}
      style={{
        border: `1px solid ${borderColor}`,
        background,
        color: COLORS.text,
        minHeight: 54,
        borderRadius: 16,
        cursor: 'pointer',
        fontWeight: 700,
        letterSpacing: 0.4,
        boxShadow: '0 12px 24px rgba(2, 6, 23, 0.18)',
        transition: 'transform 120ms ease, border-color 120ms ease, background 120ms ease',
      }}
      onMouseEnter={e => {
        e.currentTarget.style.transform = 'translateY(-1px)'
      }}
      onMouseLeave={e => {
        e.currentTarget.style.transform = 'translateY(0)'
      }}
    >
      {label}
    </button>
  )
}

export function App() {
  const [phase, setPhase] = useState<Phase>('idle')
  const [question, setQuestion] = useState<Question>(() => {
    const start = Date.now()
    const initialDifficulty = 1
    const built = buildQuestion(initialDifficulty)
    const timeLimitMs = questionTimeLimitMs(initialDifficulty)
    return {
      id: 1,
      expression: built.expression,
      answer: built.answer,
      difficulty: initialDifficulty,
      timeLimitMs,
      startedAt: start,
    }
  })
  const [score, setScore] = useState(0)
  const [combo, setCombo] = useState(0)
  const [solved, setSolved] = useState(0)
  const [bestScore, setBestScore] = useState(loadBestScore)
  const [bestCombo, setBestCombo] = useState(loadBestCombo)
  const [input, setInput] = useState('')
  const [feedback, setFeedback] = useState('Press Start or hit Space to begin.')
  const [sessionEndsAt, setSessionEndsAt] = useState(0)
  const [questionEndsAt, setQuestionEndsAt] = useState(0)
  const [now, setNow] = useState(() => Date.now())

  const inputRef = useRef<HTMLInputElement>(null)
  const phaseRef = useRef(phase)
  const questionRef = useRef(question)
  const comboRef = useRef(combo)
  const solvedRef = useRef(solved)
  const scoreRef = useRef(score)
  const bestScoreRef = useRef(bestScore)
  const bestComboRef = useRef(bestCombo)
  const sessionEndsAtRef = useRef(sessionEndsAt)
  const questionEndsAtRef = useRef(questionEndsAt)
  const questionIdRef = useRef(question.id)
  const handledTimeoutForIdRef = useRef<number | null>(null)

  useEffect(() => {
    phaseRef.current = phase
  }, [phase])

  useEffect(() => {
    questionRef.current = question
  }, [question])

  useEffect(() => {
    comboRef.current = combo
  }, [combo])

  useEffect(() => {
    solvedRef.current = solved
  }, [solved])

  useEffect(() => {
    scoreRef.current = score
  }, [score])

  useEffect(() => {
    bestScoreRef.current = bestScore
  }, [bestScore])

  useEffect(() => {
    bestComboRef.current = bestCombo
  }, [bestCombo])

  useEffect(() => {
    sessionEndsAtRef.current = sessionEndsAt
  }, [sessionEndsAt])

  useEffect(() => {
    questionEndsAtRef.current = questionEndsAt
  }, [questionEndsAt])

  useEffect(() => {
    localStorage.setItem('math-puzzles-best-score', String(bestScore))
  }, [bestScore])

  useEffect(() => {
    localStorage.setItem('math-puzzles-best-combo', String(bestCombo))
  }, [bestCombo])

  const finishGame = useCallback(() => {
    setPhase('over')
    setFeedback('Time is up. Press Restart or Space to play again.')
    setBestScore(prev => Math.max(prev, scoreRef.current))
    setBestCombo(prev => Math.max(prev, comboRef.current))
  }, [])

  const presentQuestion = useCallback((difficulty: number) => {
    const startedAt = Date.now()
    const built = buildQuestion(difficulty)
    const timeLimitMs = questionTimeLimitMs(difficulty)
    const nextId = questionIdRef.current + 1

    questionIdRef.current = nextId
    handledTimeoutForIdRef.current = null

    setQuestion({
      id: nextId,
      expression: built.expression,
      answer: built.answer,
      difficulty,
      timeLimitMs,
      startedAt,
    })
    setQuestionEndsAt(startedAt + timeLimitMs)
    setInput('')
  }, [])

  const startGame = useCallback(() => {
    const start = Date.now()
    const initialDifficulty = 1
    questionIdRef.current = 0
    handledTimeoutForIdRef.current = null

    setPhase('playing')
    setScore(0)
    setCombo(0)
    setSolved(0)
    setInput('')
    setNow(start)
    setFeedback('Type the answer, then press Enter.')
    setSessionEndsAt(start + SESSION_SECONDS * 1000)

    const built = buildQuestion(initialDifficulty)
    const timeLimitMs = questionTimeLimitMs(initialDifficulty)
    questionIdRef.current = 1
    setQuestion({
      id: 1,
      expression: built.expression,
      answer: built.answer,
      difficulty: initialDifficulty,
      timeLimitMs,
      startedAt: start,
    })
    setQuestionEndsAt(start + timeLimitMs)

    requestAnimationFrame(() => inputRef.current?.focus())
  }, [])

  const submitAnswer = useCallback(() => {
    if (phaseRef.current !== 'playing') return

    const raw = input.trim()
    if (raw.length === 0) return

    const guess = Number.parseInt(raw, 10)
    if (!Number.isFinite(guess)) return

    const current = questionRef.current
    const elapsed = Math.max(0, Date.now() - current.startedAt)

    if (guess === current.answer) {
      const nextSolved = solvedRef.current + 1
      const nextCombo = comboRef.current + 1
      const speedBonus = Math.max(0, Math.round((current.timeLimitMs - elapsed) / 260))
      const points = 10 + current.difficulty * 4 + nextCombo * 2 + speedBonus
      const nextDifficulty = difficultyFor(nextSolved, nextCombo)

      setScore(prev => prev + points)
      setCombo(nextCombo)
      setSolved(nextSolved)
      setBestCombo(prev => Math.max(prev, nextCombo))
      setFeedback(`Correct. +${points} points and combo x${nextCombo}.`)
      presentQuestion(nextDifficulty)
      requestAnimationFrame(() => inputRef.current?.focus())
      return
    }

    const penaltyMs = 1200 + current.difficulty * 180
    setCombo(0)
    setFeedback(`Missed. ${current.expression} = ${current.answer}.`)
    setSessionEndsAt(prev => Math.max(Date.now(), prev - penaltyMs))
    presentQuestion(current.difficulty)
    requestAnimationFrame(() => inputRef.current?.focus())
  }, [input, presentQuestion])

  useEffect(() => {
    if (phase !== 'playing') return

    const interval = window.setInterval(() => {
      const currentTime = Date.now()
      setNow(currentTime)

      if (currentTime >= sessionEndsAtRef.current) {
        finishGame()
        return
      }

      if (currentTime >= questionEndsAtRef.current && handledTimeoutForIdRef.current !== questionIdRef.current) {
        handledTimeoutForIdRef.current = questionIdRef.current
        const current = questionRef.current
        setCombo(0)
        setFeedback(`Time's up. ${current.expression} = ${current.answer}.`)
        setSessionEndsAt(prev => Math.max(Date.now(), prev - (900 + current.difficulty * 150)))
        presentQuestion(current.difficulty)
        requestAnimationFrame(() => inputRef.current?.focus())
      }
    }, TICK_MS)

    return () => window.clearInterval(interval)
  }, [finishGame, phase, presentQuestion])

  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.metaKey || event.ctrlKey || event.altKey) return

      if (phaseRef.current !== 'playing') {
        if (event.code === 'Space' || event.key === 'Enter') {
          event.preventDefault()
          startGame()
        }
        return
      }

      if (/^\d$/.test(event.key)) {
        event.preventDefault()
        setInput(prev => prev + event.key)
        return
      }

      if (event.key === 'Backspace') {
        event.preventDefault()
        setInput(prev => prev.slice(0, -1))
        return
      }

      if (event.key === 'Escape') {
        event.preventDefault()
        setInput('')
        return
      }

      if (event.key === 'Enter') {
        event.preventDefault()
        submitAnswer()
      }
    }

    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [startGame, submitAnswer])

  useEffect(() => {
    if (phase === 'playing') {
      requestAnimationFrame(() => inputRef.current?.focus())
    }
  }, [phase, question.id])

  const sessionLeftMs = phase === 'playing' ? Math.max(0, sessionEndsAt - now) : SESSION_SECONDS * 1000
  const questionLeftMs = phase === 'playing' ? Math.max(0, questionEndsAt - now) : question.timeLimitMs
  const questionProgress = phase === 'playing' ? clamp(questionLeftMs / question.timeLimitMs, 0, 1) : 0
  const scorePulse = combo >= 5

  const keypadRows = [
    ['7', '8', '9'],
    ['4', '5', '6'],
    ['1', '2', '3'],
  ]

  return (
    <div
      style={{
        width: '100%',
        display: 'flex',
        justifyContent: 'center',
        padding: 24,
        color: COLORS.text,
      }}
    >
      <main
        style={{
          width: 'min(1080px, 100%)',
          height: APP_FRAME_HEIGHT,
          display: 'grid',
          gap: 20,
          padding: 20,
          borderRadius: 28,
          background: 'rgba(8, 13, 24, 0.96)',
          border: '1px solid rgba(148, 163, 184, 0.16)',
          boxShadow: COLORS.shadow,
          overflow: 'auto',
        }}
      >
        <section
          style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))',
            gap: 20,
            alignItems: 'stretch',
          }}
        >
          <div
            style={{
              ...statCardStyle(true),
              position: 'relative',
              overflow: 'hidden',
              padding: 28,
              boxShadow: COLORS.shadow,
            }}
          >
            <div
              style={{
                display: 'none',
              }}
            />

            <div style={{ display: 'flex', flexDirection: 'column', gap: 10, position: 'relative' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap' }}>
                <span
                  style={{
                    padding: '6px 10px',
                    borderRadius: 999,
                    background: 'rgba(56, 189, 248, 0.12)',
                    color: COLORS.accent,
                    fontSize: 12,
                    fontWeight: 700,
                    letterSpacing: 1.2,
                    textTransform: 'uppercase',
                  }}
                >
                  Timed Puzzle Run
                </span>
                <span style={{ color: COLORS.muted, fontSize: 14 }}>Solve fast. Build combos. Survive the clock.</span>
              </div>

              <h1
                style={{
                  margin: 0,
                  fontSize: 'clamp(2.4rem, 6vw, 4.8rem)',
                  lineHeight: 0.95,
                  letterSpacing: '-0.06em',
                }}
              >
                Math Puzzles
              </h1>

              <p style={{ margin: 0, color: COLORS.muted, maxWidth: 620, fontSize: 16, lineHeight: 1.55 }}>
                Type the answer, press Enter, and keep the streak alive. Questions get harder every few solves, with faster timers and bigger rewards.
              </p>

              <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap', marginTop: 6 }}>
                <button
                  type="button"
                  onClick={startGame}
                  style={{
                    border: '1px solid rgba(125, 211, 252, 0.35)',
                    background: 'rgba(56, 189, 248, 0.22)',
                    color: COLORS.text,
                    borderRadius: 16,
                    padding: '14px 18px',
                    fontWeight: 800,
                    letterSpacing: 0.3,
                    cursor: 'pointer',
                    minWidth: 150,
                    boxShadow: '0 12px 24px rgba(2, 6, 23, 0.24)',
                  }}
                >
                  {phase === 'playing' ? 'Restart run' : phase === 'over' ? 'Play again' : 'Start run'}
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setInput('')
                    inputRef.current?.focus()
                  }}
                  style={{
                    border: '1px solid rgba(148, 163, 184, 0.16)',
                    background: 'rgba(15, 23, 42, 0.7)',
                    color: COLORS.text,
                    borderRadius: 16,
                    padding: '14px 18px',
                    fontWeight: 700,
                    cursor: 'pointer',
                    minWidth: 130,
                  }}
                >
                  Clear answer
                </button>
              </div>
            </div>
          </div>

          <div style={{ display: 'grid', gap: 16 }}>
            <div style={statCardStyle()}>
              <div style={{ display: 'flex', justifyContent: 'space-between', gap: 12, marginBottom: 12 }}>
                <div>
                  <div style={{ color: COLORS.muted, fontSize: 12, textTransform: 'uppercase', letterSpacing: 1.2 }}>Session</div>
                  <div style={{ fontSize: 30, fontWeight: 800, color: COLORS.accent }}>{formatClock(sessionLeftMs)}</div>
                </div>
                <div style={{ textAlign: 'right' }}>
                  <div style={{ color: COLORS.muted, fontSize: 12, textTransform: 'uppercase', letterSpacing: 1.2 }}>Level</div>
                  <div style={{ fontSize: 30, fontWeight: 800 }}>{question.difficulty}</div>
                </div>
              </div>

              <div
                style={{
                  height: 12,
                  borderRadius: 999,
                  overflow: 'hidden',
                  background: 'rgba(15, 23, 42, 0.96)',
                  border: '1px solid rgba(148, 163, 184, 0.14)',
                }}
              >
                <div
                  style={{
                    width: `${Math.max(0, Math.min(100, (sessionLeftMs / (SESSION_SECONDS * 1000)) * 100))}%`,
                    height: '100%',
                    background: COLORS.accentSoft,
                    transition: 'width 80ms linear',
                  }}
                />
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, minmax(0, 1fr))', gap: 10, marginTop: 14 }}>
                <div style={statCardStyle(scorePulse)}>
                  <div style={{ color: COLORS.muted, fontSize: 12 }}>Score</div>
                  <div style={{ fontSize: 26, fontWeight: 800, color: COLORS.gold }}>{score}</div>
                </div>
                <div style={statCardStyle(combo > 0)}>
                  <div style={{ color: COLORS.muted, fontSize: 12 }}>Combo</div>
                  <div style={{ fontSize: 26, fontWeight: 800, color: combo > 0 ? COLORS.good : COLORS.text }}>{combo}</div>
                </div>
                <div style={statCardStyle()}>
                  <div style={{ color: COLORS.muted, fontSize: 12 }}>Best</div>
                  <div style={{ fontSize: 26, fontWeight: 800 }}>{bestScore}</div>
                </div>
              </div>
            </div>

            <div style={statCardStyle()}>
              <div style={{ display: 'flex', justifyContent: 'space-between', gap: 12, marginBottom: 12 }}>
                <div>
                  <div style={{ color: COLORS.muted, fontSize: 12, textTransform: 'uppercase', letterSpacing: 1.2 }}>Current puzzle</div>
                  <div style={{ fontSize: 18, fontWeight: 700 }}>Answer before the timer expires</div>
                </div>
                <div style={{ textAlign: 'right' }}>
                  <div style={{ color: COLORS.muted, fontSize: 12, textTransform: 'uppercase', letterSpacing: 1.2 }}>Question</div>
                  <div style={{ fontSize: 26, fontWeight: 800, color: COLORS.accentSoft }}>{formatClock(questionLeftMs)}</div>
                </div>
              </div>

              <div
                style={{
                  borderRadius: 24,
                  border: '1px solid rgba(125, 211, 252, 0.16)',
                  background: 'rgba(15, 23, 42, 0.96)',
                  padding: 24,
                }}
              >
                <div
                  style={{
                    fontSize: 'clamp(2.2rem, 7vw, 4.2rem)',
                    fontWeight: 900,
                    letterSpacing: '-0.06em',
                    lineHeight: 1,
                    textAlign: 'center',
                    marginBottom: 18,
                    minHeight: 56,
                  }}
                >
                  {question.expression} = ?
                </div>

                <div
                  style={{
                    display: 'grid',
                    gap: 10,
                    gridTemplateColumns: '1fr auto',
                    alignItems: 'center',
                  }}
                >
                  <input
                    ref={inputRef}
                    value={input}
                    onChange={event => {
                      const next = event.target.value.replace(/[^\d]/g, '')
                      setInput(next)
                    }}
                    inputMode="numeric"
                    autoComplete="off"
                    spellCheck={false}
                    placeholder="Type your answer"
                    aria-label="Answer input"
                    style={{
                      width: '100%',
                      borderRadius: 16,
                      border: '1px solid rgba(148, 163, 184, 0.18)',
                      background: 'rgba(2, 6, 23, 0.64)',
                      color: COLORS.text,
                      padding: '16px 18px',
                      fontSize: 26,
                      fontWeight: 800,
                      letterSpacing: 1,
                      outline: 'none',
                      boxShadow: 'inset 0 1px 0 rgba(255, 255, 255, 0.03)',
                    }}
                  />
                  <button
                    type="button"
                    onClick={submitAnswer}
                    style={{
                      minWidth: 128,
                      borderRadius: 16,
                      border: '1px solid rgba(52, 211, 153, 0.34)',
                      background: 'rgba(52, 211, 153, 0.18)',
                      color: COLORS.text,
                      fontWeight: 800,
                      cursor: 'pointer',
                      padding: '16px 18px',
                    }}
                  >
                    Submit
                  </button>
                </div>

                <div
                  aria-live="polite"
                  style={{
                    marginTop: 14,
                    minHeight: 24,
                    color:
                      phase === 'over'
                        ? COLORS.gold
                        : feedback.startsWith('Correct')
                          ? COLORS.good
                          : feedback.startsWith('Missed') || feedback.startsWith('Time')
                            ? COLORS.bad
                            : COLORS.muted,
                    fontSize: 14,
                    lineHeight: 1.5,
                  }}
                >
                  {feedback}
                </div>

                <div
                  style={{
                    marginTop: 14,
                    height: 10,
                    borderRadius: 999,
                    overflow: 'hidden',
                    background: 'rgba(148, 163, 184, 0.12)',
                  }}
                >
                  <div
                    style={{
                      width: `${questionProgress * 100}%`,
                      height: '100%',
                      borderRadius: 999,
                      background: COLORS.gold,
                      transition: 'width 50ms linear',
                    }}
                  />
                </div>
              </div>
            </div>
          </div>
        </section>

        <section
          style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))',
            gap: 20,
            alignItems: 'start',
          }}
        >
          <div style={statCardStyle()}>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, minmax(0, 1fr))', gap: 10 }}>
              {keypadRows.flatMap(row =>
                row.map(label => (
                  <KeyButton
                    key={label}
                    label={label}
                    onClick={() => setInput(prev => prev + label)}
                  />
                )),
              )}
              <KeyButton label="⌫" tone="danger" onClick={() => setInput(prev => prev.slice(0, -1))} />
              <KeyButton label="0" onClick={() => setInput(prev => prev + '0')} />
              <KeyButton label="Enter" tone="accent" onClick={submitAnswer} />
            </div>
          </div>

          <div style={{ display: 'grid', gap: 16 }}>
            <div style={statCardStyle()}>
              <div style={{ color: COLORS.muted, fontSize: 12, textTransform: 'uppercase', letterSpacing: 1.2, marginBottom: 8 }}>How to play</div>
              <ul style={{ margin: 0, paddingLeft: 18, color: COLORS.text, lineHeight: 1.7, fontSize: 14 }}>
                <li>Type the answer and press Enter, or use the on-screen keypad.</li>
                <li>Each correct answer adds points and grows your combo.</li>
                <li>Difficulty and timer pressure ramp up as you solve more puzzles.</li>
              </ul>
            </div>

            <div style={statCardStyle()}>
              <div style={{ display: 'flex', justifyContent: 'space-between', gap: 12 }}>
                <div>
                  <div style={{ color: COLORS.muted, fontSize: 12, textTransform: 'uppercase', letterSpacing: 1.2 }}>Best combo</div>
                  <div style={{ fontSize: 30, fontWeight: 800, color: COLORS.good }}>{bestCombo}</div>
                </div>
                <div style={{ textAlign: 'right' }}>
                  <div style={{ color: COLORS.muted, fontSize: 12, textTransform: 'uppercase', letterSpacing: 1.2 }}>Status</div>
                  <div style={{ fontSize: 18, fontWeight: 700 }}>{phase === 'playing' ? 'Running' : phase === 'over' ? 'Finished' : 'Ready'}</div>
                </div>
              </div>

              <div
                style={{
                  marginTop: 14,
                  color: COLORS.muted,
                  fontSize: 13,
                  lineHeight: 1.55,
                }}
              >
                Keyboard support: digits, Backspace, Enter, and Escape. Space starts a fresh run when you are idle or finished.
              </div>
            </div>
          </div>
        </section>
      </main>
    </div>
  )
}
