// Shared gamepad axes readable from Script update functions.
// GamepadDriver (rendered inside <Game>) writes here every frame via useGamepad.
export const gpState = {
  axes:      [0, 0, 0, 0] as number[],
  connected: false,
}
