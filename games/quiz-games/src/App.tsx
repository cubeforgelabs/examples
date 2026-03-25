import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import type { CSSProperties } from 'react'

type Phase = 'idle' | 'playing' | 'feedback' | 'finished'

type Question = {
  id: string
  category: string
  round: string
  prompt: string
  options: string[]
  correctIndex: number
  explanation: string
  timeLimitMs: number
  basePoints: number
  accent: string
}

type Feedback = {
  mode: 'correct' | 'wrong' | 'timeout'
  points: number
  answer: string
  explanation: string
}

const QUESTION_COUNT = 10
const STORAGE_KEY = 'quiz-games-best-score'
const APP_FRAME_HEIGHT = 640

const QUESTION_BANK: Question[] = [
  {
    id: 'q1',
    category: 'Science',
    round: 'Warm-up',
    prompt: 'Which planet in our solar system is known for its rings?',
    options: ['Mars', 'Venus', 'Saturn', 'Mercury'],
    correctIndex: 2,
    explanation: 'Saturn is the planet most famously associated with a bright ring system.',
    timeLimitMs: 10_000,
    basePoints: 120,
    accent: '#fbbf24',
  },
  {
    id: 'q2',
    category: 'History',
    round: 'Warm-up',
    prompt: 'The pyramids at Giza were built in which country?',
    options: ['Egypt', 'Greece', 'Peru', 'India'],
    correctIndex: 0,
    explanation: 'The Great Pyramids are part of the Giza complex in Egypt.',
    timeLimitMs: 10_000,
    basePoints: 120,
    accent: '#f59e0b',
  },
  {
    id: 'q3',
    category: 'Geography',
    round: 'Sprint',
    prompt: 'What is the largest ocean on Earth?',
    options: ['Atlantic Ocean', 'Indian Ocean', 'Arctic Ocean', 'Pacific Ocean'],
    correctIndex: 3,
    explanation: 'The Pacific Ocean covers more area than all other oceans combined.',
    timeLimitMs: 9_000,
    basePoints: 140,
    accent: '#22d3ee',
  },
  {
    id: 'q4',
    category: 'Pop Culture',
    round: 'Sprint',
    prompt: 'Which movie franchise features the planet Tatooine?',
    options: ['Star Trek', 'Star Wars', 'Dune', 'Avatar'],
    correctIndex: 1,
    explanation: 'Tatooine is a key desert planet in the Star Wars universe.',
    timeLimitMs: 9_000,
    basePoints: 140,
    accent: '#c084fc',
  },
  {
    id: 'q5',
    category: 'Science',
    round: 'Lightning',
    prompt: 'What is the chemical symbol for gold?',
    options: ['Go', 'Gd', 'Au', 'Ag'],
    correctIndex: 2,
    explanation: 'Gold uses the symbol Au from the Latin word aurum.',
    timeLimitMs: 8_000,
    basePoints: 160,
    accent: '#facc15',
  },
  {
    id: 'q6',
    category: 'Art',
    round: 'Lightning',
    prompt: 'The Mona Lisa was painted by which artist?',
    options: ['Leonardo da Vinci', 'Vincent van Gogh', 'Pablo Picasso', 'Claude Monet'],
    correctIndex: 0,
    explanation: 'Leonardo da Vinci painted the Mona Lisa in the early 16th century.',
    timeLimitMs: 8_000,
    basePoints: 160,
    accent: '#fb7185',
  },
  {
    id: 'q7',
    category: 'Sports',
    round: 'Lightning',
    prompt: 'How many players are on the field for one soccer team at a time?',
    options: ['9', '10', '11', '12'],
    correctIndex: 2,
    explanation: 'A soccer team fields 11 players, including the goalkeeper.',
    timeLimitMs: 8_000,
    basePoints: 160,
    accent: '#34d399',
  },
  {
    id: 'q8',
    category: 'Technology',
    round: 'Pressure',
    prompt: 'What does CPU stand for?',
    options: ['Central Processing Unit', 'Core Performance Utility', 'Computer Power Unit', 'Central Program Upload'],
    correctIndex: 0,
    explanation: 'CPU is the standard abbreviation for Central Processing Unit.',
    timeLimitMs: 7_000,
    basePoints: 190,
    accent: '#60a5fa',
  },
  {
    id: 'q9',
    category: 'Literature',
    round: 'Pressure',
    prompt: 'Who wrote "1984"?',
    options: ['Aldous Huxley', 'George Orwell', 'Ray Bradbury', 'J. R. R. Tolkien'],
    correctIndex: 1,
    explanation: 'George Orwell wrote the dystopian novel 1984.',
    timeLimitMs: 7_000,
    basePoints: 190,
    accent: '#f472b6',
  },
  {
    id: 'q10',
    category: 'Finale',
    round: 'Boss round',
    prompt: 'Which number is the only even prime number?',
    options: ['1', '2', '3', '5'],
    correctIndex: 1,
    explanation: 'Two is the only even number that is also prime.',
    timeLimitMs: 6_500,
    basePoints: 240,
    accent: '#f97316',
  },
  {
    id: 'q11',
    category: 'Music',
    round: 'Bonus round',
    prompt: 'How many keys are on a standard piano?',
    options: ['61', '76', '88', '96'],
    correctIndex: 2,
    explanation: 'A modern standard piano has 88 keys.',
    timeLimitMs: 7_000,
    basePoints: 200,
    accent: '#a78bfa',
  },
  {
    id: 'q12',
    category: 'Nature',
    round: 'Bonus round',
    prompt: 'What is a group of wolves called?',
    options: ['Pack', 'Swarm', 'Herd', 'Flock'],
    correctIndex: 0,
    explanation: 'Wolves usually travel in a pack.',
    timeLimitMs: 7_000,
    basePoints: 200,
    accent: '#38bdf8',
  },
]

function shuffle<T>(items: T[]): T[] {
  const next = [...items]
  for (let index = next.length - 1; index > 0; index -= 1) {
    const swapIndex = Math.floor(Math.random() * (index + 1))
    ;[next[index], next[swapIndex]] = [next[swapIndex], next[index]]
  }
  return next
}

function loadBestScore(): number {
  if (typeof window === 'undefined') {
    return 0
  }

  const value = window.localStorage.getItem(STORAGE_KEY)
  return value ? Number.parseInt(value, 10) || 0 : 0
}

function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value))
}

export function App() {
  const [phase, setPhase] = useState<Phase>('idle')
  const [deck, setDeck] = useState<Question[]>([])
  const [questionIndex, setQuestionIndex] = useState(0)
  const [selectedIndex, setSelectedIndex] = useState(0)
  const [score, setScore] = useState(0)
  const [correctCount, setCorrectCount] = useState(0)
  const [missCount, setMissCount] = useState(0)
  const [streak, setStreak] = useState(0)
  const [bestStreak, setBestStreak] = useState(0)
  const [bestScore, setBestScore] = useState(loadBestScore)
  const [remainingMs, setRemainingMs] = useState(0)
  const [answeredMs, setAnsweredMs] = useState(0)
  const [lastChoiceIndex, setLastChoiceIndex] = useState<number | null>(null)
  const [feedback, setFeedback] = useState<Feedback | null>(null)

  const timerRef = useRef<number | null>(null)
  const advanceRef = useRef<number | null>(null)
  const deadlineRef = useRef(0)
  const resolvedRef = useRef(false)
  const scoreRef = useRef(0)
  const streakRef = useRef(0)
  const remainingMsRef = useRef(0)
  const correctCountRef = useRef(0)
  const missCountRef = useRef(0)
  const optionRefs = useRef<Array<HTMLButtonElement | null>>([])

  const currentQuestion = deck[questionIndex]

  const accuracy = useMemo(() => {
    const total = correctCount + missCount
    return total === 0 ? 100 : Math.round((correctCount / total) * 100)
  }, [correctCount, missCount])

  const averageAnswerMs = useMemo(() => {
    const total = correctCount + missCount
    return total === 0 ? 0 : Math.round(answeredMs / total)
  }, [answeredMs, correctCount, missCount])

  const progress = deck.length === 0 ? 0 : Math.round((questionIndex / deck.length) * 100)
  const timePercent = currentQuestion ? clamp((remainingMs / currentQuestion.timeLimitMs) * 100, 0, 100) : 0

  useEffect(() => {
    scoreRef.current = score
    streakRef.current = streak
    remainingMsRef.current = remainingMs
    correctCountRef.current = correctCount
    missCountRef.current = missCount
  }, [correctCount, missCount, remainingMs, score, streak])

  useEffect(() => {
    return () => {
      if (timerRef.current !== null) {
        window.clearInterval(timerRef.current)
      }
      if (advanceRef.current !== null) {
        window.clearTimeout(advanceRef.current)
      }
    }
  }, [])

  useEffect(() => {
    if (phase !== 'playing' || !currentQuestion) {
      return
    }

    deadlineRef.current = Date.now() + currentQuestion.timeLimitMs
    setRemainingMs(currentQuestion.timeLimitMs)
    remainingMsRef.current = currentQuestion.timeLimitMs
    resolvedRef.current = false
    setSelectedIndex(0)
    setLastChoiceIndex(null)
    optionRefs.current[0]?.focus()

    if (timerRef.current !== null) {
      window.clearInterval(timerRef.current)
    }

    timerRef.current = window.setInterval(() => {
      const left = Math.max(0, deadlineRef.current - Date.now())
      setRemainingMs(left)
      remainingMsRef.current = left

      if (left === 0 && !resolvedRef.current) {
        resolveQuestion(null, 'timeout')
      }
    }, 40)

    return () => {
      if (timerRef.current !== null) {
        window.clearInterval(timerRef.current)
        timerRef.current = null
      }
    }
  }, [currentQuestion, phase])

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      const target = event.target as HTMLElement | null
      if (target && ['BUTTON', 'INPUT', 'TEXTAREA'].includes(target.tagName)) {
        return
      }

      if (phase === 'idle' || phase === 'finished') {
        if (event.code === 'Enter' || event.code === 'Space') {
          event.preventDefault()
          startGame()
        }
        return
      }

      if (phase !== 'playing' || !currentQuestion) {
        return
      }

      if (event.code === 'ArrowUp' || event.code === 'ArrowLeft') {
        event.preventDefault()
        setSelectedIndex((value) => (value + currentQuestion.options.length - 1) % currentQuestion.options.length)
        return
      }

      if (event.code === 'ArrowDown' || event.code === 'ArrowRight') {
        event.preventDefault()
        setSelectedIndex((value) => (value + 1) % currentQuestion.options.length)
        return
      }

      if (event.code === 'Home') {
        event.preventDefault()
        setSelectedIndex(0)
        return
      }

      if (event.code === 'End') {
        event.preventDefault()
        setSelectedIndex(currentQuestion.options.length - 1)
        return
      }

      if (event.code === 'Enter' || event.code === 'Space') {
        event.preventDefault()
        resolveQuestion(selectedIndex, 'answer')
        return
      }

      const digit = Number.parseInt(event.key, 10)
      if (Number.isInteger(digit) && digit >= 1 && digit <= currentQuestion.options.length) {
        event.preventDefault()
        resolveQuestion(digit - 1, 'answer')
      }
    }

    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [currentQuestion, phase, selectedIndex])

  const startGame = useCallback(() => {
    const nextDeck = shuffle(QUESTION_BANK).slice(0, QUESTION_COUNT)

    if (advanceRef.current !== null) {
      window.clearTimeout(advanceRef.current)
      advanceRef.current = null
    }

    if (timerRef.current !== null) {
      window.clearInterval(timerRef.current)
      timerRef.current = null
    }

    setDeck(nextDeck)
    setQuestionIndex(0)
    setSelectedIndex(0)
    setScore(0)
    setCorrectCount(0)
    setMissCount(0)
    setStreak(0)
    setBestStreak(0)
    setRemainingMs(nextDeck[0]?.timeLimitMs ?? 0)
    remainingMsRef.current = nextDeck[0]?.timeLimitMs ?? 0
    setAnsweredMs(0)
    setLastChoiceIndex(null)
    setFeedback(null)
    setPhase('playing')
    scoreRef.current = 0
    streakRef.current = 0
    correctCountRef.current = 0
    missCountRef.current = 0
  }, [])

  const finishGame = useCallback((finalScore: number) => {
    setPhase('finished')
    setFeedback(null)
    setBestScore((prev) => {
      const next = Math.max(prev, finalScore)
      if (typeof window !== 'undefined') {
        window.localStorage.setItem(STORAGE_KEY, String(next))
      }
      return next
    })
  }, [])

  const resolveQuestion = useCallback(
    (answerIndex: number | null, reason: 'answer' | 'timeout') => {
      if (resolvedRef.current || phase !== 'playing' || !currentQuestion) {
        return
      }

      resolvedRef.current = true

      if (timerRef.current !== null) {
        window.clearInterval(timerRef.current)
        timerRef.current = null
      }

      const currentRemaining = remainingMsRef.current
      const elapsed = currentQuestion.timeLimitMs - currentRemaining
      const isCorrect = answerIndex === currentQuestion.correctIndex
      const currentStreak = streakRef.current
      const points = isCorrect ? currentQuestion.basePoints + Math.max(0, Math.floor(currentRemaining / 50)) + currentStreak * 20 : 0
      const nextScore = scoreRef.current + points
      const nextStreak = isCorrect ? currentStreak + 1 : 0
      const nextCorrect = correctCountRef.current + (isCorrect ? 1 : 0)
      const nextMisses = missCountRef.current + (isCorrect ? 0 : 1)

      setAnsweredMs((value) => value + elapsed)
      setScore(nextScore)
      setCorrectCount(nextCorrect)
      setMissCount(nextMisses)
      setStreak(nextStreak)
      setBestStreak((value) => Math.max(value, nextStreak))
      scoreRef.current = nextScore
      streakRef.current = nextStreak
      correctCountRef.current = nextCorrect
      missCountRef.current = nextMisses
      setLastChoiceIndex(answerIndex)
      setFeedback({
        mode: isCorrect ? 'correct' : reason === 'timeout' ? 'timeout' : 'wrong',
        points,
        answer: currentQuestion.options[currentQuestion.correctIndex],
        explanation: currentQuestion.explanation,
      })
      setPhase('feedback')

      if (advanceRef.current !== null) {
        window.clearTimeout(advanceRef.current)
      }

      advanceRef.current = window.setTimeout(() => {
        const nextIndex = questionIndex + 1
        const isLastQuestion = nextIndex >= deck.length

        setFeedback(null)

        if (isLastQuestion) {
          finishGame(nextScore)
          return
        }

        setQuestionIndex(nextIndex)
        setSelectedIndex(0)
        setRemainingMs(deck[nextIndex].timeLimitMs)
        setPhase('playing')
        resolvedRef.current = false
      }, 1100)
    },
    [correctCount, currentQuestion, deck.length, finishGame, missCount, phase, questionIndex, remainingMs, score, streak],
  )

  const optionHint = phase === 'playing' ? 'Choose with 1-4, arrows, Enter, or click' : 'Press Enter or Space to start'
  const currentAnswer = currentQuestion?.options[selectedIndex] ?? ''

  return (
    <div style={styles.shell}>
      <div style={styles.glowA} />
      <div style={styles.glowB} />

      <main style={styles.frame}>
        <header style={styles.header}>
          <div>
            <p style={styles.kicker}>Cubeforge mini-game</p>
            <h1 style={styles.title}>Quiz Games</h1>
            <p style={styles.subtitle}>
              Answer fast, chain streaks for bonus points, and beat the clock across a category mix of trivia rounds.
            </p>
          </div>

          <div style={styles.hintCard}>
            <span style={styles.hintKey}>1-4</span>
            <span>pick an answer</span>
            <span style={styles.hintDot}>•</span>
            <span style={styles.hintKey}>Enter</span>
            <span>submit</span>
            <span style={styles.hintDot}>•</span>
            <span style={styles.hintKey}>Space</span>
            <span>start / restart</span>
          </div>
        </header>

        <section style={styles.hudGrid}>
          <Metric label="Score" value={String(score)} accent="#fbbf24" />
          <Metric label="Accuracy" value={`${accuracy}%`} accent="#34d399" />
          <Metric label="Streak" value={String(streak)} accent="#c084fc" />
          <Metric label="Best score" value={String(bestScore)} accent="#60a5fa" />
        </section>

        <section style={styles.panel}>
          <div style={styles.panelTop}>
            <div>
              <p style={styles.sectionLabel}>Round {Math.min(questionIndex + 1, QUESTION_COUNT)} of {QUESTION_COUNT}</p>
              <h2 style={styles.question}>{phase === 'idle' ? 'Ready for a lightning trivia run?' : currentQuestion?.prompt ?? 'Run complete'}</h2>
              <p style={styles.sectionSubcopy}>
                {phase === 'idle'
                  ? 'Each round has a different category and timer. Choose quickly to keep your streak alive.'
                  : phase === 'finished'
                    ? 'You cleared the set. Restart to challenge a new shuffled run.'
                    : currentQuestion
                      ? `${currentQuestion.category} round · ${currentQuestion.round}`
                      : ''}
              </p>
            </div>

            <div style={styles.clockCard}>
              <span style={styles.clockLabel}>Clock</span>
              <span style={styles.clockValue}>{phase === 'idle' ? '--.-s' : `${Math.max(0, remainingMs / 1000).toFixed(1)}s`}</span>
              <div style={styles.clockTrack} aria-hidden="true">
                <div style={{ ...styles.clockFill, width: `${timePercent}%`, background: currentQuestion?.accent ?? '#38bdf8' }} />
              </div>
            </div>
          </div>

          <div style={styles.metaRow}>
            <Chip label={currentQuestion?.category ?? 'Trivia'} color={currentQuestion?.accent ?? '#38bdf8'} />
            <Chip label={currentQuestion?.round ?? 'Press start'} color="#94a3b8" />
            <span style={styles.metaText}>{optionHint}</span>
          </div>

          {phase !== 'idle' && (
            <div style={styles.answerGrid} role="group" aria-label="Multiple choice answers">
              {currentQuestion?.options.map((option, index) => {
                const isSelected = index === selectedIndex
                const isCorrect = phase !== 'playing' && index === currentQuestion.correctIndex
                const isWrong = phase !== 'playing' && lastChoiceIndex !== null && lastChoiceIndex === index && index !== currentQuestion.correctIndex && feedback !== null

                return (
                  <button
                    key={option}
                    ref={(element) => {
                      optionRefs.current[index] = element
                    }}
                    type="button"
                    onClick={() => {
                      if (phase === 'playing') {
                        setSelectedIndex(index)
                        resolveQuestion(index, 'answer')
                      }
                    }}
                    style={{
                      ...styles.answerButton,
                      ...(isSelected && phase === 'playing' ? styles.answerSelected : {}),
                      ...(isCorrect ? styles.answerCorrect : {}),
                      ...(isWrong ? styles.answerWrong : {}),
                    }}
                  >
                    <span style={styles.answerIndex}>{index + 1}</span>
                    <span style={styles.answerText}>{option}</span>
                  </button>
                )
              })}
            </div>
          )}

          {phase === 'idle' && (
            <div style={styles.centerStage}>
              <p style={styles.centerTitle}>Ten rounds. One run. A fresh trivia shuffle each restart.</p>
              <p style={styles.centerText}>
                Every question gets harder and faster. Hit Space or Enter to begin, then use the keyboard or click to answer.
              </p>
              <button type="button" onClick={startGame} style={styles.primaryButton}>
                Start quiz
              </button>
            </div>
          )}

          {feedback && phase !== 'idle' && phase !== 'finished' && (
            <div style={styles.feedbackCard}>
              <div style={styles.feedbackHeader}>
                <span style={{ ...styles.feedbackBadge, background: feedback.mode === 'correct' ? 'rgba(52, 211, 153, 0.18)' : 'rgba(248, 113, 113, 0.18)', color: feedback.mode === 'correct' ? '#86efac' : '#fda4af' }}>
                  {feedback.mode === 'correct' ? 'Correct' : feedback.mode === 'timeout' ? 'Out of time' : 'Missed'}
                </span>
                <strong style={styles.feedbackScore}>+{feedback.points}</strong>
              </div>
              <p style={styles.feedbackText}>{feedback.explanation}</p>
              <p style={styles.feedbackAnswer}>
                Answer: <span>{feedback.answer}</span>
              </p>
            </div>
          )}

          {phase === 'finished' && (
            <div style={styles.summaryCard}>
              <div>
                <p style={styles.summaryTitle}>Run complete</p>
                <p style={styles.summaryText}>
                  You scored <strong>{score}</strong> points with <strong>{correctCount}</strong> correct answers and a best streak of <strong>{bestStreak}</strong>.
                </p>
              </div>

              <div style={styles.summaryStats}>
                <div>
                  <span style={styles.summaryLabel}>Accuracy</span>
                  <strong style={styles.summaryValue}>{accuracy}%</strong>
                </div>
                <div>
                  <span style={styles.summaryLabel}>Average pace</span>
                  <strong style={styles.summaryValue}>{averageAnswerMs === 0 ? '--' : `${averageAnswerMs} ms`}</strong>
                </div>
                <div>
                  <span style={styles.summaryLabel}>Best score</span>
                  <strong style={styles.summaryValue}>{bestScore}</strong>
                </div>
              </div>

              <button type="button" onClick={startGame} style={styles.primaryButton}>
                Play again
              </button>
            </div>
          )}
        </section>

        <footer style={styles.footer}>
          <span>Controls: 1-4, arrows, Enter, click</span>
          <span>Current pick: {phase === 'playing' && currentAnswer ? currentAnswer : phase === 'finished' ? 'Restart ready' : 'Waiting to start'}</span>
          <span>Progress: {phase === 'idle' ? '0%' : `${progress}%`}</span>
        </footer>
      </main>
    </div>
  )
}

function Chip({ label, color }: { label: string; color: string }) {
  return <span style={{ ...styles.chip, color, borderColor: `${color}55` }}>{label}</span>
}

function Metric({ label, value, accent }: { label: string; value: string; accent: string }) {
  return (
    <div style={styles.metric}>
      <span style={styles.metricLabel}>{label}</span>
      <strong style={{ ...styles.metricValue, color: accent }}>{value}</strong>
    </div>
  )
}

const styles: Record<string, CSSProperties> = {
  shell: {
    width: '100%',
    display: 'flex',
    justifyContent: 'center',
  },
  glowA: {
    display: 'none',
  },
  glowB: {
    display: 'none',
  },
  frame: {
    width: 'min(1120px, 100%)',
    height: APP_FRAME_HEIGHT,
    display: 'flex',
    flexDirection: 'column',
    gap: 18,
    padding: 20,
    borderRadius: 28,
    background: 'rgba(8, 13, 24, 0.96)',
    border: '1px solid rgba(148, 163, 184, 0.16)',
    boxShadow: '0 24px 70px rgba(2, 6, 23, 0.32)',
    overflow: 'hidden',
  },
  header: {
    display: 'flex',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    gap: 16,
    flexWrap: 'wrap',
  },
  kicker: {
    margin: 0,
    fontSize: 12,
    letterSpacing: 3,
    textTransform: 'uppercase',
    color: '#8ea0c9',
  },
  title: {
    margin: '8px 0 10px',
    fontSize: 'clamp(2.4rem, 4vw, 4.8rem)',
    lineHeight: 0.95,
    letterSpacing: -1.2,
  },
  subtitle: {
    margin: 0,
    maxWidth: 720,
    color: '#c3d0ea',
    fontSize: 16,
    lineHeight: 1.65,
  },
  hintCard: {
    display: 'flex',
    alignItems: 'center',
    gap: 8,
    flexWrap: 'wrap',
    padding: '14px 16px',
    background: 'rgba(12, 18, 35, 0.7)',
    border: '1px solid rgba(148, 163, 184, 0.2)',
    borderRadius: 18,
    color: '#d9e2f5',
    boxShadow: '0 20px 40px rgba(3, 7, 18, 0.24)',
  },
  hintKey: {
    padding: '4px 8px',
    borderRadius: 8,
    background: 'rgba(255, 255, 255, 0.08)',
    color: '#f8fafc',
    fontWeight: 700,
    fontSize: 12,
    letterSpacing: 0.4,
  },
  hintDot: {
    color: '#6b7a98',
  },
  hudGrid: {
    display: 'grid',
    gridTemplateColumns: 'repeat(4, minmax(0, 1fr))',
    gap: 12,
  },
  metric: {
    padding: '16px 18px',
    borderRadius: 18,
    background: 'rgba(10, 18, 34, 0.78)',
    border: '1px solid rgba(148, 163, 184, 0.16)',
    boxShadow: '0 16px 30px rgba(2, 6, 23, 0.22)',
  },
  metricLabel: {
    display: 'block',
    fontSize: 12,
    letterSpacing: 1.4,
    textTransform: 'uppercase',
    color: '#8ea0c9',
    marginBottom: 8,
  },
  metricValue: {
    fontSize: 'clamp(1.5rem, 2vw, 2.1rem)',
  },
  panel: {
    display: 'grid',
    flex: 1,
    minHeight: 0,
    overflow: 'auto',
    gap: 16,
    padding: '22px',
    borderRadius: 28,
    background: 'rgba(15, 23, 42, 0.94)',
    border: '1px solid rgba(148, 163, 184, 0.18)',
  },
  panelTop: {
    display: 'flex',
    justifyContent: 'space-between',
    gap: 16,
    flexWrap: 'wrap',
    alignItems: 'flex-start',
  },
  sectionLabel: {
    margin: 0,
    fontSize: 12,
    letterSpacing: 2,
    textTransform: 'uppercase',
    color: '#94a3b8',
  },
  question: {
    margin: '10px 0 8px',
    fontSize: 'clamp(1.7rem, 3vw, 2.8rem)',
    lineHeight: 1.05,
    maxWidth: 820,
  },
  sectionSubcopy: {
    margin: 0,
    color: '#b9c7e2',
    maxWidth: 760,
    lineHeight: 1.6,
  },
  clockCard: {
    minWidth: 220,
    padding: 16,
    borderRadius: 20,
    background: 'rgba(255, 255, 255, 0.04)',
    border: '1px solid rgba(148, 163, 184, 0.14)',
  },
  clockLabel: {
    display: 'block',
    fontSize: 12,
    letterSpacing: 1.4,
    textTransform: 'uppercase',
    color: '#8ea0c9',
  },
  clockValue: {
    display: 'block',
    margin: '8px 0 12px',
    fontSize: 'clamp(1.8rem, 3vw, 2.7rem)',
    fontWeight: 700,
  },
  clockTrack: {
    height: 10,
    borderRadius: 999,
    background: 'rgba(255, 255, 255, 0.08)',
    overflow: 'hidden',
  },
  clockFill: {
    height: '100%',
    borderRadius: 999,
    transition: 'width 0.08s linear',
  },
  metaRow: {
    display: 'flex',
    alignItems: 'center',
    gap: 10,
    flexWrap: 'wrap',
  },
  chip: {
    display: 'inline-flex',
    alignItems: 'center',
    padding: '7px 12px',
    borderRadius: 999,
    background: 'rgba(255, 255, 255, 0.05)',
    border: '1px solid rgba(148, 163, 184, 0.16)',
    fontSize: 13,
    fontWeight: 700,
  },
  metaText: {
    color: '#8ea0c9',
    fontSize: 14,
  },
  answerGrid: {
    display: 'grid',
    gridTemplateColumns: 'repeat(2, minmax(0, 1fr))',
    gap: 12,
  },
  answerButton: {
    display: 'flex',
    alignItems: 'center',
    gap: 14,
    minHeight: 84,
    padding: '16px 18px',
    borderRadius: 20,
    background: 'rgba(255, 255, 255, 0.04)',
    color: '#f8fafc',
    border: '1px solid rgba(148, 163, 184, 0.18)',
    cursor: 'pointer',
    textAlign: 'left',
    transition: 'transform 0.15s ease, border-color 0.15s ease, background 0.15s ease, box-shadow 0.15s ease',
  },
  answerSelected: {
    borderColor: 'rgba(255, 255, 255, 0.44)',
    transform: 'translateY(-1px)',
    boxShadow: '0 18px 30px rgba(15, 23, 42, 0.3)',
  },
  answerCorrect: {
    background: 'rgba(34, 197, 94, 0.16)',
    borderColor: 'rgba(74, 222, 128, 0.5)',
  },
  answerWrong: {
    background: 'rgba(244, 63, 94, 0.14)',
    borderColor: 'rgba(251, 113, 133, 0.4)',
  },
  answerIndex: {
    flex: '0 0 auto',
    width: 34,
    height: 34,
    borderRadius: '50%',
    display: 'grid',
    placeItems: 'center',
    background: 'rgba(255, 255, 255, 0.08)',
    color: '#cbd5e1',
    fontWeight: 800,
  },
  answerText: {
    fontSize: 16,
    lineHeight: 1.45,
    fontWeight: 600,
  },
  centerStage: {
    display: 'grid',
    placeItems: 'center',
    gap: 14,
    padding: '12px 0 8px',
    textAlign: 'center',
  },
  centerTitle: {
    margin: 0,
    fontSize: 'clamp(1.4rem, 2.4vw, 2rem)',
    fontWeight: 700,
  },
  centerText: {
    margin: 0,
    maxWidth: 640,
    color: '#bcc9e3',
    lineHeight: 1.65,
  },
  primaryButton: {
    appearance: 'none',
    border: 'none',
    borderRadius: 16,
    padding: '14px 20px',
    fontSize: 15,
    fontWeight: 800,
    color: '#08111f',
    background: '#fbbf24',
    cursor: 'pointer',
    boxShadow: '0 18px 40px rgba(251, 191, 36, 0.18)',
  },
  feedbackCard: {
    display: 'grid',
    gap: 10,
    padding: 18,
    borderRadius: 20,
    background: 'rgba(255, 255, 255, 0.04)',
    border: '1px solid rgba(148, 163, 184, 0.18)',
  },
  feedbackHeader: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 12,
  },
  feedbackBadge: {
    display: 'inline-flex',
    alignItems: 'center',
    padding: '6px 10px',
    borderRadius: 999,
    fontSize: 12,
    fontWeight: 800,
    letterSpacing: 1,
    textTransform: 'uppercase',
  },
  feedbackScore: {
    color: '#f8fafc',
    fontSize: 18,
  },
  feedbackText: {
    margin: 0,
    color: '#d6dfee',
    lineHeight: 1.6,
  },
  feedbackAnswer: {
    margin: 0,
    color: '#8ea0c9',
  },
  summaryCard: {
    display: 'grid',
    gap: 16,
    padding: 20,
    borderRadius: 22,
    background: 'rgba(99, 102, 241, 0.10)',
    border: '1px solid rgba(148, 163, 184, 0.18)',
  },
  summaryTitle: {
    margin: 0,
    fontSize: 13,
    textTransform: 'uppercase',
    letterSpacing: 2,
    color: '#c7d2fe',
  },
  summaryText: {
    margin: '10px 0 0',
    color: '#e5ecfb',
    lineHeight: 1.65,
    fontSize: 17,
  },
  summaryStats: {
    display: 'grid',
    gridTemplateColumns: 'repeat(3, minmax(0, 1fr))',
    gap: 12,
  },
  summaryLabel: {
    display: 'block',
    fontSize: 12,
    letterSpacing: 1.2,
    textTransform: 'uppercase',
    color: '#a8b7d6',
    marginBottom: 8,
  },
  summaryValue: {
    fontSize: 22,
  },
  footer: {
    display: 'flex',
    justifyContent: 'space-between',
    gap: 12,
    flexWrap: 'wrap',
    color: '#8ea0c9',
    fontSize: 13,
    padding: '0 6px',
  },
}
