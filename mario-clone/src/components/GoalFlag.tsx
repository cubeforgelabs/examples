import { Entity, Transform, Sprite, Script, findByTag } from '@cubeforge/react'
import type { EntityId, ECSWorld, TransformComponent } from '@cubeforge/react'
import { gameEvents } from '../gameEvents'
import { FLOOR_TOP } from '../levelGen'

let goalReached = false

function goalCheck(id: EntityId, world: ECSWorld) {
  if (goalReached) return
  if (!world.hasEntity(id)) return
  const gt = world.getComponent<TransformComponent>(id, 'Transform')
  if (!gt) return
  for (const pid of findByTag(world, 'player')) {
    const pt = world.getComponent<TransformComponent>(pid, 'Transform')
    if (!pt) continue
    if (Math.abs(gt.x - pt.x) < 40 && Math.abs(gt.y - pt.y) < 200) {
      goalReached = true
      setTimeout(() => gameEvents.onGoalReached?.(), 0)
      return
    }
  }
}

// Reset on new game
export function resetGoalFlag() { goalReached = false }

interface GoalFlagProps {
  x: number
  y: number
  level?: number
}

export function GoalFlag({ x, y, level = 1 }: GoalFlagProps) {
  // Castle bottom should sit on the ground
  const castleH = 160
  const castleY = FLOOR_TOP - castleH / 2 // center so bottom touches ground
  // Princess stands on the ground in front of the castle
  const princessH = 48
  const princessY = FLOOR_TOP - princessH / 2

  return (
    <>
      {/* Flag pole — base at ground level */}
      <Entity tags={['goalFlag']}>
        <Transform x={x} y={y} />
        <Sprite src="/SMB_Goal_Pole.png" width={16} height={320} color="#888" zIndex={4} />
        <Script update={goalCheck} />
      </Entity>

      {/* Castle at end — sits on ground */}
      <Entity>
        <Transform x={x + 192} y={castleY} />
        <Sprite src="/SMBCastle.png" width={160} height={castleH} color="#555" zIndex={1} />
      </Entity>

      {/* Princess Toadstool — only on final level */}
      {level === 3 && (
        <Entity>
          <Transform x={x + 176} y={princessY} />
          <Sprite src="/SMB_Princess_Toadstool_Sprite.png" width={32} height={princessH} color="#f48fb1" zIndex={5} />
        </Entity>
      )}
    </>
  )
}
