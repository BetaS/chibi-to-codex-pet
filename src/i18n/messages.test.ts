import { describe, expect, it } from 'vitest'

import { APP_LOCALES } from './locale'
import { MESSAGE_CATALOGS, translateMessage } from './messages'

describe('translation catalog', () => {
  it('네 locale이 canonical key를 모두 같은 순서로 제공한다', () => {
    const canonicalKeys = Object.keys(MESSAGE_CATALOGS.en).sort()
    for (const locale of APP_LOCALES) {
      expect(Object.keys(MESSAGE_CATALOGS[locale]).sort()).toEqual(canonicalKeys)
    }
  })

  it('named parameter를 보간하고 누락 placeholder는 진단 가능하게 유지한다', () => {
    expect(translateMessage('ja', 'common.percentValue', { value: 125 })).toBe('125%')
    expect(translateMessage('en', 'common.percentValue')).toBe('{value}%')
  })
})
