import { useState, useCallback, useMemo } from 'react'

/* ------------------------------------------------------------------ */
/*  Types                                                              */
/* ------------------------------------------------------------------ */

type Player = 'red' | 'white'

interface Piece {
  player: Player
  isKing: boolean
}

type Cell = Piece | null
type Board = Cell[][]

interface Move {
  toR: number
  toC: number
  captured: { r: number; c: number }[]       // pieces jumped over
  intermediate: { r: number; c: number }[]    // landing squares in multi-jump
}

/* ------------------------------------------------------------------ */
/*  Constants                                                          */
/* ------------------------------------------------------------------ */

const BOARD_SIZE = 8
const SQUARE = 56
const BOARD_PX = SQUARE * BOARD_SIZE         // 448
const BORDER = 16
const TOTAL_BOARD = BOARD_PX + BORDER * 2    // 480

const COLOR_LIGHT_SQ  = '#455a64'
const COLOR_DARK_SQ   = '#1e2535'
const COLOR_BORDER    = '#0d1117'
const COLOR_RED       = '#ef5350'
const COLOR_WHITE     = '#e0e0e0'
const COLOR_SELECTED  = 'rgba(255,235,59,0.45)'
const COLOR_VALID_DOT = 'rgba(255,235,59,0.6)'
const COLOR_KING_MARK = '#ffd54f'

/* ------------------------------------------------------------------ */
/*  Board helpers                                                      */
/* ------------------------------------------------------------------ */

function createInitialBoard(): Board {
  const board: Board = Array.from({ length: 8 }, () => Array<Cell>(8).fill(null))
  for (let r = 0; r < 3; r++) {
    for (let c = 0; c < 8; c++) {
      if ((r + c) % 2 === 1) board[r][c] = { player: 'white', isKing: false }
    }
  }
  for (let r = 5; r < 8; r++) {
    for (let c = 0; c < 8; c++) {
      if ((r + c) % 2 === 1) board[r][c] = { player: 'red', isKing: false }
    }
  }
  return board
}

function cloneBoard(b: Board): Board {
  return b.map(row => row.map(cell => (cell ? { ...cell } : null)))
}

function inBounds(r: number, c: number) {
  return r >= 0 && r < BOARD_SIZE && c >= 0 && c < BOARD_SIZE
}

function opponent(p: Player): Player {
  return p === 'red' ? 'white' : 'red'
}

/* ------------------------------------------------------------------ */
/*  Move generation                                                    */
/* ------------------------------------------------------------------ */

/** Directions a piece can move */
function dirs(piece: Piece): [number, number][] {
  if (piece.isKing) return [[-1, -1], [-1, 1], [1, -1], [1, 1]]
  return piece.player === 'red'
    ? [[-1, -1], [-1, 1]]   // red moves up
    : [[1, -1], [1, 1]]     // white moves down
}

/** Find captures available from (r,c) on the given board, building multi-jump chains */
function findCaptures(
  board: Board,
  r: number,
  c: number,
  piece: Piece,
  alreadyCaptured: Set<string>,
): Move[] {
  const results: Move[] = []

  for (const [dr, dc] of dirs(piece)) {
    const mr = r + dr
    const mc = c + dc
    const lr = r + 2 * dr
    const lc = c + 2 * dc
    if (!inBounds(lr, lc)) continue
    const mid = board[mr][mc]
    if (!mid || mid.player === piece.player) continue
    if (board[lr][lc] !== null) continue
    const key = `${mr},${mc}`
    if (alreadyCaptured.has(key)) continue

    // Simulate the jump and recurse for multi-jump
    const nextCaptured = new Set(alreadyCaptured)
    nextCaptured.add(key)

    const tempBoard = cloneBoard(board)
    tempBoard[r][c] = null
    tempBoard[mr][mc] = null
    tempBoard[lr][lc] = piece

    // Possibly promote to king mid-chain
    const promoted =
      (piece.player === 'red' && lr === 0) ||
      (piece.player === 'white' && lr === 7)
    const landPiece = promoted ? { ...piece, isKing: true } : piece
    tempBoard[lr][lc] = landPiece

    const further = findCaptures(tempBoard, lr, lc, landPiece, nextCaptured)

    if (further.length === 0) {
      results.push({ toR: lr, toC: lc, captured: [{ r: mr, c: mc }], intermediate: [] })
    } else {
      for (const f of further) {
        results.push({
          toR: f.toR,
          toC: f.toC,
          captured: [{ r: mr, c: mc }, ...f.captured],
          intermediate: [{ r: lr, c: lc }, ...f.intermediate],
        })
      }
    }
  }
  return results
}

/** All valid moves for a given piece at (r,c) */
function getMovesForPiece(board: Board, r: number, c: number): Move[] {
  const piece = board[r][c]
  if (!piece) return []

  const captures = findCaptures(board, r, c, piece, new Set())
  if (captures.length > 0) return captures

  // Simple moves (only if no captures exist for this piece — enforced at turn level too)
  const simple: Move[] = []
  for (const [dr, dc] of dirs(piece)) {
    const nr = r + dr
    const nc = c + dc
    if (inBounds(nr, nc) && board[nr][nc] === null) {
      simple.push({ toR: nr, toC: nc, captured: [], intermediate: [] })
    }
  }
  return simple
}

/** Does the given player have any capture available on the board? */
function playerHasCapture(board: Board, player: Player): boolean {
  for (let r = 0; r < BOARD_SIZE; r++) {
    for (let c = 0; c < BOARD_SIZE; c++) {
      const p = board[r][c]
      if (p && p.player === player) {
        if (findCaptures(board, r, c, p, new Set()).length > 0) return true
      }
    }
  }
  return false
}

/** Get valid moves respecting mandatory capture rule */
function getValidMoves(board: Board, r: number, c: number, turn: Player): Move[] {
  const piece = board[r][c]
  if (!piece || piece.player !== turn) return []

  const mustCapture = playerHasCapture(board, turn)
  const moves = getMovesForPiece(board, r, c)

  if (mustCapture) return moves.filter(m => m.captured.length > 0)
  return moves
}

/** Does the player have any legal move? */
function playerHasAnyMove(board: Board, player: Player): boolean {
  for (let r = 0; r < BOARD_SIZE; r++) {
    for (let c = 0; c < BOARD_SIZE; c++) {
      if (getValidMoves(board, r, c, player).length > 0) return true
    }
  }
  return false
}

/** Count pieces */
function countPieces(board: Board, player: Player): number {
  let n = 0
  for (const row of board) for (const cell of row) if (cell?.player === player) n++
  return n
}

/* ------------------------------------------------------------------ */
/*  React component                                                    */
/* ------------------------------------------------------------------ */

export function App() {
  const [board, setBoard] = useState<Board>(createInitialBoard)
  const [turn, setTurn] = useState<Player>('red')
  const [selected, setSelected] = useState<{ r: number; c: number } | null>(null)
  const [winner, setWinner] = useState<Player | null>(null)

  // Compute valid moves for the selected piece
  const validMoves = useMemo<Move[]>(() => {
    if (!selected) return []
    return getValidMoves(board, selected.r, selected.c, turn)
  }, [board, selected, turn])

  // Set of "toR,toC" for quick lookup
  const validTargets = useMemo(() => {
    const s = new Set<string>()
    for (const m of validMoves) s.add(`${m.toR},${m.toC}`)
    return s
  }, [validMoves])

  const redCount = useMemo(() => countPieces(board, 'red'), [board])
  const whiteCount = useMemo(() => countPieces(board, 'white'), [board])

  const reset = useCallback(() => {
    setBoard(createInitialBoard())
    setTurn('red')
    setSelected(null)
    setWinner(null)
  }, [])

  const handleClick = useCallback(
    (r: number, c: number) => {
      if (winner) return

      const clickedPiece = board[r][c]

      // If nothing is selected yet, select own piece
      if (!selected) {
        if (clickedPiece && clickedPiece.player === turn) {
          const moves = getValidMoves(board, r, c, turn)
          if (moves.length > 0) setSelected({ r, c })
        }
        return
      }

      // Clicking the already-selected piece deselects
      if (selected.r === r && selected.c === c) {
        setSelected(null)
        return
      }

      // Clicking another own piece re-selects it (if it has moves)
      if (clickedPiece && clickedPiece.player === turn) {
        const moves = getValidMoves(board, r, c, turn)
        if (moves.length > 0) {
          setSelected({ r, c })
          return
        }
      }

      // Attempt to move to (r,c)
      const move = validMoves.find(m => m.toR === r && m.toC === c)
      if (!move) return

      const newBoard = cloneBoard(board)
      const piece = { ...newBoard[selected.r][selected.c]! }
      newBoard[selected.r][selected.c] = null

      // Remove captured pieces
      for (const cap of move.captured) {
        newBoard[cap.r][cap.c] = null
      }

      // Promote to king
      if ((piece.player === 'red' && r === 0) || (piece.player === 'white' && r === 7)) {
        piece.isKing = true
      }

      newBoard[r][c] = piece
      setBoard(newBoard)
      setSelected(null)

      // Check win
      const opp = opponent(turn)
      const oppCount = countPieces(newBoard, opp)
      if (oppCount === 0 || !playerHasAnyMove(newBoard, opp)) {
        setWinner(turn)
      } else {
        setTurn(opp)
      }
    },
    [board, turn, selected, validMoves, winner],
  )

  return (
    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 12 }}>
      {/* Header */}
      <h2 style={{ color: '#90a4ae', fontSize: 20, letterSpacing: 2 }}>CHECKERS</h2>

      {/* Status bar */}
      <div
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          width: TOTAL_BOARD,
          fontSize: 14,
        }}
      >
        <span>
          <span style={{ color: COLOR_RED }}>Red: {redCount}</span>
        </span>
        {winner ? (
          <span style={{ color: COLOR_KING_MARK, fontWeight: 'bold' }}>
            {winner === 'red' ? 'Red' : 'White'} wins!
          </span>
        ) : (
          <span style={{ color: turn === 'red' ? COLOR_RED : COLOR_WHITE }}>
            {turn === 'red' ? 'Red' : 'White'}&apos;s turn
          </span>
        )}
        <span>
          <span style={{ color: COLOR_WHITE }}>White: {whiteCount}</span>
        </span>
      </div>

      {/* Board */}
      <div
        style={{
          background: COLOR_BORDER,
          padding: BORDER,
          borderRadius: 6,
          boxShadow: '0 4px 24px rgba(0,0,0,0.5)',
        }}
      >
        <div
          style={{
            display: 'grid',
            gridTemplateColumns: `repeat(${BOARD_SIZE}, ${SQUARE}px)`,
            gridTemplateRows: `repeat(${BOARD_SIZE}, ${SQUARE}px)`,
          }}
        >
          {board.map((row, r) =>
            row.map((cell, c) => {
              const isDark = (r + c) % 2 === 1
              const isSelected = selected?.r === r && selected?.c === c
              const isValidTarget = validTargets.has(`${r},${c}`)

              return (
                <div
                  key={`${r}-${c}`}
                  onClick={() => isDark ? handleClick(r, c) : undefined}
                  style={{
                    width: SQUARE,
                    height: SQUARE,
                    background: isSelected
                      ? COLOR_SELECTED
                      : isDark
                        ? COLOR_DARK_SQ
                        : COLOR_LIGHT_SQ,
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    cursor: isDark ? 'pointer' : 'default',
                    position: 'relative',
                  }}
                >
                  {/* Valid move dot */}
                  {isValidTarget && !cell && (
                    <div
                      style={{
                        width: 14,
                        height: 14,
                        borderRadius: '50%',
                        background: COLOR_VALID_DOT,
                        position: 'absolute',
                      }}
                    />
                  )}

                  {/* Piece */}
                  {cell && (
                    <div
                      style={{
                        width: 40,
                        height: 40,
                        borderRadius: '50%',
                        background: cell.player === 'red' ? COLOR_RED : COLOR_WHITE,
                        boxShadow: isSelected
                          ? `0 0 12px 4px ${COLOR_KING_MARK}`
                          : '0 2px 6px rgba(0,0,0,0.5)',
                        border: `2px solid ${
                          cell.player === 'red' ? '#c62828' : '#bdbdbd'
                        }`,
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        transition: 'box-shadow 0.15s',
                        position: 'relative',
                        zIndex: 1,
                      }}
                    >
                      {/* King marker — inner circle */}
                      {cell.isKing && (
                        <div
                          style={{
                            width: 20,
                            height: 20,
                            borderRadius: '50%',
                            border: `2px solid ${COLOR_KING_MARK}`,
                            background: 'transparent',
                          }}
                        />
                      )}

                      {/* Capture-target ring */}
                      {isValidTarget && (
                        <div
                          style={{
                            position: 'absolute',
                            inset: -4,
                            borderRadius: '50%',
                            border: `3px solid ${COLOR_VALID_DOT}`,
                            pointerEvents: 'none',
                          }}
                        />
                      )}
                    </div>
                  )}
                </div>
              )
            }),
          )}
        </div>
      </div>

      {/* Reset button */}
      <button
        onClick={reset}
        style={{
          marginTop: 4,
          padding: '8px 28px',
          fontSize: 14,
          fontFamily: 'inherit',
          background: '#1e2535',
          color: '#90a4ae',
          border: '1px solid #37474f',
          borderRadius: 4,
          cursor: 'pointer',
          letterSpacing: 1,
        }}
      >
        RESET
      </button>
    </div>
  )
}
