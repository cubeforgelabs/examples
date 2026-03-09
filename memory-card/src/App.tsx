import { useState, useCallback, useEffect, useRef } from 'react'

const SYMBOLS = ['\u2605', '\u2666', '\u2660', '\u2665', '\u25CF', '\u25B2', '\u25A0', '\u2663']
const COLORS = ['#f7c948', '#e06c75', '#61afef', '#e5c07b', '#c678dd', '#56b6c2', '#98c379', '#d19a66']

interface Card {
  id: number
  symbolIndex: number
  flipped: boolean
  matched: boolean
}

function shuffle<T>(arr: T[]): T[] {
  const a = [...arr]
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1))
    ;[a[i], a[j]] = [a[j], a[i]]
  }
  return a
}

function createDeck(): Card[] {
  const indices = [...Array(8).keys(), ...Array(8).keys()]
  return shuffle(indices).map((symbolIndex, id) => ({
    id,
    symbolIndex,
    flipped: false,
    matched: false,
  }))
}

export function App() {
  const [cards, setCards] = useState(createDeck)
  const [selected, setSelected] = useState<number[]>([])
  const [moves, setMoves] = useState(0)
  const [locked, setLocked] = useState(false)
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  const matchedCount = cards.filter((c) => c.matched).length
  const won = matchedCount === 16

  useEffect(() => {
    return () => {
      if (timerRef.current) clearTimeout(timerRef.current)
    }
  }, [])

  const handleClick = useCallback(
    (id: number) => {
      if (locked || won) return
      const card = cards[id]
      if (card.flipped || card.matched) return

      const next = cards.map((c) => (c.id === id ? { ...c, flipped: true } : c))
      const nextSelected = [...selected, id]

      if (nextSelected.length === 2) {
        setMoves((m) => m + 1)
        const [firstId, secondId] = nextSelected
        const first = next[firstId]
        const second = next[secondId]

        if (first.symbolIndex === second.symbolIndex) {
          const matched = next.map((c) =>
            c.id === firstId || c.id === secondId ? { ...c, matched: true } : c,
          )
          setCards(matched)
          setSelected([])
        } else {
          setLocked(true)
          setCards(next)
          timerRef.current = setTimeout(() => {
            setCards((prev) =>
              prev.map((c) =>
                c.id === firstId || c.id === secondId ? { ...c, flipped: false } : c,
              ),
            )
            setLocked(false)
            timerRef.current = null
          }, 800)
          setSelected([])
        }
      } else {
        setCards(next)
        setSelected(nextSelected)
      }
    },
    [cards, selected, locked, won],
  )

  const restart = useCallback(() => {
    if (timerRef.current) {
      clearTimeout(timerRef.current)
      timerRef.current = null
    }
    setCards(createDeck())
    setSelected([])
    setMoves(0)
    setLocked(false)
  }, [])

  return (
    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 16 }}>
      <h1 style={{ fontSize: 22, color: '#ccc', letterSpacing: 2 }}>MEMORY CARD</h1>

      <div style={{ display: 'flex', gap: 24, fontSize: 14, color: '#888' }}>
        <span>Moves: {moves}</span>
        <span>Matched: {matchedCount / 2} / 8</span>
      </div>

      {won && (
        <div style={{ fontSize: 18, color: '#98c379', fontWeight: 'bold' }}>
          You won in {moves} moves!
        </div>
      )}

      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(4, 80px)',
          gridTemplateRows: 'repeat(4, 96px)',
          gap: 8,
          padding: 16,
          background: '#0d1117',
          borderRadius: 12,
          border: '1px solid #21262d',
        }}
      >
        {cards.map((card) => {
          const faceUp = card.flipped || card.matched
          const bg = card.matched ? '#1a3a1a' : faceUp ? '#0d1117' : '#1e2535'
          const border = card.matched
            ? '2px solid #2d5a2d'
            : faceUp
              ? '2px solid #30363d'
              : '2px solid #30363d'

          return (
            <button
              key={card.id}
              onClick={() => handleClick(card.id)}
              style={{
                width: 80,
                height: 96,
                background: bg,
                border,
                borderRadius: 8,
                cursor: faceUp && !card.matched ? 'default' : 'pointer',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                fontSize: 36,
                color: faceUp ? COLORS[card.symbolIndex] : '#1e2535',
                opacity: card.matched ? 0.7 : 1,
                transition: 'background 0.2s, color 0.2s, opacity 0.2s',
                outline: 'none',
                fontFamily: 'serif',
              }}
            >
              {faceUp ? SYMBOLS[card.symbolIndex] : '\u25CF'}
            </button>
          )
        })}
      </div>

      <button
        onClick={restart}
        style={{
          padding: '8px 24px',
          background: '#21262d',
          color: '#ccc',
          border: '1px solid #30363d',
          borderRadius: 6,
          cursor: 'pointer',
          fontSize: 14,
          fontFamily: "'Courier New', monospace",
        }}
      >
        New Game
      </button>
    </div>
  )
}
