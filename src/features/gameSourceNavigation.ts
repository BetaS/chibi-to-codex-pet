export const NEW_GAME_SUPPORT_ISSUE_URL =
  'https://github.com/BetaS/chibi-to-codex-pet/issues/new'

export const MAX_GAME_SOURCE_GRID_COLUMNS = 4

export function getGameSourceGridColumnCount(sourceCount: number): number {
  return Math.min(Math.max(sourceCount, 1), MAX_GAME_SOURCE_GRID_COLUMNS)
}
