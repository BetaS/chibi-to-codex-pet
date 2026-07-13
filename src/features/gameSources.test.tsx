import { describe, expect, it } from 'vitest'

import {
  createGameSources,
  GAME_SOURCES,
  getAvailableGameSource,
} from './gameSources'

describe('game source registry', () => {
  it('프로세카, STRR와 Garupa를 integration과 함께 available로 등록한다', () => {
    expect(GAME_SOURCES.map(({ id, labelKey, status }) => ({ id, labelKey, status })))
      .toEqual([
        { id: 'prsk', labelKey: 'game.prsk', status: 'available' },
        { id: 'strr', labelKey: 'game.strr', status: 'available' },
        { id: 'garupa', labelKey: 'game.garupa', status: 'available' },
      ])
    expect(getAvailableGameSource('prsk')?.integration).toBeTypeOf('function')
    expect(getAvailableGameSource('strr')?.integration).toBeTypeOf('function')
    expect(getAvailableGameSource('garupa')?.integration).toBeTypeOf('function')
  })

  it('실행 가능한 integration이 없으면 해당 게임을 선택 불가로 유지한다', () => {
    const sources = createGameSources(null, null)
    expect(sources.map(({ id, status }) => ({ id, status }))).toEqual([
      { id: 'prsk', status: 'available' },
      { id: 'strr', status: 'coming-soon' },
      { id: 'garupa', status: 'coming-soon' },
    ])
  })
})
