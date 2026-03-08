import { useState, useEffect, useCallback, useMemo, useRef } from 'react'
import { Game, World, Camera2D, Entity, Transform, Sprite } from '@cubeforge/react'
import type { EntityId } from '@cubeforge/react'
import { Player, playerConfig }  from './components/Player'
import { Goomba }                from './components/Goomba'
import { KoopaTroopa }           from './components/KoopaTroopa'
import { KoopaParatroopa }       from './components/KoopaParatroopa'
import { BuzzyBeetle }           from './components/BuzzyBeetle'
import { PiranhaPlant }          from './components/PiranhaPlant'
import { BillBlaster }           from './components/BillBlaster'
import { HammerBro }             from './components/HammerBro'
import { Bowser }                from './components/Bowser'
import { Podoboo }               from './components/Podoboo'
import { Ground }                from './components/Ground'
import { Coin }                  from './components/Coin'
import { QuestionBlock }         from './components/QuestionBlock'
import { BrickBlock }            from './components/BrickBlock'
import { WarpPipe }              from './components/WarpPipe'
import { Mushroom }              from './components/Mushroom'
import { FireFlower }            from './components/FireFlower'
import { StarItem }              from './components/StarItem'
import { OneUpMushroom }         from './components/OneUpMushroom'
import { GoalFlag }              from './components/GoalFlag'
import { HUD }                   from './components/HUD'
import { GameOverlays }          from './components/GameOverlays'
import { gameEvents }            from './gameEvents'
import { preloadImage }          from './images'
import {
  T, FLOOR_H, FLOOR_TOP, FLOOR_Y,
  genLevel1, genLevel2, genLevel3,
  type GameState, type RevealType, type SpawnedReveal, type LevelData,
} from './levelGen'

// ─── Asset preload ────────────────────────────────────────────────────────────
const ASSETS = [
  '/ClassicNES_SMB_Small_Mario_Sprite.png', '/ClassicNES_SMB_Super_Mario_Sprite.png',
  '/SMB_Fire_Mario_Sprite.png', '/Goomba_SMB.png', '/SMB_Goomba_Sprite.gif',
  '/GoombaSMBGrey.gif', '/SMBBlueGoomba.gif', '/SMB_Green_Koopa_Troopa_Sprite.png',
  '/SMB_NES_Blue_Koopa_Troopa_Walking.gif', '/KoopaParatroopaGreenDark.gif',
  '/SMB_Red_Koopa_Troopa.gif', '/Buzzy_Beetle_SMB.png', '/BuzzyBeetleSMBUnderground.gif',
  '/SMB_Buzzy_Beetle_Castle_Sprite.gif', '/SMB_Sprite_Piranha_Plant.png',
  '/SMB_Piranha_Plant_Underground_Sprite.png', '/Podoboo_Sprite_SMB.png',
  '/SMB_Sprite_Coin.png', '/SMB1_Sprite_Coin.gif', '/SMB_CoinUnderground.gif',
  '/SMB_CoinCastle.gif', '/SMB_Qblock.png', '/SMB_Question_Block.gif',
  '/SMB_QuestionBlockUndergroundAnim.gif', '/SMB_QuestionBlockCastleAnim.gif',
  '/SMB1_Empty_Block.png', '/SMB_Brick_Block_Sprite.png', '/SMB_Underground_Brick_Block.png',
  '/SMB_Castle_Brick_Block.png', '/SMB_Supermushroom.png', '/SMB_Sprite_Fire_Flower.png',
  '/Starman.gif', '/SMB_Sprite_Super_Star.png', '/SMB_Sprite_1UP.png',
  '/Warp_Pipe_SMB.png', '/Warp_Pipe_Orange_SMB.png', '/Warp_Pipe_Gray_SMB.png',
  '/Bill_Blaster_Sprite_SMB.png', '/Bullet_Bill_Super_Mario_Bros.png',
  '/SMB_Hammer_Bro_Sprite.png', '/SMB_Sprite_Axe.png', '/SMB_Bowser_Sprite.png',
  '/SMBBowsersFlame.gif', '/SMB_Goal_Pole.png', '/SMBCastle.png',
  '/LargeFortressSMB.png', '/SMB_Princess_Toadstool_Sprite.png', '/SMBFireBall.gif',
  '/SMB_Ground.png', '/SMB_Ground_Underground.png', '/SMB_Ground_Castle.png',
  '/SMBPlatform.png', '/SMB_Hard_Block_Sprite.png', '/SMB_Underground_Hard_Block.png',
  '/SMB_Sprite_Island_(Ground).png', '/SMB_Sprite_Island_(Gray).png',
  '/SMB_Sprite_Lava.png', '/SMB_Bowser_Bridge.png', '/SMB_Sprite_Firework.gif',
]
ASSETS.forEach(preloadImage)

// ─── Constants ────────────────────────────────────────────────────────────────
const W         = 800
const H         = 560
const MAX_LIVES = 3

// Player spawn (tile col 3, standing on ground)
const SPAWN_X = 3 * T + T / 2   // 112
const SPAWN_Y = FLOOR_TOP - 20 // 460 (half of SMALL_H=40)

// ─── App ──────────────────────────────────────────────────────────────────────
export function App() {
  const [gameKey,        setGameKey]        = useState(0)
  const [score,          setScore]          = useState(0)
  const [lives,          setLives]          = useState(MAX_LIVES)
  const [level,          setLevel]          = useState<1|2|3>(1)
  const [gameState,      setGameState]      = useState<GameState>('playing')
  const [collectedCoins, setCollectedCoins] = useState<Set<number>>(new Set())
  const [revealedBlocks, setRevealedBlocks] = useState<Set<number>>(new Set())
  const [spawnedReveals, setSpawnedReveals] = useState<SpawnedReveal[]>([])
  const [hasMushroom,    setHasMushroom]    = useState(false)
  const [hasFireFlower,  setHasFireFlower]  = useState(false)
  const [hasStar,        setHasStar]        = useState(false)

  const baseSeed = useRef(Date.now())
  const layout = useMemo<LevelData>(() => {
    const seed = baseSeed.current + level * 10000 + gameKey * 1000000
    if (level === 1) return genLevel1(seed)
    if (level === 2) return genLevel2(seed)
    return genLevel3(seed)
  }, [level, gameKey])

  useEffect(() => {
    gameEvents.onPlayerHurt = () => {
      setLives(prev => {
        const next = prev - 1
        if (next <= 0) setGameState('gameover')
        return Math.max(0, next)
      })
    }
    gameEvents.onEnemyKill   = (pts: number) => setScore(s => s + pts)
    gameEvents.onMushroomGet = () => { playerConfig.maxJumps = 2; playerConfig.isBig = true; setHasMushroom(true); setScore(s => s + 500) }
    gameEvents.onFireFlower  = () => { playerConfig.canFire = true; setHasFireFlower(true); setScore(s => s + 500) }
    gameEvents.onStar = () => {
      playerConfig.isStarActive = true; playerConfig.starTimer = 8.0
      setHasStar(true); setScore(s => s + 1000)
      setTimeout(() => setHasStar(false), 8000)
    }
    gameEvents.onOneUp       = () => { setLives(l => Math.min(l + 1, 9)); setScore(s => s + 200) }
    gameEvents.onGoalReached = () => { setScore(s => s + 2000); setGameState(level < 3 ? 'levelclear' : 'win') }
    return () => {
      gameEvents.onPlayerHurt = null; gameEvents.onEnemyKill = null
      gameEvents.onMushroomGet = null; gameEvents.onFireFlower = null
      gameEvents.onStar = null; gameEvents.onOneUp = null; gameEvents.onGoalReached = null
    }
  }, [gameKey, level])

  const handleCoinCollect = useCallback((_eid: EntityId, coinId: number) => {
    setCollectedCoins(prev => new Set([...prev, coinId])); setScore(s => s + 10)
  }, [])
  const handleRevealCoinCollect = useCallback((_eid: EntityId, revealId: number) => {
    setSpawnedReveals(prev => prev.filter(r => r.id !== revealId)); setScore(s => s + 10)
  }, [])
  const handleReveal = useCallback((blockId: number, type: RevealType, bx: number, by: number) => {
    setRevealedBlocks(prev => new Set([...prev, blockId]))
    const revealId = blockId + 1000
    setSpawnedReveals(prev => [...prev.filter(r => r.id !== revealId), { id: revealId, type, x: bx, y: by - T * 2 }])
  }, [])

  function startLevel(lv: 1|2|3) {
    playerConfig.maxJumps = 1; playerConfig.isBig = false; playerConfig.canFire = false
    playerConfig.isStarActive = false; playerConfig.starTimer = 0
    playerConfig.spawnX = SPAWN_X; playerConfig.spawnY = SPAWN_Y
    setLevel(lv); setCollectedCoins(new Set()); setRevealedBlocks(new Set())
    setSpawnedReveals([]); setHasMushroom(false); setHasFireFlower(false); setHasStar(false)
    setGameState('playing'); setGameKey(k => k + 1)
  }
  const restart   = () => { setScore(0); setLives(MAX_LIVES); startLevel(1) }
  const nextLevel = () => startLevel((level + 1) as 1|2|3)

  const { bg, worldW } = layout

  return (
    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 0 }}>

      <HUD
        W={W} lives={lives} score={score}
        coinsCollected={collectedCoins.size} totalCoins={layout.coins.length}
        level={level} hasMushroom={hasMushroom} hasFireFlower={hasFireFlower} hasStar={hasStar}
      />

      {/* ── Game canvas ─────────────────────────────────────────────────────── */}
      <div style={{ position: 'relative', width: W, height: H }}>
        <Game key={gameKey} width={W} height={H} gravity={1000}>
          <World background={bg}>
            <Camera2D
              followEntity="player" smoothing={0.88} background={bg}
              followOffsetY={-150}
              bounds={{ x: 0, y: -H, width: worldW, height: FLOOR_Y + FLOOR_H / 2 + H }}
            />
            <Player x={SPAWN_X} y={SPAWN_Y} />

            {/* Boundary walls */}
            <Ground key="wall-l" x={-10}        y={300} width={20} height={800} color={bg} />
            <Ground key="wall-r" x={worldW + 10} y={300} width={20} height={800} color={bg} />

            {/* ── Floor (base ground from tilemap) ───────────────────────── */}
            {layout.floorSegs.map(({ x, w }, i) => (
              <Ground key={`floor-${i}`} x={x + w / 2} y={FLOOR_Y} width={w} height={FLOOR_H}
                      src={layout.groundSrc} tileX tileY tileSizeX={T} tileSizeY={T} />
            ))}

            {/* ── Elevated ground (staircase, platforms from tilemap) ──── */}
            {layout.elevatedGround.map((g, i) => (
              <Ground key={`eg-${i}`} x={g.x} y={g.y} width={T} height={T}
                      src={layout.brickSrc} />
            ))}

            {/* ── Underground ceiling ────────────────────────────────────── */}
            {layout.theme === 'underground' && (
              <Ground key="ceiling" x={worldW / 2} y={T / 2} width={worldW} height={T}
                      src={layout.brickSrc} />
            )}

            {/* ── Background decorations ─────────────────────────────────── */}
            {layout.decorations.map((d, i) => (
              <Entity key={`deco-${i}`}>
                <Transform x={d.x} y={d.y} />
                <Sprite src={d.src} width={d.w} height={d.h} zIndex={0} />
              </Entity>
            ))}

            {/* ── Warp pipes ─────────────────────────────────────────────── */}
            {layout.pipes.map((p, i) => (
              <WarpPipe key={`pipe-${i}`} x={p.x} y={p.y} height={p.h} src={p.src} />
            ))}

            {/* ── Piranha plants ─────────────────────────────────────────── */}
            {layout.piranhaXs.map((px, i) => {
              const pipe = layout.pipes.find(p => p.x === px)
              if (!pipe) return null
              const plantSrc = layout.theme === 'underground' ? '/SMB_Piranha_Plant_Underground_Sprite.png' : undefined
              return <PiranhaPlant key={`piranha-${i}`} x={px} pipeTopY={pipe.pipeTopY} src={plantSrc} />
            })}

            {/* ── Brick blocks (from tilemap) ────────────────────────────── */}
            {layout.brickBlocks.map((b, i) =>
              layout.theme === 'overworld'
                ? <BrickBlock key={`brick-${i}`} x={b.x} y={b.y} />
                : <Ground key={`brick-${i}`} x={b.x} y={b.y} width={T} height={T}
                          src={layout.brickSrc} />
            )}

            {/* ── Question blocks (from tilemap) ─────────────────────────── */}
            {layout.qBlocks.filter(b => !revealedBlocks.has(b.id)).map(b => (
              <QuestionBlock
                key={b.id} x={b.x} y={b.y} reveals={b.reveals} src={layout.qBlockSrc}
                onReveal={() => handleReveal(b.id, b.reveals, b.x, b.y)}
              />
            ))}

            {/* ── Enemies ────────────────────────────────────────────────── */}
            {layout.enemies.map((e, i) => {
              switch (e.type) {
                case 'goomba':      return <Goomba         key={i} x={e.x} y={e.y} patrolLeft={e.left} patrolRight={e.right} src={e.src} />
                case 'koopa':       return <KoopaTroopa     key={i} x={e.x} y={e.y} patrolLeft={e.left} patrolRight={e.right} src={e.src} />
                case 'paratroopa':  return <KoopaParatroopa key={i} x={e.x} y={e.y} patrolLeft={e.left} patrolRight={e.right} />
                case 'buzzy':       return <BuzzyBeetle     key={i} x={e.x} y={e.y} patrolLeft={e.left} patrolRight={e.right} src={e.src} />
                case 'billblaster': return <BillBlaster     key={i} x={e.x} y={e.y} dir={(e.dir ?? 1) as 1 | -1} fireInterval={e.interval ?? 3.5} />
                case 'hammerbro':   return <HammerBro       key={i} x={e.x} y={e.y} patrolLeft={e.left} patrolRight={e.right} />
                case 'podoboo':     return <Podoboo         key={i} x={e.x} baseY={e.y} />
                case 'bowser':      return <Bowser          key={i} x={e.x} y={e.y} patrolLeft={e.left} patrolRight={e.right} />
                default: return null
              }
            })}

            {/* ── Coins (from tilemap) ───────────────────────────────────── */}
            {layout.coins.filter(c => !collectedCoins.has(c.id)).map(c => (
              <Coin key={c.id} x={c.x} y={c.y} src={layout.coinSrc}
                onCollect={eid => handleCoinCollect(eid, c.id)} />
            ))}

            {/* ── Castle-specific: lava + Bowser bridge ──────────────────── */}
            {layout.theme === 'castle' && <>
              <Entity>
                <Transform x={worldW / 2} y={FLOOR_TOP + 20} />
                <Sprite src="/SMB_Sprite_Lava.png" width={worldW} height={48} zIndex={2} />
              </Entity>
              <Entity>
                <Transform x={worldW - 260} y={FLOOR_TOP + 10} />
                <Sprite src="/SMB_Bowser_Bridge.png" width={240} height={32} zIndex={3} />
              </Entity>
            </>}

            {/* ── Goal flag ──────────────────────────────────────────────── */}
            <GoalFlag key="goal" x={layout.goalX} y={FLOOR_TOP - 160} />

            {/* ── Spawned reveals ─────────────────────────────────────────── */}
            {spawnedReveals.map(r => {
              if (r.type === 'mushroom')   return <Mushroom      key={r.id} x={r.x} y={r.y} />
              if (r.type === 'fireFlower') return <FireFlower    key={r.id} x={r.x} y={r.y} />
              if (r.type === 'star')       return <StarItem      key={r.id} x={r.x} y={r.y} />
              if (r.type === 'oneUp')      return <OneUpMushroom key={r.id} x={r.x} y={r.y} />
              return <Coin key={r.id} x={r.x} y={r.y} onCollect={eid => handleRevealCoinCollect(eid, r.id)} />
            })}

          </World>
        </Game>

        <GameOverlays
          gameState={gameState} score={score} level={level}
          onNextLevel={nextLevel} onRestart={restart}
        />
      </div>

      {/* ── Controls ────────────────────────────────────────────────────────── */}
      <div style={{
        width: W, background: '#0d0f1a', borderRadius: '0 0 10px 10px',
        padding: '6px 18px', fontSize: 11, color: '#37474f', letterSpacing: 1.5,
        display: 'flex', justifyContent: 'space-between',
      }}>
        <span>A/D · ←→ move &nbsp;·&nbsp; W/↑/Space jump &nbsp;·&nbsp; X/Z fire (after flower) &nbsp;·&nbsp; stomp enemies &nbsp;·&nbsp; defeat Bowser on World 3</span>
        <span style={{ color: '#263238' }}>Cubeforge</span>
      </div>
    </div>
  )
}
