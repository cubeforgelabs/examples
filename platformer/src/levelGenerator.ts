// ─── Seeded PRNG (LCG) ───────────────────────────────────────────────────────
function makePRNG(seed: number) {
  let s = seed >>> 0
  return (): number => {
    s = (Math.imul(s, 1664525) + 1013904223) >>> 0
    return s / 0x100000000
  }
}

// ─── Types ────────────────────────────────────────────────────────────────────
export interface PlatformDef {
  key:     string
  x:       number
  y:       number
  width:   number
  color:   string
  oneWay?: boolean
}

export interface CoinDef {
  id: number
  x:  number
  y:  number
}

export interface EnemyDef {
  key:         string
  x:           number
  y:           number
  patrolLeft:  number
  patrolRight: number
  speed:       number
  flying:      boolean
  chaser:      boolean
  color:       string
}

export interface MovingPlatDef {
  key:      string
  x1: number; y1: number
  x2: number; y2: number
  width:    number
  duration: number
}

export interface LevelData {
  worldWidth:      number
  totalCoins:      number
  platforms:       PlatformDef[]
  coins:           CoinDef[]
  enemies:         EnemyDef[]
  movingPlatforms: MovingPlatDef[]
  background:      string
  groundSrc:       string
}

// ─── World constants ──────────────────────────────────────────────────────────
const FLOOR_Y    = 506
const PLATFORM_H = 18
const COIN_ABOVE = 30  // px above platform top before placing coin center

// ─── Per-level difficulty config ──────────────────────────────────────────────
interface LevelCfg {
  numPlatforms: number
  gapMin:       number
  gapMax:       number
  wMin:         number
  wMax:         number
  dyMax:        number
  enemyChance:  number
  enemySpeed:   number
  flyingChance: number
  chaserChance: number
  movingEvery:  number   // add a moving platform every N regular platforms
  minY:         number   // highest allowed platform y (ceiling)
  bg:           string
  groundSrc:    string
  colors:       readonly string[]
}

function levelCfg(level: number): LevelCfg {
  const d = Math.min((level - 1) / 3, 1)  // 0→1 over levels 1–4
  return {
    numPlatforms: 14 + level * 4,
    gapMin:       55 + Math.round(d * 20),
    gapMax:       130 + Math.round(d * 40),
    wMin:         Math.round(70 - d * 15),
    wMax:         Math.round(150 - d * 20),
    dyMax:        80 + Math.round(d * 40),
    enemyChance:  0.25 + d * 0.25,
    enemySpeed:   75 + Math.round(d * 55),
    flyingChance: level >= 2 ? 0.20 + d * 0.15 : 0,
    chaserChance: level >= 2 ? 0.35 : 0,
    movingEvery:  Math.max(3, 8 - Math.floor(d * 3)),
    minY:         110,
    bg:           level === 1 ? '#12131f' : level === 2 ? '#0f1520' : '#100818',
    groundSrc:    level === 1 ? '/ground_cave.png' : level === 2 ? '/ground_rock.png' : '/tile.png',
    colors:
      level === 1 ? ['#263238', '#2e3a40', '#37474f', '#455a64', '#546e7a'] :
      level === 2 ? ['#1a237e', '#283593', '#303f9f', '#3949ab', '#3f51b5'] :
                   ['#1b0036', '#2d1f5e', '#3d2b82', '#4a35a0', '#5c4bc0'],
  }
}

// ─── Generator ────────────────────────────────────────────────────────────────
export function generateLevel(level: number, seed: number): LevelData {
  const rand = makePRNG(seed)
  const cfg  = levelCfg(level)

  const platforms:       PlatformDef[]   = []
  const coins:           CoinDef[]       = []
  const enemies:         EnemyDef[]      = []
  const movingPlatforms: MovingPlatDef[] = []

  let coinId    = 1
  let mpCounter = 0

  // Platform top y helper
  const pTop = (py: number) => py - PLATFORM_H / 2

  // Color based on height (darker = closer to ceiling)
  const heightColor = (py: number) => {
    const t   = 1 - (py - cfg.minY) / (FLOOR_Y - cfg.minY)
    const idx = Math.min(cfg.colors.length - 1, Math.max(0, Math.floor(t * cfg.colors.length)))
    return cfg.colors[idx]
  }

  // Check that a coin at (cx, cy) doesn't overlap any existing platform.
  // Coin occupies [cx±8, cy±(8+6)] where ±6 is the bob range.
  const coinClear = (cx: number, cy: number): boolean => {
    const cL = cx - 8, cR = cx + 8
    const cT = cy - 14, cB = cy + 14
    for (const p of platforms) {
      const pL = p.x - p.width / 2, pR = p.x + p.width / 2
      const pT = pTop(p.y),          pB = p.y + PLATFORM_H / 2
      if (cR > pL && cL < pR && cB > pT && cT < pB) return false
    }
    return true
  }

  const addCoin = (x: number, y: number) => {
    if (y > cfg.minY - 20 && coinClear(x, y))
      coins.push({ id: coinId++, x, y })
  }

  // ── Spawn platform ─────────────────────────────────────────────────────────
  const SPAWN_X = 150, SPAWN_Y = 450, SPAWN_W = 200
  platforms.push({ key: 'spawn', x: SPAWN_X, y: SPAWN_Y, width: SPAWN_W, color: cfg.colors[0] })
  addCoin(SPAWN_X - 40, pTop(SPAWN_Y) - COIN_ABOVE)
  addCoin(SPAWN_X + 40, pTop(SPAWN_Y) - COIN_ABOVE)

  let rightEdge = SPAWN_X + SPAWN_W / 2
  let curY      = SPAWN_Y

  // ── Platform chain ─────────────────────────────────────────────────────────
  for (let i = 0; i < cfg.numPlatforms; i++) {
    const w   = cfg.wMin + Math.floor(rand() * (cfg.wMax - cfg.wMin + 1))
    const gap = cfg.gapMin + Math.floor(rand() * (cfg.gapMax - cfg.gapMin + 1))

    // Vertical change: bias toward up/down to create interesting terrain
    let dy: number
    const r = rand()
    if      (r < 0.35) dy = -(25 + Math.floor(rand() * cfg.dyMax))   // up
    else if (r < 0.70) dy =   25 + Math.floor(rand() * cfg.dyMax)    // down
    else               dy = Math.round((rand() - 0.5) * 30)           // flat

    const nx = rightEdge + gap + w / 2
    const ny = Math.max(cfg.minY + PLATFORM_H / 2, Math.min(FLOOR_Y - 80, curY + dy))

    const oneWay = rand() < 0.28
    const color  = heightColor(ny)
    platforms.push({ key: `p${i}`, x: nx, y: ny, width: w, color, oneWay })

    rightEdge = nx + w / 2
    curY      = ny

    // ── Coin above this platform ────────────────────────────────────────────
    if (rand() < 0.65) {
      const cx = nx + Math.round((rand() - 0.5) * w * 0.4)
      addCoin(cx, pTop(ny) - COIN_ABOVE)
    }

    // ── Enemy on this platform ──────────────────────────────────────────────
    if (w >= 80 && rand() < cfg.enemyChance) {
      const isFlying = rand() < cfg.flyingChance
      const isChaser = !isFlying && rand() < cfg.chaserChance
      const half     = w / 2 - 18
      const ex       = nx + Math.round((rand() - 0.5) * half)
      // Ground enemies spawn ~30px above platform center (physics settles them).
      // Flying enemies spawn 65px above platform top and bob ±20px.
      const ey = isFlying ? pTop(ny) - 65 : ny - 30
      const spd = Math.round(cfg.enemySpeed * (0.8 + rand() * 0.4))
      enemies.push({
        key:         `e${i}`,
        x:           ex,
        y:           ey,
        patrolLeft:  nx - half,
        patrolRight: nx + half,
        speed:       spd,
        flying:      isFlying,
        chaser:      isChaser,
        color:       isFlying ? '#ce93d8' : isChaser ? '#ff1744' : (level >= 2 ? '#ff6f00' : '#ef5350'),
      })
    }

    // ── Moving platform (supplementary path below main chain) ──────────────
    mpCounter++
    if (mpCounter >= cfg.movingEvery) {
      mpCounter = 0
      const mpY = ny + 60 + Math.floor(rand() * 70)
      if (mpY < FLOOR_Y - 50) {
        const mpX1 = nx - w / 2 + 10
        const mpX2 = mpX1 + 80 + Math.floor(rand() * 90)
        movingPlatforms.push({
          key: `mp${i}`,
          x1: mpX1, y1: mpY,
          x2: mpX2, y2: mpY,
          width: 85,
          duration: 1.8 + rand() * 1.5,
        })
        // Optional coin above moving platform midpoint
        if (rand() < 0.5)
          addCoin((mpX1 + mpX2) / 2, mpY - PLATFORM_H / 2 - COIN_ABOVE)
      }
    }
  }

  // ── Final platform (goal) ──────────────────────────────────────────────────
  const FINAL_W = 260
  const FINAL_X = rightEdge + 160 + FINAL_W / 2
  const FINAL_Y = 450
  platforms.push({ key: 'final', x: FINAL_X, y: FINAL_Y, width: FINAL_W, color: cfg.colors[0] })
  for (let k = -1; k <= 1; k++)
    addCoin(FINAL_X + k * 45, pTop(FINAL_Y) - COIN_ABOVE)

  return {
    worldWidth:      FINAL_X + FINAL_W / 2 + 200,
    totalCoins:      coins.length,
    platforms,
    coins,
    enemies,
    movingPlatforms,
    background:      cfg.bg,
    groundSrc:       cfg.groundSrc,
  }
}
