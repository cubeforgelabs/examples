# cubeforge-examples

Runnable example games built with [Cubeforge](https://github.com/1homsi/cubeforge) — a React-first 2D browser game engine.

Each example is a self-contained Vite + React app. They all point to the local `cubeforge/` engine source via Vite path aliases, so you can hack on the engine and see changes live.

**[Full roadmap (100+ planned games)](ROADMAP.md)**

---

## Examples

The repo currently includes **74 playable examples**, all under `games/*`.

| Game | Tags | Description |
|---|---|---|
| [2048](games/2048/) | puzzle | Slide and merge tiles to reach 2048. |
| [Angry Birds](games/angry-birds/) | physics, action | Launch birds to knock down pig structures. |
| [Arkanoid](games/arkanoid/) | arcade, breakout, classic | Smash bricks with a bouncing ball, collect power-ups, and clear every level. |
| [Asteroids](games/asteroids/) | arcade, shooter | Shoot asteroids and survive the field. |
| [Auto Battler](games/auto-battler/) | strategy, auto-battler | Place units on a grid and watch them fight. Buy and upgrade between rounds. |
| [Auto Runner](games/auto-runner/) | arcade, runner, endless | Jump over obstacles as you auto-scroll through an endless course at increasing speed. |
| [Blackjack](games/blackjack/) | card, casual | Beat the dealer without going over 21. |
| [Breakout](games/breakout/) | arcade, classic | Smash all the bricks with your ball. |
| [Bullet Hell](games/bullet-hell/) | shooter, bullet-hell, arcade | Dodge dense bullet patterns, defeat bosses with focused and spread shots. |
| [Checkers](games/checkers/) | board, strategy | Classic checkers against a friend or AI. |
| [Chess](games/chess/) | board, strategy, classic | Full chess with valid move highlights, all piece rules, and check/checkmate detection. |
| [City Builder](games/city-builder/) | simulation, strategy, city | Zone your city with residential, commercial, and industrial areas. Manage population, money, and happiness. |
| [Connect 4](games/connect-4/) | board, strategy | Drop pieces and get four in a row. |
| [Conway's Game of Life](games/game-of-life/) | simulation, casual | Simulate Conway's cellular automaton. |
| [Dr. Mario](games/dr-mario/) | puzzle, arcade | Drop colored pill capsules to match 4 in a row and eliminate viruses. |
| [Drift Racer](games/drift-racer/) | racing, drift | Score points with controlled drifts around tight corners in this top-down racer. |
| [Endless Runner](games/endless-runner/) | runner, arcade | Jump and slide through an endless obstacle course. |
| [Farming Sim](games/farming-sim/) | simulation, farming, casual | Till, plant, water, and harvest crops to earn gold. Grow wheat, tomatoes, and corn through multiple stages. |
| [Flappy Bird](games/flappy-bird/) | arcade, casual | Tap to flap through the pipes. |
| [Frogger](games/frogger/) | arcade, classic, puzzle | Cross busy roads and treacherous rivers to reach safety. |
| [Galaga](games/galaga/) | arcade, shooter, classic | Blast waves of diving alien formations in this classic arcade shooter. |
| [Geography Games](games/geography-games/) | quiz, education, casual | Race the clock in a world geography quiz that rewards quick, correct answers and teaches as you go. |
| [Gravity Puzzle](games/sliding-puzzle-15/) | puzzle, physics | Switch gravity direction to move colored blocks and match patterns. |
| [Idle Game](games/idle/) | idle, casual | Click to earn, upgrade to earn more. |
| [Lights Out](games/lights-out/) | puzzle | Toggle lights to turn the board dark. |
| [Logic Training](games/logic-training/) | puzzle, strategy | Deduce the correct beacon through escalating clue rounds. |
| [Lunar Lander](games/lunar-lander/) | arcade, physics, classic | Guide your spacecraft to a gentle landing on the moon's surface with limited fuel. |
| [Mario Clone](games/mario-clone/) | platformer, classic | A classic side-scrolling platformer adventure. |
| [Match 3](games/match-3/) | puzzle, casual | Swap and match three gems to clear the board. |
| [Math Puzzles](games/math-puzzles/) | puzzle, math, arcade | Solve fast arithmetic puzzles before the clock runs out. |
| [Memory Card](games/memory-card/) | memory, casual | Flip cards and find matching pairs. |
| [Metroidvania](games/metroidvania/) | platformer, exploration, adventure | Explore interconnected rooms, collect abilities, and unlock new areas. |
| [Minesweeper](games/minesweeper/) | puzzle, classic | Uncover all cells without hitting a mine. |
| [Missile Command](games/missile-command/) | arcade, strategy, classic | Defend your cities from incoming missiles with well-placed counter-strikes. |
| [Multiplayer Demo](games/multiplayer/) | multiplayer, demo | Real-time multiplayer demo with cubeforge. |
| [Pac-Man](games/pac-man/) | arcade, classic | Eat all the dots and avoid the ghosts. |
| [Pattern Recognition](games/pattern-recognition/) | puzzle, memory, casual | Memorize the glow path, then reproduce it before your focus runs out. |
| [Pipe Puzzle](games/pipe-puzzle/) | puzzle, logic | Rotate pipe tiles to connect source to drain before time runs out. |
| [Platformer](games/platformer/) | platformer, action | A polished side-scrolling platformer with enemies and collectibles. |
| [Playground](games/playground/) | demo, sandbox | An interactive sandbox for experimenting with cubeforge. |
| [Poker](games/poker/) | card, casino | Texas Hold'em poker vs AI with betting, hand evaluation, and chip management. |
| [Pong](games/pong/) | arcade, classic | The original arcade classic - two paddles, one ball. |
| [Precision Platformer](games/precision-platformer/) | platformer, precision, hardcore | Navigate tight gaps, dodge spikes, and master precise jumps across deadly levels. |
| [Puyo Puyo](games/puyo-puyo/) | puzzle, arcade | Drop colored blob pairs and connect 4+ of the same color to pop them. |
| [Quiz Games](games/quiz-games/) | trivia, quiz, educational | Race through category-based trivia rounds with a ticking clock, streak bonuses, and a fast restart loop. |
| [Reversi](games/reversi/) | board, strategy, classic | Classic Othello/Reversi on an 8x8 board with simple AI opponent. |
| [Rhythm Game](games/rhythm/) | rhythm, music | Hit notes in time to the beat. |
| [Roguelike](games/roguelike/) | roguelike, rpg | Explore dungeons, fight enemies, and collect loot. |
| [RPG](games/rpg/) | rpg, adventure | A top-down RPG with quests and combat. |
| [RTS Lite](games/tower-defense-2/) | strategy, rts | Collect resources, build units, and destroy the enemy base. |
| [Shooter](games/shooter/) | shooter, action | A fast-paced top-down shooter. |
| [Side-Scroll Shooter](games/side-scroll-shooter/) | shooter, action, run-and-gun | Run-and-gun side scroller. Blast walkers and flyers, jump over obstacles, and survive endless escalating waves of enemies. |
| [Simon Says](games/simon/) | memory, casual | Repeat the pattern - how long can you last? |
| [Sliding Puzzle](games/sliding-puzzle/) | puzzle | Slide tiles into the correct order. |
| [Snake](games/snake/) | arcade, classic | Eat apples and grow without hitting yourself. |
| [Sokoban](games/sokoban/) | puzzle, classic | Push boxes onto targets to solve each level. |
| [Solitaire](games/solitaire/) | card, casual | Classic Klondike solitaire card game. |
| [Space Invaders](games/space-invaders/) | arcade, shooter, classic | Defend Earth from waves of descending aliens in this classic shooter. |
| [Speed Reaction](games/speed-reaction/) | educational, reaction, arcade | Wait for the flash, then react as fast as you can across a five-round reflex test. |
| [Tank Shooter](games/tank-shooter/) | shooter, tank, action | Command an armored tank and destroy enemy vehicles in arena combat. |
| [Tetris](games/tetris/) | arcade, classic, puzzle | Stack falling tetrominoes and clear lines. |
| [Tic-Tac-Toe](games/tic-tac-toe/) | board, casual | Classic X vs O - first to three wins. |
| [Top-down Racing](games/top-down-racing/) | racing, top-down | Overhead-view car racing around a track with AI opponents. |
| [Top-Down Shooter](games/top-down/) | shooter, action | Survive waves of enemies from above. |
| [Tower Defense](games/tower-defense/) | strategy, tower-defense | Place towers and stop the enemies reaching the end. |
| [Turn-Based Strategy](games/turn-based/) | strategy, tactics | Grid-based tactical combat with warriors, archers, and mages. |
| [Twin-Stick Shooter](games/twin-stick/) | shooter, action | Move with one stick, aim with the other. |
| [Typing Games](games/typing-games/) | typing, skill, casual | Type the words fast and clean before the clock runs out. |
| [Vampire Survivors](games/vampire-survivors/) | survivor, action, roguelike | Survive hordes and auto-attack your way to dawn. |
| [Vertical Shooter](games/vertical-shooter/) | shooter, arcade, shmup | Classic top-down vertical scrolling shooter. Pilot your ship, dodge enemy formations, collect power-ups, and blast your way through endless waves. |
| [Wall Jump](games/wall-jump/) | platformer, vertical, arcade | Leap between walls and climb as high as you can without falling. |
| [Wave Defense](games/wave-defense/) | survival, defense, action | Aim and shoot waves of enemies as a stationary turret. Combo multipliers and 5 enemy types. |
| [Whack-a-Mole](games/whack-a-mole/) | arcade, casual | Tap the moles before they disappear. |
| [Zombie Survival](games/zombie-survival/) | survival, action, shooter | Top-down zombie survival with auto-shooting, wave escalation, XP gems, and upgrades. |

---

## Running an example

```bash
# Clone both repos as siblings
git clone https://github.com/1homsi/cubeforge
git clone https://github.com/1homsi/cubeforge-examples

# Install deps in examples repo
cd cubeforge-examples
pnpm install

# Run the default example from the repo root
pnpm dev
```

To run any specific game, use its folder directly:

```bash
cd games/breakout && pnpm dev
```

Or without changing directories:

```bash
pnpm --dir games/quiz-games dev
pnpm --dir games/typing-games dev
pnpm --dir games/top-down-racing dev
```

---

## Engine repo

[github.com/1homsi/cubeforge](https://github.com/1homsi/cubeforge)
