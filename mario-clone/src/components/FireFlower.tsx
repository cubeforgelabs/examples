import { useRef } from 'react'
import { Entity, Transform, Sprite, BoxCollider, useTriggerEnter, useDestroyEntity } from '@cubeforge/react'
import { gameEvents } from '../gameEvents'

function FireFlowerPickup() {
  const destroy = useDestroyEntity()
  const collected = useRef(false)

  useTriggerEnter(() => {
    if (collected.current) return
    collected.current = true
    gameEvents.onFireFlower?.()
    destroy()
  }, { tag: 'player' })

  return null
}

export function FireFlower({ x, y }: { x: number; y: number }) {
  return (
    <Entity tags={['fireFlower']}>
      <Transform x={x} y={y} />
      <Sprite src="/SMB_Sprite_Fire_Flower.png" width={24} height={28} color="#ef6c00" zIndex={5} />
      <BoxCollider width={20} height={24} isTrigger />
      <FireFlowerPickup />
    </Entity>
  )
}
