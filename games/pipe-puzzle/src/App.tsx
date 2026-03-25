import { useState, useCallback, useEffect } from 'react'
import { Game, World, Camera2D, Entity, Transform, Sprite, Text } from '@cubeforge/react'

// ─── Constants ────────────────────────────────────────────────────────────────
const W = 520
const H = 520

// ─── Types ────────────────────────────────────────────────────────────────────
// Pipe connections represented as bitmask: bit0=up, bit1=right, bit2=down, bit3=left
// STRAIGHT_H: right+left = 0b1010 = 10
// STRAIGHT_V: up+down    = 0b0101 = 5
// ELBOW_RD:   right+down = 0b0110 = 6
// ELBOW_DL:   down+left  = 0b1100 = 12
// ELBOW_LU:   left+up    = 0b1001 = 9
// ELBOW_UR:   up+right   = 0b0011 = 3
// T_UDR:      up+down+right = 0b0111 = 7
// T_LRD:      left+right+down = 0b1110 = 14
// T_UDL:      up+down+left  = 0b1101 = 13
// T_URL:      up+right+left = 0b1011 = 11
// CROSS:      all = 0b1111 = 15

const UP    = 1
const RIGHT = 2
const DOWN  = 4
const LEFT  = 8

type PipeType = 'straight' | 'elbow' | 'tee' | 'cross'

interface Tile {
  type: PipeType
  rotation: number   // 0,1,2,3 — each step = 90° CW
  isSource: boolean
  isDest: boolean
}

// Base connections for each type at rotation 0
const BASE_CONNECTIONS: Record<PipeType, number> = {
  straight: RIGHT | LEFT,    // horizontal
  elbow:    RIGHT | DOWN,    // goes right and down
  tee:      RIGHT | DOWN | LEFT,  // T pointing up
  cross:    UP | RIGHT | DOWN | LEFT,
}

function rotateMask(mask: number, times: number): number {
  let m = mask
  for (let i = 0; i < times; i++) {
    // rotate CW: up->right->down->left->up
    const newM =
      ((m & UP)    ? RIGHT : 0) |
      ((m & RIGHT) ? DOWN  : 0) |
      ((m & DOWN)  ? LEFT  : 0) |
      ((m & LEFT)  ? UP    : 0)
    m = newM
  }
  return m
}

function tileConnections(tile: Tile): number {
  return rotateMask(BASE_CONNECTIONS[tile.type], tile.rotation)
}

// ─── Level definitions ────────────────────────────────────────────────────────
interface Level {
  gridSize: number
  // grid of [type, rotation] — will build board from this
  layout: [PipeType, number][][]
  sourceRow: number   // row index on left edge
  destRow: number     // row index on right edge
}

function makeLevel(gridSize: number, layout: [PipeType, number][][], srcRow: number, dstRow: number): Level {
  return { gridSize, layout, sourceRow: srcRow, destRow: dstRow }
}

// A few hand-crafted levels (7x7)
const LEVELS: Level[] = [
  // Level 1: simple path, easy 7x7
  makeLevel(7, [
    [['straight',0],['elbow',0],   ['straight',0],['straight',0],['straight',0],['elbow',1],  ['straight',0]],
    [['straight',1],['straight',1],['elbow',3],   ['elbow',0],   ['elbow',3],   ['straight',1],['straight',1]],
    [['elbow',2],  ['elbow',1],   ['elbow',2],   ['straight',1],['elbow',1],   ['elbow',2],   ['elbow',3]],
    [['straight',0],['straight',0],['straight',0],['elbow',2],   ['straight',0],['straight',0],['straight',0]],
    [['elbow',3],  ['elbow',2],   ['elbow',1],   ['straight',1],['elbow',2],   ['elbow',3],   ['elbow',2]],
    [['straight',1],['straight',1],['elbow',0],   ['elbow',3],   ['elbow',0],   ['straight',1],['straight',1]],
    [['straight',0],['elbow',3],  ['straight',0],['straight',0],['straight',0],['elbow',2],   ['straight',0]],
  ], 3, 3),

  // Level 2: 7x7 with T junctions
  makeLevel(7, [
    [['tee',1],    ['straight',0],['tee',0],   ['straight',0],['tee',0],   ['straight',0],['tee',3]],
    [['straight',1],['elbow',0],  ['tee',1],   ['elbow',1],   ['tee',3],   ['elbow',0],   ['straight',1]],
    [['tee',0],    ['tee',1],     ['cross',0],  ['tee',1],     ['cross',0],  ['tee',3],     ['tee',2]],
    [['straight',1],['straight',1],['tee',1],  ['straight',1],['tee',3],   ['straight',1],['straight',1]],
    [['tee',0],    ['tee',1],     ['cross',0],  ['tee',1],     ['cross',0],  ['tee',3],     ['tee',2]],
    [['straight',1],['elbow',3],  ['tee',3],   ['elbow',2],   ['tee',1],   ['elbow',2],   ['straight',1]],
    [['tee',1],    ['straight',0],['tee',2],   ['straight',0],['tee',2],   ['straight',0],['tee',3]],
  ], 3, 3),

  // Level 3: 9x9 harder
  makeLevel(9, [
    [['elbow',0],  ['straight',0],['straight',0],['elbow',1],   ['straight',0],['straight',0],['elbow',1],   ['straight',0],['elbow',1]],
    [['straight',1],['elbow',0],  ['elbow',1],   ['straight',1],['elbow',0],   ['elbow',1],   ['straight',1],['elbow',0],   ['straight',1]],
    [['elbow',2],  ['tee',1],     ['cross',0],   ['tee',3],     ['tee',1],     ['cross',0],   ['tee',3],     ['tee',1],     ['elbow',3]],
    [['straight',0],['tee',0],    ['tee',1],     ['tee',2],     ['straight',0],['tee',0],     ['tee',3],     ['tee',2],     ['straight',0]],
    [['elbow',0],  ['tee',3],     ['cross',0],   ['tee',1],     ['cross',0],   ['tee',3],     ['cross',0],   ['tee',1],     ['elbow',1]],
    [['straight',0],['tee',0],    ['tee',1],     ['tee',2],     ['straight',0],['tee',0],     ['tee',3],     ['tee',2],     ['straight',0]],
    [['elbow',3],  ['tee',1],     ['cross',0],   ['tee',3],     ['tee',1],     ['cross',0],   ['tee',3],     ['tee',1],     ['elbow',2]],
    [['straight',1],['elbow',3],  ['elbow',2],   ['straight',1],['elbow',3],   ['elbow',2],   ['straight',1],['elbow',3],   ['straight',1]],
    [['elbow',3],  ['straight',0],['straight',0],['elbow',2],   ['straight',0],['straight',0],['elbow',2],   ['straight',0],['elbow',2]],
  ], 4, 4),

  // Level 4: 9x9 with more variety
  makeLevel(9, [
    [['elbow',0],  ['straight',0],['elbow',1],   ['straight',0],['elbow',1],   ['straight',0],['elbow',1],   ['straight',0],['elbow',1]],
    [['straight',1],['tee',0],    ['tee',1],     ['tee',2],     ['tee',3],     ['tee',0],     ['tee',1],     ['tee',2],     ['straight',1]],
    [['elbow',2],  ['tee',3],     ['cross',0],   ['tee',1],     ['cross',0],   ['tee',3],     ['cross',0],   ['tee',1],     ['elbow',3]],
    [['straight',0],['tee',2],    ['tee',3],     ['tee',0],     ['straight',0],['tee',2],     ['tee',3],     ['tee',0],     ['straight',0]],
    [['tee',1],    ['cross',0],   ['tee',3],     ['tee',1],     ['cross',0],   ['tee',3],     ['tee',1],     ['cross',0],   ['tee',3]],
    [['straight',0],['tee',0],    ['tee',1],     ['tee',2],     ['straight',0],['tee',0],     ['tee',1],     ['tee',2],     ['straight',0]],
    [['elbow',3],  ['tee',1],     ['cross',0],   ['tee',3],     ['cross',0],   ['tee',1],     ['cross',0],   ['tee',3],     ['elbow',2]],
    [['straight',1],['tee',2],    ['tee',3],     ['tee',0],     ['tee',1],     ['tee',2],     ['tee',3],     ['tee',0],     ['straight',1]],
    [['elbow',3],  ['straight',0],['elbow',2],   ['straight',0],['elbow',2],   ['straight',0],['elbow',2],   ['straight',0],['elbow',2]],
  ], 4, 4),
]

// ─── Helpers ─────────────────────────────────────────────────────────────────
function buildBoard(level: Level): Tile[][] {
  const gs = level.gridSize
  // Scramble rotations randomly (but keep cross and source/dest fixed)
  const board: Tile[][] = Array.from({ length: gs }, (_, r) =>
    Array.from({ length: gs }, (_, c) => {
      const [type, baseRot] = level.layout[r][c]
      const isSource = c === 0 && r === level.sourceRow
      const isDest   = c === gs - 1 && r === level.destRow
      if (isSource || isDest) return { type, rotation: baseRot, isSource, isDest }
      if (type === 'cross') return { type, rotation: 0, isSource, isDest }
      // Random scramble
      const rot = Math.floor(Math.random() * 4)
      return { type, rotation: rot, isSource, isDest }
    })
  )
  return board
}

// Trace connected path from source
function tracePath(board: Tile[][], srcRow: number, dstRow: number, gs: number): Set<string> {
  const connected = new Set<string>()
  const queue: [number, number, number][] = []  // [row, col, fromDir]
  // Source is at col=0, srcRow, opens to the right
  const srcTile = board[srcRow][0]
  const srcConn = tileConnections(srcTile)
  if (srcConn & RIGHT) {
    queue.push([srcRow, 0, 0])  // fromDir=0 means we came from nowhere
  }

  const dirOpposite: Record<number, number> = { [UP]: DOWN, [DOWN]: UP, [LEFT]: RIGHT, [RIGHT]: LEFT }
  const dirDelta: Record<number, [number, number]> = {
    [UP]: [-1, 0], [RIGHT]: [0, 1], [DOWN]: [1, 0], [LEFT]: [0, -1],
  }

  while (queue.length) {
    const [r, c, fromDir] = queue.shift()!
    const key = `${r},${c}`
    if (connected.has(key)) continue
    connected.add(key)

    const conn = tileConnections(board[r][c])
    for (const dir of [UP, RIGHT, DOWN, LEFT]) {
      if (dir === fromDir) continue   // don't go back
      if (!(conn & dir)) continue     // not connected in this direction
      const [dr, dc] = dirDelta[dir]
      const nr = r + dr
      const nc = c + dc
      if (nr < 0 || nr >= gs || nc < 0 || nc >= gs) continue
      const neighborConn = tileConnections(board[nr][nc])
      if (neighborConn & dirOpposite[dir]) {
        queue.push([nr, nc, dirOpposite[dir]])
      }
    }
  }
  return connected
}

function isConnected(board: Tile[][], srcRow: number, dstRow: number, gs: number): boolean {
  const path = tracePath(board, srcRow, dstRow, gs)
  return path.has(`${dstRow},${gs - 1}`)
}

// ─── Draw pipe segment lines as Sprite bars ───────────────────────────────────
// We'll draw each pipe as: a center dot + arms for each connection
function pipeArms(connections: number): Array<{ dx: number; dy: number; w: number; h: number }> {
  const arms = []
  if (connections & UP)    arms.push({ dx: 0, dy: -0.25, w: 0.18, h: 0.5 })
  if (connections & DOWN)  arms.push({ dx: 0, dy:  0.25, w: 0.18, h: 0.5 })
  if (connections & LEFT)  arms.push({ dx: -0.25, dy: 0, w: 0.5, h: 0.18 })
  if (connections & RIGHT) arms.push({ dx:  0.25, dy: 0, w: 0.5, h: 0.18 })
  return arms
}

// ─── App ─────────────────────────────────────────────────────────────────────
export function App() {
  const [levelIdx, setLevelIdx] = useState(0)
  const [board, setBoard]       = useState<Tile[][]>(() => buildBoard(LEVELS[0]))
  const [moves, setMoves]       = useState(0)
  const [solved, setSolved]     = useState(false)
  const [gameKey, setGameKey]   = useState(0)

  const level = LEVELS[levelIdx]
  const gs    = level.gridSize

  // Compute cell size to fit the board
  const padding = 40
  const cellSize = Math.floor((Math.min(W, H) - padding * 2) / gs)
  const boardPx  = cellSize * gs
  const boardOffX = (W - boardPx) / 2
  const boardOffY = (H - boardPx) / 2

  const cx = (c: number) => boardOffX + c * cellSize + cellSize / 2
  const cy = (r: number) => boardOffY + r * cellSize + cellSize / 2

  // Check solved after each click
  const checkSolved = useCallback((b: Tile[][]) => {
    if (isConnected(b, level.sourceRow, level.destRow, gs)) {
      setSolved(true)
    }
  }, [level, gs])

  const handleTileClick = useCallback((r: number, c: number) => {
    if (solved) return
    const tile = board[r][c]
    if (tile.isSource || tile.isDest || tile.type === 'cross') return
    setBoard(prev => {
      const nb = prev.map(row => row.map(t => ({ ...t })))
      nb[r][c] = { ...nb[r][c], rotation: (nb[r][c].rotation + 1) % 4 }
      checkSolved(nb)
      return nb
    })
    setMoves(m => m + 1)
  }, [board, solved, checkSolved])

  function loadLevel(idx: number) {
    setLevelIdx(idx)
    setBoard(buildBoard(LEVELS[idx]))
    setMoves(0)
    setSolved(false)
    setGameKey(k => k + 1)
  }

  function nextLevel() {
    const next = (levelIdx + 1) % LEVELS.length
    loadLevel(next)
  }

  function restart() {
    loadLevel(levelIdx)
  }

  // Compute path for highlighting
  const path = tracePath(board, level.sourceRow, level.destRow, gs)
  const isSolvedPath = isConnected(board, level.sourceRow, level.destRow, gs)

  // Build render entities
  type RenderEntity = {
    key: string
    x: number; y: number
    w: number; h: number
    color: string
    zIndex: number
    onClick?: () => void
  }

  const entities: RenderEntity[] = []

  // Board background
  entities.push({ key: 'bg', x: W / 2, y: H / 2, w: W, h: H, color: '#0d1117', zIndex: 0 })

  // Cell backgrounds and pipe rendering
  for (let r = 0; r < gs; r++) {
    for (let c = 0; c < gs; c++) {
      const tile = board[r][c]
      const x = cx(c)
      const y = cy(r)
      const inPath = path.has(`${r},${c}`)
      const pipeColor = inPath
        ? (isSolvedPath ? '#26c6da' : '#00bcd4')
        : (tile.isSource ? '#69f0ae' : tile.isDest ? '#ff7043' : '#546e7a')
      const bgColor = tile.isSource ? '#0a2018' : tile.isDest ? '#200a08' : '#0d1520'

      // Cell bg
      entities.push({ key: `bg${r}-${c}`, x, y, w: cellSize - 2, h: cellSize - 2, color: bgColor, zIndex: 1 })

      // Pipe arms
      const conn = tileConnections(tile)
      const arms = pipeArms(conn)
      for (let i = 0; i < arms.length; i++) {
        const a = arms[i]
        entities.push({
          key: `arm${r}-${c}-${i}`,
          x: x + a.dx * cellSize,
          y: y + a.dy * cellSize,
          w: a.w * cellSize,
          h: a.h * cellSize,
          color: pipeColor,
          zIndex: 3,
        })
      }

      // Center hub
      const hubSize = cellSize * 0.22
      entities.push({ key: `hub${r}-${c}`, x, y, w: hubSize, h: hubSize, color: pipeColor, zIndex: 4 })
    }
  }

  // Grid lines
  for (let i = 0; i <= gs; i++) {
    // vertical
    entities.push({ key: `gv${i}`, x: boardOffX + i * cellSize, y: boardOffY + boardPx / 2, w: 1, h: boardPx, color: '#151d2a', zIndex: 2 })
    // horizontal
    entities.push({ key: `gh${i}`, x: boardOffX + boardPx / 2, y: boardOffY + i * cellSize, w: boardPx, h: 1, color: '#151d2a', zIndex: 2 })
  }

  // Board border
  entities.push({ key: 'border-l', x: boardOffX - 1, y: boardOffY + boardPx / 2, w: 2, h: boardPx + 2, color: '#1e2d40', zIndex: 5 })
  entities.push({ key: 'border-r', x: boardOffX + boardPx + 1, y: boardOffY + boardPx / 2, w: 2, h: boardPx + 2, color: '#1e2d40', zIndex: 5 })
  entities.push({ key: 'border-t', x: boardOffX + boardPx / 2, y: boardOffY - 1, w: boardPx + 4, h: 2, color: '#1e2d40', zIndex: 5 })
  entities.push({ key: 'border-b', x: boardOffX + boardPx / 2, y: boardOffY + boardPx + 1, w: boardPx + 4, h: 2, color: '#1e2d40', zIndex: 5 })

  // Source notch (opening on left)
  const srcY = boardOffY + level.sourceRow * cellSize + cellSize / 2
  entities.push({ key: 'src', x: boardOffX - cellSize * 0.3, y: srcY, w: cellSize * 0.5, h: cellSize * 0.22, color: '#69f0ae', zIndex: 6 })
  // Dest notch (opening on right)
  const dstY = boardOffY + level.destRow * cellSize + cellSize / 2
  entities.push({ key: 'dst', x: boardOffX + boardPx + cellSize * 0.3, y: dstY, w: cellSize * 0.5, h: cellSize * 0.22, color: '#ff7043', zIndex: 6 })

  return (
    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
      {/* HUD */}
      <div style={{
        width: W, display: 'flex', justifyContent: 'space-between', alignItems: 'center',
        padding: '6px 18px', background: '#0d0f1a', borderRadius: '10px 10px 0 0',
        fontSize: 13, color: '#90a4ae', letterSpacing: 1, userSelect: 'none',
      }}>
        <span style={{ color: '#607d8b', fontSize: 11 }}>LEVEL {levelIdx + 1}/{LEVELS.length}</span>
        <span style={{ color: '#4fc3f7', fontWeight: 700, fontSize: 16 }}>PIPE CONNECT</span>
        <span style={{ color: '#607d8b', fontSize: 11 }}>MOVES {moves}</span>
      </div>

      {/* Canvas */}
      <div style={{ position: 'relative', width: W, height: H }}>
        <Game key={gameKey} width={W} height={H} gravity={0}>
          <World background="#0d1117">
            <Camera2D x={W / 2} y={H / 2} background="#0d1117" />

            {entities.map(e => (
              <Entity key={e.key} tags={['tile']}>
                <Transform x={e.x} y={e.y} />
                <Sprite width={e.w} height={e.h} color={e.color} zIndex={e.zIndex} />
              </Entity>
            ))}

            {/* Source / Dest labels */}
            <Entity tags={['ui']}>
              <Transform x={boardOffX - cellSize * 0.7} y={srcY} />
              <Text text="IN" fontSize={10} color="#69f0ae" align="center" baseline="middle" zIndex={8} />
            </Entity>
            <Entity tags={['ui']}>
              <Transform x={boardOffX + boardPx + cellSize * 0.7} y={dstY} />
              <Text text="OUT" fontSize={10} color="#ff7043" align="center" baseline="middle" zIndex={8} />
            </Entity>

            {/* Solved banner */}
            {solved && (
              <>
                <Entity tags={['win']}>
                  <Transform x={W / 2} y={H / 2 - 20} />
                  <Sprite width={220} height={80} color="#0a1a12" zIndex={20} />
                </Entity>
                <Entity tags={['win']}>
                  <Transform x={W / 2} y={H / 2 - 28} />
                  <Text text="CONNECTED!" fontSize={22} color="#26c6da" align="center" baseline="middle" zIndex={21} />
                </Entity>
                <Entity tags={['win']}>
                  <Transform x={W / 2} y={H / 2 + 2} />
                  <Text text={`${moves} moves`} fontSize={13} color="#90a4ae" align="center" baseline="middle" zIndex={21} />
                </Entity>
              </>
            )}
          </World>
        </Game>

        {/* Click overlay for tiles */}
        <div style={{
          position: 'absolute',
          left: boardOffX, top: boardOffY,
          width: boardPx, height: boardPx,
          display: 'grid',
          gridTemplateColumns: `repeat(${gs}, ${cellSize}px)`,
          gridTemplateRows: `repeat(${gs}, ${cellSize}px)`,
        }}>
          {Array.from({ length: gs }, (_, r) =>
            Array.from({ length: gs }, (_, c) => {
              const tile = board[r][c]
              const canRotate = !tile.isSource && !tile.isDest && tile.type !== 'cross'
              return (
                <div
                  key={`click${r}-${c}`}
                  onClick={() => handleTileClick(r, c)}
                  style={{
                    width: cellSize, height: cellSize,
                    cursor: canRotate && !solved ? 'pointer' : 'default',
                    boxSizing: 'border-box',
                  }}
                />
              )
            })
          )}
        </div>

        {/* Solved overlay with next level button */}
        {solved && (
          <div style={{
            position: 'absolute', inset: 0, display: 'flex', alignItems: 'center',
            justifyContent: 'center', pointerEvents: 'none',
          }}>
            <div style={{
              ...cardStyle, pointerEvents: 'all', marginTop: 60,
            }}>
              <button onClick={nextLevel} style={{ ...btnStyle, background: '#26c6da' }}>
                {levelIdx < LEVELS.length - 1 ? 'Next Level' : 'Play Again'}
              </button>
              <button onClick={restart} style={{ ...btnStyle, background: '#1e2535', color: '#90a4ae', marginLeft: 10 }}>
                Restart
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Controls + level select */}
      <div style={{
        width: W, background: '#0d0f1a', borderRadius: '0 0 10px 10px',
        padding: '6px 18px', fontSize: 11, color: '#37474f', letterSpacing: 1.2,
        display: 'flex', justifyContent: 'space-between', alignItems: 'center',
      }}>
        <span>Click tiles to rotate &nbsp;&middot;&nbsp; Connect IN to OUT</span>
        <div style={{ display: 'flex', gap: 6 }}>
          {LEVELS.map((_, i) => (
            <button key={i} onClick={() => loadLevel(i)} style={{
              padding: '2px 8px', fontSize: 10,
              background: i === levelIdx ? '#4fc3f7' : '#1e2535',
              color: i === levelIdx ? '#0a0a0f' : '#546e7a',
              border: 'none', borderRadius: 4, cursor: 'pointer',
              fontFamily: '"Courier New", monospace',
            }}>L{i + 1}</button>
          ))}
        </div>
      </div>
    </div>
  )
}

// ─── Styles ───────────────────────────────────────────────────────────────────
const cardStyle: React.CSSProperties = {
  textAlign: 'center', fontFamily: '"Courier New", monospace', padding: '14px 20px',
  background: '#0d0f1a', border: '1px solid #1e2535', borderRadius: 12,
  display: 'flex', alignItems: 'center',
}
const btnStyle: React.CSSProperties = {
  padding: '9px 22px', background: '#4fc3f7', color: '#0a0a0f',
  border: 'none', borderRadius: 6, fontFamily: '"Courier New", monospace',
  fontSize: 12, fontWeight: 700, letterSpacing: 2, cursor: 'pointer',
}
