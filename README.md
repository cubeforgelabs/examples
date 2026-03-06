# cubeforge-examples

Runnable example games built with [Cubeforge](https://github.com/1homsi/cubeforge) — a React-first 2D browser game engine.

Each example is a self-contained Vite + React app. They all point to the local `cubeforge/` engine source via path aliases, so you can hack on the engine and see changes live.

---

## Examples

### Platformer
> `platformer/`

A full scrolling platformer with:
- Double jump with coyote time and jump buffer
- Enemy patrol and stomp mechanic (jump on enemies to kill them)
- Invincibility frames with sprite flash on hurt
- 3 lives, score, coin counter, timer HUD
- Win and game over overlays
- 12 collectible coins with bobbing animation
- 4 patrol enemies on floor and platforms
- 1640px scrollable world with multi-tier platforms

**Controls:** `WASD` / Arrow keys to move, `Space` / `W` / `Up` to jump (double jump supported), jump on enemies to stomp

---

### Mario Clone *(coming soon)*
> `mario-clone/`

Mario-style platformer with question blocks, mushroom powerups, pipes, and a goal flag.

---

### Breakout *(coming soon)*
> `breakout/`

Classic brick breaker. Paddle, bouncing ball, rows of bricks, multiple levels.

---

### Flappy Bird *(coming soon)*
> `flappy-bird/`

Tap-to-flap side-scroller. Pipes scroll from right, survive as long as possible.

---

### Shooter *(coming soon)*
> `shooter/`

Side-scrolling shoot-em-up. Player ship fires right, enemies scroll in from the left in waves.

---

### Top-Down *(coming soon)*
> `top-down/`

Top-down movement demo with 4-directional controls, obstacles, and trigger zones.

---

## Running an example

All examples share a root `bun` workspace. Cubeforge engine source lives in the sibling `cubeforge/` directory — no npm install of the engine needed.

```bash
# From this repo root
bun install

# Run a specific example
bun run --cwd platformer dev
```

Or go into the example directory directly:

```bash
cd platformer
bun dev
```

---

## Directory structure

```
cubeforge-examples/
  platformer/
    src/
      components/   # Player, Enemy, Coin, Ground
      App.tsx       # game layout, HUD, overlays
      gameEvents.ts # callback bridge between game scripts and React
    vite.config.ts  # aliases @cubeforge/* to local engine source
  mario-clone/      (coming soon)
  breakout/         (coming soon)
  flappy-bird/      (coming soon)
  shooter/          (coming soon)
  top-down/         (coming soon)
```

---

## Engine repo

[github.com/1homsi/cubeforge](https://github.com/1homsi/cubeforge)
