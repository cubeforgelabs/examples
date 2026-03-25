import { useState } from 'react'
import { Game, World, Camera2D, Entity, Transform, Sprite } from '@cubeforge/react'

// ─── Constants ────────────────────────────────────────────────────────────────
const BOARD = 8
const CELL = 52
const GAP = 2
const TOTAL = BOARD * CELL + (BOARD + 1) * GAP
const W = TOTAL + 40
const H = TOTAL + 40
const OFF_X = 20 + GAP + CELL / 2
const OFF_Y = 20 + GAP + CELL / 2

type Disc = 0 | 1 | 2 // 0=empty 1=black 2=white
type Board = Disc[][]
type GamePhase = 'idle' | 'playing' | 'gameover'

const DIRS = [
  [-1, -1], [-1, 0], [-1, 1],
  [0, -1],           [0, 1],
  [1, -1],  [1, 0],  [1, 1],
]

function makeBoard(): Board {
  const b: Board = Array.from({ length: BOARD }, () => Array(BOARD).fill(0) as Disc[])
  b[3][3] = 2; b[3][4] = 1
  b[4][3] = 1; b[4][4] = 2
  return b
}

function cloneBoard(b: Board): Board {
  return b.map(r => [...r])
}

function getFlips(board: Board, r: number, c: number, player: Disc): [number, number][] {
  if (board[r][c] !== 0) return []
  const opp: Disc = player === 1 ? 2 : 1
  const allFlips: [number, number][] = []
  for (const [dr, dc] of DIRS) {
    const line: [number, number][] = []
    let nr = r + dr, nc = c + dc
    while (nr >= 0 && nr < BOARD && nc >= 0 && nc < BOARD && board[nr][nc] === opp) {
      line.push([nr, nc])
      nr += dr; nc += dc
    }
    if (line.length > 0 && nr >= 0 && nr < BOARD && nc >= 0 && nc < BOARD && board[nr][nc] === player) {
      allFlips.push(...line)
    }
  }
  return allFlips
}

function getValidMoves(board: Board, player: Disc): [number, number][] {
  const moves: [number, number][] = []
  for (let r = 0; r < BOARD; r++) {
    for (let c = 0; c < BOARD; c++) {
      if (getFlips(board, r, c, player).length > 0) moves.push([r, c])
    }
  }
  return moves
}

function applyMove(board: Board, r: number, c: number, player: Disc): Board {
  const nb = cloneBoard(board)
  const flips = getFlips(board, r, c, player)
  nb[r][c] = player
  for (const [fr, fc] of flips) nb[fr][fc] = player
  return nb
}

function countDiscs(board: Board): [number, number] {
  let b = 0, w = 0
  for (let r = 0; r < BOARD; r++) for (let c = 0; c < BOARD; c++) {
    if (board[r][c] === 1) b++
    else if (board[r][c] === 2) w++
  }
  return [b, w]
}

// Simple AI: corners > edges > center, with flip count tiebreaker
const WEIGHT = (() => {
  const w = Array.from({ length: BOARD }, () => Array(BOARD).fill(1))
  // Corners
  w[0][0] = 100; w[0][7] = 100; w[7][0] = 100; w[7][7] = 100
  // Adjacent to corners (bad)
  for (const [r, c] of [[0,1],[1,0],[1,1],[0,6],[1,6],[1,7],[6,0],[6,1],[7,1],[6,6],[6,7],[7,6]]) w[r][c] = -10
  // Edges
  for (let i = 2; i <= 5; i++) { w[0][i] = 10; w[7][i] = 10; w[i][0] = 10; w[i][7] = 10 }
  return w
})()

function aiMove(board: Board): [number, number] | null {
  const moves = getValidMoves(board, 2)
  if (moves.length === 0) return null
  let best = moves[0], bestScore = -Infinity
  for (const [r, c] of moves) {
    const flips = getFlips(board, r, c, 2).length
    const score = WEIGHT[r][c] * 10 + flips
    if (score > bestScore) { bestScore = score; best = [r, c] }
  }
  return best
}

// ─── App ──────────────────────────────────────────────────────────────────────
export function App() {
  const [board, setBoard] = useState<Board>(makeBoard)
  const [turn, setTurn] = useState<Disc>(1) // 1=black(player) 2=white(AI)
  const [phase, setPhase] = useState<GamePhase>('idle')
  const [lastMove, setLastMove] = useState<[number, number] | null>(null)
  const [aiThinking, setAiThinking] = useState(false)

  const validMoves = phase === 'playing' && turn === 1 ? getValidMoves(board, 1) : []
  const [blackCount, whiteCount] = countDiscs(board)

  function startGame() {
    setBoard(makeBoard())
    setTurn(1)
    setPhase('playing')
    setLastMove(null)
    setAiThinking(false)
  }

  function handleCellClick(r: number, c: number) {
    if (phase !== 'playing' || turn !== 1 || aiThinking) return
    if (!validMoves.some(([vr, vc]) => vr === r && vc === c)) return

    const nb = applyMove(board, r, c, 1)
    setBoard(nb)
    setLastMove([r, c])

    // Check if AI can move
    const aiMoves = getValidMoves(nb, 2)
    if (aiMoves.length > 0) {
      setTurn(2)
      setAiThinking(true)
      setTimeout(() => doAiTurn(nb), 400)
    } else {
      // AI can't move, check if player can
      const pMoves = getValidMoves(nb, 1)
      if (pMoves.length === 0) {
        setPhase('gameover')
      }
      // else player goes again, turn stays 1
    }
  }

  function doAiTurn(currentBoard: Board) {
    const move = aiMove(currentBoard)
    if (!move) {
      // AI can't move, check player
      setTurn(1)
      setAiThinking(false)
      if (getValidMoves(currentBoard, 1).length === 0) setPhase('gameover')
      return
    }
    const [r, c] = move
    const nb = applyMove(currentBoard, r, c, 2)
    setBoard(nb)
    setLastMove([r, c])
    setAiThinking(false)

    // Check if player can move
    const pMoves = getValidMoves(nb, 1)
    if (pMoves.length > 0) {
      setTurn(1)
    } else {
      // Player can't move, check AI
      const aMoves = getValidMoves(nb, 2)
      if (aMoves.length > 0) {
        // AI goes again
        setTimeout(() => doAiTurn(nb), 400)
      } else {
        setTurn(1)
        setPhase('gameover')
      }
    }
  }

  function cellX(c: number) { return OFF_X + c * (CELL + GAP) }
  function cellY(r: number) { return OFF_Y + r * (CELL + GAP) }

  const isValid = (r: number, c: number) => validMoves.some(([vr, vc]) => vr === r && vc === c)
  const isLast = (r: number, c: number) => lastMove !== null && lastMove[0] === r && lastMove[1] === c

  const winner = blackCount > whiteCount ? 'Black wins!' : whiteCount > blackCount ? 'White wins!' : 'Draw!'

  return (
    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 0, fontFamily: '"Courier New", monospace' }}>
      {/* HUD */}
      <div style={{ width: W, display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', alignItems: 'center', padding: '7px 18px', background: '#0d0f1a', borderRadius: '10px 10px 0 0', fontSize: 13, color: '#90a4ae', letterSpacing: 1, userSelect: 'none', boxSizing: 'border-box' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
          <span style={{ width: 14, height: 14, borderRadius: '50%', background: '#263238', display: 'inline-block', border: '2px solid #546e7a' }} />
          <span style={{ color: turn === 1 && phase === 'playing' ? '#fff' : '#546e7a', fontWeight: turn === 1 ? 700 : 400 }}>{blackCount}</span>
        </div>
        <div style={{ textAlign: 'center', fontSize: 11, color: '#607d8b', letterSpacing: 2 }}>
          {phase === 'playing' ? (aiThinking ? 'AI THINKING...' : turn === 1 ? 'YOUR TURN' : '') : phase === 'gameover' ? 'GAME OVER' : 'REVERSI'}
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 6, justifyContent: 'flex-end' }}>
          <span style={{ color: turn === 2 && phase === 'playing' ? '#fff' : '#546e7a', fontWeight: turn === 2 ? 700 : 400 }}>{whiteCount}</span>
          <span style={{ width: 14, height: 14, borderRadius: '50%', background: '#eceff1', display: 'inline-block', border: '2px solid #90a4ae' }} />
        </div>
      </div>

      {/* Board */}
      <div style={{ position: 'relative', width: W, height: H }}>
        <Game width={W} height={H} gravity={0}>
          <World background="#1b5e20">
            <Camera2D x={W / 2} y={H / 2} background="#1b5e20" />

            {/* Board background */}
            <Entity tags={['bg']}>
              <Transform x={W / 2} y={H / 2} />
              <Sprite width={TOTAL} height={TOTAL} color="#2e7d32" zIndex={1} />
            </Entity>

            {/* Cells */}
            {Array.from({ length: BOARD }, (_, r) =>
              Array.from({ length: BOARD }, (_, c) => (
                <Entity key={`cell-${r}-${c}`} tags={['cell']}>
                  <Transform x={cellX(c)} y={cellY(r)} />
                  <Sprite
                    width={CELL}
                    height={CELL}
                    color={isLast(r, c) ? '#558b2f' : '#388e3c'}
                    zIndex={2}
                  />
                </Entity>
              ))
            )}

            {/* Valid move hints */}
            {validMoves.map(([r, c]) => (
              <Entity key={`hint-${r}-${c}`} tags={['hint']}>
                <Transform x={cellX(c)} y={cellY(r)} />
                <Sprite width={12} height={12} color="rgba(255,255,255,0.25)" zIndex={3} />
              </Entity>
            ))}

            {/* Discs */}
            {Array.from({ length: BOARD }, (_, r) =>
              Array.from({ length: BOARD }, (_, c) => {
                const d = board[r][c]
                if (d === 0) return null
                return (
                  <Entity key={`disc-${r}-${c}`} tags={['disc']}>
                    <Transform x={cellX(c)} y={cellY(r)} />
                    <Sprite
                      width={CELL - 8}
                      height={CELL - 8}
                      color={d === 1 ? '#263238' : '#eceff1'}
                      zIndex={5}
                    />
                  </Entity>
                )
              })
            )}

            {/* Disc inner highlights */}
            {Array.from({ length: BOARD }, (_, r) =>
              Array.from({ length: BOARD }, (_, c) => {
                const d = board[r][c]
                if (d === 0) return null
                return (
                  <Entity key={`disc-hl-${r}-${c}`} tags={['disc-hl']}>
                    <Transform x={cellX(c) - 4} y={cellY(r) - 4} />
                    <Sprite
                      width={14}
                      height={14}
                      color={d === 1 ? '#37474f' : '#fff'}
                      zIndex={6}
                    />
                  </Entity>
                )
              })
            )}
          </World>
        </Game>

        {/* Click overlay grid */}
        <div style={{ position: 'absolute', inset: 0 }}>
          {Array.from({ length: BOARD }, (_, r) =>
            Array.from({ length: BOARD }, (_, c) => (
              <div
                key={`click-${r}-${c}`}
                onClick={() => handleCellClick(r, c)}
                style={{
                  position: 'absolute',
                  left: cellX(c) - CELL / 2 + 0,
                  top: cellY(r) - CELL / 2 + 0,
                  width: CELL,
                  height: CELL,
                  cursor: isValid(r, c) ? 'pointer' : 'default',
                }}
              />
            ))
          )}
        </div>

        {/* Idle overlay */}
        {phase === 'idle' && (
          <div style={overlayStyle}>
            <div style={cardStyle}>
              <p style={{ fontSize: 11, letterSpacing: 4, color: '#66bb6a', marginBottom: 8 }}>CUBEFORGE</p>
              <p style={{ fontSize: 40, fontWeight: 900, color: '#fff', letterSpacing: 4 }}>REVERSI</p>
              <p style={{ fontSize: 12, color: '#546e7a', marginTop: 16 }}>Outflank your opponent on the 8×8 board</p>
              <p style={{ fontSize: 12, color: '#607d8b', marginTop: 6 }}>You are <strong style={{ color: '#90a4ae' }}>Black</strong> — AI is White</p>
              <button onClick={startGame} style={btnStyle}>Play</button>
            </div>
          </div>
        )}

        {/* Game over overlay */}
        {phase === 'gameover' && (
          <div style={overlayStyle}>
            <div style={cardStyle}>
              <p style={{ fontSize: 11, letterSpacing: 4, color: blackCount > whiteCount ? '#66bb6a' : '#ef5350', marginBottom: 8 }}>
                {blackCount > whiteCount ? 'VICTORY' : whiteCount > blackCount ? 'DEFEAT' : 'TIE GAME'}
              </p>
              <p style={{ fontSize: 36, fontWeight: 900, color: '#fff', letterSpacing: 3 }}>{winner}</p>
              <p style={{ fontSize: 13, color: '#90a4ae', margin: '12px 0 4px' }}>
                Black <strong style={{ color: '#fff' }}>{blackCount}</strong> — White <strong style={{ color: '#fff' }}>{whiteCount}</strong>
              </p>
              <button onClick={startGame} style={btnStyle}>Play Again</button>
            </div>
          </div>
        )}
      </div>

      {/* Footer */}
      <div style={{ width: W, background: '#0d0f1a', borderRadius: '0 0 10px 10px', padding: '6px 18px', fontSize: 11, color: '#37474f', letterSpacing: 1.5, display: 'flex', justifyContent: 'space-between', boxSizing: 'border-box' }}>
        <span>Click valid cell to place disc</span>
        <span style={{ color: '#263238' }}>Cubeforge Engine</span>
      </div>
    </div>
  )
}

const overlayStyle: React.CSSProperties = { position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'rgba(10,10,18,0.88)', backdropFilter: 'blur(4px)' }
const cardStyle: React.CSSProperties = { textAlign: 'center', fontFamily: '"Courier New",monospace', padding: '36px 48px', background: '#0d0f1a', border: '1px solid #1e2535', borderRadius: 12 }
const btnStyle: React.CSSProperties = { marginTop: 24, padding: '10px 32px', background: '#66bb6a', color: '#0a0a0f', border: 'none', borderRadius: 6, fontFamily: '"Courier New",monospace', fontSize: 13, fontWeight: 700, letterSpacing: 2, cursor: 'pointer' }
