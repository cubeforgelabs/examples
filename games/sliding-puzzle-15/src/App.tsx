import { useEffect, useRef, useState } from 'react'
import { Game, World, Camera2D, Entity, Transform, Sprite } from '@cubeforge/react'

// ─── Constants ────────────────────────────────────────────────────────────────
const SIZE = 4
const CELL = 90
const GAP = 4
const BOARD_PX = SIZE * CELL + (SIZE + 1) * GAP
const W = BOARD_PX + 40
const H = BOARD_PX + 40
const OFF = 20 + GAP + CELL / 2

type GamePhase = 'idle' | 'playing' | 'win'

function tileX(c: number) { return OFF + c * (CELL + GAP) }
function tileY(r: number) { return OFF + r * (CELL + GAP) }

// ─── Tile colors (hue-based gradient) ─────────────────────────────────────────
function tileColor(n: number): string {
  if (n === 0) return 'transparent'
  const hue = ((n - 1) / 15) * 240 + 200 // blue → purple range
  return `hsl(${hue % 360}, 55%, 50%)`
}

// ─── Solvability check ───────────────────────────────────────────────────────
function isSolvable(tiles: number[]): boolean {
  let inversions = 0
  const flat = tiles.filter(t => t !== 0)
  for (let i = 0; i < flat.length; i++) {
    for (let j = i + 1; j < flat.length; j++) {
      if (flat[i] > flat[j]) inversions++
    }
  }
  const emptyRow = Math.floor(tiles.indexOf(0) / SIZE)
  // For even-sized grid: solvable if (inversions + row of blank from bottom) is odd
  const blankFromBottom = SIZE - emptyRow
  return (inversions + blankFromBottom) % 2 === 1
}

function shuffle(): number[] {
  const arr = Array.from({ length: 16 }, (_, i) => i) // 0=empty, 1-15
  // Fisher-Yates
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [arr[i], arr[j]] = [arr[j], arr[i]]
  }
  if (!isSolvable(arr)) {
    // Swap first two non-zero tiles to fix parity
    const a = arr.findIndex(t => t !== 0)
    let b = arr.findIndex((t, idx) => t !== 0 && idx !== a)
    ;[arr[a], arr[b]] = [arr[b], arr[a]]
    // Double-check
    if (!isSolvable(arr)) {
      ;[arr[a], arr[b]] = [arr[b], arr[a]]
    }
  }
  return arr
}

function isWon(tiles: number[]): boolean {
  for (let i = 0; i < 15; i++) {
    if (tiles[i] !== i + 1) return false
  }
  return tiles[15] === 0
}

// ─── App ──────────────────────────────────────────────────────────────────────
export function App() {
  const [tiles, setTiles] = useState<number[]>(() => shuffle())
  const [moves, setMoves] = useState(0)
  const [phase, setPhase] = useState<GamePhase>('idle')
  const [elapsed, setElapsed] = useState(0)
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null)
  const startTimeRef = useRef(0)

  function startGame() {
    const t = shuffle()
    setTiles(t)
    setMoves(0)
    setElapsed(0)
    setPhase('playing')
    startTimeRef.current = Date.now()
  }

  // Timer
  useEffect(() => {
    if (phase === 'playing') {
      startTimeRef.current = Date.now()
      timerRef.current = setInterval(() => {
        setElapsed(Math.floor((Date.now() - startTimeRef.current) / 1000))
      }, 200)
      return () => { if (timerRef.current) clearInterval(timerRef.current) }
    } else {
      if (timerRef.current) clearInterval(timerRef.current)
    }
  }, [phase])

  function tryMove(idx: number) {
    if (phase !== 'playing') return
    const emptyIdx = tiles.indexOf(0)
    const r = Math.floor(idx / SIZE), c = idx % SIZE
    const er = Math.floor(emptyIdx / SIZE), ec = emptyIdx % SIZE
    const adj = (Math.abs(r - er) + Math.abs(c - ec)) === 1
    if (!adj) return

    const next = [...tiles]
    ;[next[idx], next[emptyIdx]] = [next[emptyIdx], next[idx]]
    setTiles(next)
    setMoves(m => m + 1)

    if (isWon(next)) {
      setPhase('win')
    }
  }

  // Keyboard: move tile relative to empty space
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (phase !== 'playing') {
        if (e.code === 'Space' || e.code === 'Enter') startGame()
        return
      }
      const emptyIdx = tiles.indexOf(0)
      const er = Math.floor(emptyIdx / SIZE), ec = emptyIdx % SIZE
      let tr = er, tc = ec
      if (e.code === 'ArrowUp' || e.code === 'KeyW') tr = er + 1
      else if (e.code === 'ArrowDown' || e.code === 'KeyS') tr = er - 1
      else if (e.code === 'ArrowLeft' || e.code === 'KeyA') tc = ec + 1
      else if (e.code === 'ArrowRight' || e.code === 'KeyD') tc = ec - 1
      else return
      if (tr < 0 || tr >= SIZE || tc < 0 || tc >= SIZE) return
      tryMove(tr * SIZE + tc)
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [phase, tiles]) // eslint-disable-line react-hooks/exhaustive-deps

  const formatTime = (s: number) => `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`

  return (
    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 0, fontFamily: '"Courier New", monospace' }}>
      {/* HUD */}
      <div style={{ width: W, display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', alignItems: 'center', padding: '7px 18px', background: '#0d0f1a', borderRadius: '10px 10px 0 0', fontSize: 13, color: '#90a4ae', letterSpacing: 1, userSelect: 'none', boxSizing: 'border-box' }}>
        <div>Moves: <strong style={{ color: '#ffd54f' }}>{moves}</strong></div>
        <div style={{ textAlign: 'center', fontSize: 15, fontWeight: 700, color: '#fff', letterSpacing: 3 }}>15 PUZZLE</div>
        <div style={{ textAlign: 'right' }}>Time: <strong style={{ color: '#4fc3f7' }}>{formatTime(elapsed)}</strong></div>
      </div>

      {/* Board */}
      <div style={{ position: 'relative', width: W, height: H }}>
        <Game width={W} height={H} gravity={0}>
          <World background="#1a1a2e">
            <Camera2D x={W / 2} y={H / 2} background="#1a1a2e" />

            {/* Board bg */}
            <Entity tags={['bg']}>
              <Transform x={W / 2} y={H / 2} />
              <Sprite width={BOARD_PX} height={BOARD_PX} color="#16213e" zIndex={1} />
            </Entity>

            {/* Tiles */}
            {tiles.map((n, idx) => {
              if (n === 0) return null
              const r = Math.floor(idx / SIZE)
              const c = idx % SIZE
              return (
                <Entity key={`tile-${n}`} tags={['tile']}>
                  <Transform x={tileX(c)} y={tileY(r)} />
                  <Sprite width={CELL - 2} height={CELL - 2} color={tileColor(n)} zIndex={5} />
                </Entity>
              )
            })}

            {/* Tile highlights (inner) */}
            {tiles.map((n, idx) => {
              if (n === 0) return null
              const r = Math.floor(idx / SIZE)
              const c = idx % SIZE
              return (
                <Entity key={`hl-${n}`} tags={['hl']}>
                  <Transform x={tileX(c) - 12} y={tileY(r) - 12} />
                  <Sprite width={20} height={20} color="rgba(255,255,255,0.15)" zIndex={6} />
                </Entity>
              )
            })}
          </World>
        </Game>

        {/* Number overlays */}
        {tiles.map((n, idx) => {
          if (n === 0) return null
          const r = Math.floor(idx / SIZE)
          const c = idx % SIZE
          return (
            <div
              key={`num-${n}`}
              onClick={() => tryMove(idx)}
              style={{
                position: 'absolute',
                left: tileX(c) - CELL / 2,
                top: tileY(r) - CELL / 2,
                width: CELL,
                height: CELL,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                fontSize: 28,
                fontWeight: 900,
                color: '#fff',
                textShadow: '1px 1px 3px rgba(0,0,0,0.6)',
                cursor: 'pointer',
                userSelect: 'none',
              }}
            >
              {n}
            </div>
          )
        })}

        {/* Empty cell click target */}
        {(() => {
          const emptyIdx = tiles.indexOf(0)
          const r = Math.floor(emptyIdx / SIZE)
          const c = emptyIdx % SIZE
          return (
            <div
              style={{
                position: 'absolute',
                left: tileX(c) - CELL / 2,
                top: tileY(r) - CELL / 2,
                width: CELL,
                height: CELL,
              }}
            />
          )
        })()}

        {/* Idle overlay */}
        {phase === 'idle' && (
          <div style={overlayStyle}>
            <div style={cardStyle}>
              <p style={{ fontSize: 11, letterSpacing: 4, color: '#4fc3f7', marginBottom: 8 }}>CUBEFORGE</p>
              <p style={{ fontSize: 38, fontWeight: 900, color: '#fff', letterSpacing: 4 }}>15 PUZZLE</p>
              <p style={{ fontSize: 12, color: '#546e7a', marginTop: 16 }}>Slide tiles to order 1–15</p>
              <button onClick={startGame} style={btnStyle}>Play</button>
            </div>
          </div>
        )}

        {/* Win overlay */}
        {phase === 'win' && (
          <div style={overlayStyle}>
            <div style={cardStyle}>
              <p style={{ fontSize: 11, letterSpacing: 4, color: '#66bb6a', marginBottom: 8 }}>SOLVED!</p>
              <p style={{ fontSize: 36, fontWeight: 900, color: '#fff', letterSpacing: 3 }}>YOU WIN!</p>
              <p style={{ fontSize: 13, color: '#90a4ae', margin: '12px 0 4px' }}>
                Moves: <strong style={{ color: '#ffd54f' }}>{moves}</strong> &nbsp; Time: <strong style={{ color: '#4fc3f7' }}>{formatTime(elapsed)}</strong>
              </p>
              <button onClick={startGame} style={btnStyle}>New Game</button>
            </div>
          </div>
        )}
      </div>

      {/* Footer */}
      <div style={{ width: W, background: '#0d0f1a', borderRadius: '0 0 10px 10px', padding: '6px 18px', fontSize: 11, color: '#37474f', letterSpacing: 1.5, display: 'flex', justifyContent: 'space-between', boxSizing: 'border-box' }}>
        <span>Click tile or Arrow Keys to slide</span>
        <span style={{ color: '#263238' }}>Cubeforge Engine</span>
      </div>
    </div>
  )
}

const overlayStyle: React.CSSProperties = { position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'rgba(10,10,18,0.88)', backdropFilter: 'blur(4px)' }
const cardStyle: React.CSSProperties = { textAlign: 'center', fontFamily: '"Courier New",monospace', padding: '36px 48px', background: '#0d0f1a', border: '1px solid #1e2535', borderRadius: 12 }
const btnStyle: React.CSSProperties = { marginTop: 24, padding: '10px 32px', background: '#4fc3f7', color: '#0a0a0f', border: 'none', borderRadius: 6, fontFamily: '"Courier New",monospace', fontSize: 13, fontWeight: 700, letterSpacing: 2, cursor: 'pointer' }
