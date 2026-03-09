/**
 * LocalTransport — a mock NetTransport for same-tab multiplayer demos.
 *
 * In production you'd use `createWebSocketTransport` from `@cubeforge/net`
 * to connect to a real relay server. This local transport simulates a network
 * link between two peers by routing messages through an in-memory channel.
 *
 * Usage:
 *   const [transportA, transportB] = createLocalTransportPair()
 *   // transportA.send("hello") -> transportB receives "hello"
 *   // transportB.send("world") -> transportA receives "world"
 */

// ─── NetTransport interface (mirrors @cubeforge/net) ─────────────────────────
export interface NetTransport {
  send(data: string): void
  onMessage(handler: (data: string) => void): void
  onConnect(handler: () => void): void
  onDisconnect(handler: () => void): void
  close(): void
}

// ─── NetMessage (mirrors @cubeforge/net) ─────────────────────────────────────
export interface NetMessage {
  type: string
  payload: unknown
  peerId?: string
  tick?: number
}

// ─── LocalTransport ──────────────────────────────────────────────────────────
class LocalTransport implements NetTransport {
  private _messageHandlers: Array<(data: string) => void> = []
  private _connectHandlers: Array<() => void> = []
  private _disconnectHandlers: Array<() => void> = []
  private _closed = false

  /** Set by createLocalTransportPair — links to the other end. */
  _peer: LocalTransport | null = null

  send(data: string): void {
    if (this._closed || !this._peer) return
    // Simulate async delivery (next microtask) to mimic real network latency.
    const peer = this._peer
    queueMicrotask(() => {
      for (const h of peer._messageHandlers) h(data)
    })
  }

  onMessage(handler: (data: string) => void): void {
    this._messageHandlers.push(handler)
  }

  onConnect(handler: () => void): void {
    this._connectHandlers.push(handler)
  }

  onDisconnect(handler: () => void): void {
    this._disconnectHandlers.push(handler)
  }

  close(): void {
    this._closed = true
    for (const h of this._disconnectHandlers) h()
    if (this._peer && !this._peer._closed) {
      this._peer._closed = true
      for (const h of this._peer._disconnectHandlers) h()
    }
  }

  /** Simulate the connection becoming established. */
  _connect(): void {
    for (const h of this._connectHandlers) h()
  }
}

/**
 * Create a linked pair of local transports.
 * Messages sent on one arrive at the other.
 */
export function createLocalTransportPair(): [NetTransport, NetTransport] {
  const a = new LocalTransport()
  const b = new LocalTransport()
  a._peer = b
  b._peer = a

  // Simulate connections opening (next microtask).
  queueMicrotask(() => {
    a._connect()
    b._connect()
  })

  return [a, b]
}

// ─── Room (minimal inline copy of @cubeforge/net Room) ───────────────────────
// In production, import { Room } from '@cubeforge/net'
export interface RoomConfig {
  transport: NetTransport
  peerId: string
}

export class Room {
  private readonly _transport: NetTransport
  private readonly _peerId: string
  private _connected = false
  private _messageHandlers: Array<(msg: NetMessage) => void> = []

  constructor(config: RoomConfig) {
    this._transport = config.transport
    this._peerId = config.peerId

    this._transport.onConnect(() => {
      this._connected = true
    })

    this._transport.onDisconnect(() => {
      this._connected = false
    })

    this._transport.onMessage((raw: string) => {
      let msg: NetMessage
      try {
        msg = JSON.parse(raw) as NetMessage
      } catch {
        return
      }
      for (const h of this._messageHandlers) h(msg)
    })
  }

  send(msg: NetMessage): void {
    this._transport.send(JSON.stringify({ ...msg, peerId: this._peerId }))
  }

  broadcast(msg: NetMessage): void {
    this.send(msg)
  }

  onMessage(handler: (msg: NetMessage) => void): void {
    this._messageHandlers.push(handler)
  }

  get isConnected(): boolean {
    return this._connected
  }

  get peerId(): string {
    return this._peerId
  }

  disconnect(): void {
    this._transport.close()
  }
}
