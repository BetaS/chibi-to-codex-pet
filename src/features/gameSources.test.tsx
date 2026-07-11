import { describe, expect, it } from 'vitest'

import { GAME_SOURCES, getAvailableGameSource } from './gameSources'

describe('game source registry', () => {
  it('프로세카만 integration과 함께 available로 등록한다', () => {
    expect(GAME_SOURCES.map(({ id, labelKey, status }) => ({ id, labelKey, status })))
      .toEqual([
        { id: 'prsk', labelKey: 'game.prsk', status: 'available' },
        { id: 'strr', labelKey: 'game.strr', status: 'coming-soon' },
        { id: 'garupa', labelKey: 'game.garupa', status: 'coming-soon' },
      ])
    expect(getAvailableGameSource('prsk')?.integration).toBeTypeOf('function')
    expect(getAvailableGameSource('strr')).toBeNull()
    expect(getAvailableGameSource('garupa')).toBeNull()
  })
})
