import { describe, expect, it } from 'vitest'

import { translateMessage } from '../../i18n'
import { getCodexPetStateCopy } from './stateCopy'

describe('Codex Pet localized state copy', () => {
  it('stable state ID를 locale별 label과 description으로 변환한다', () => {
    expect(getCodexPetStateCopy(
      'jumping',
      (key, values) => translateMessage('en', key, values),
    )).toEqual({
      label: 'Pointer hover',
      description: 'Reaction played while the pointer is over the Pet',
    })
    expect(getCodexPetStateCopy(
      'jumping',
      (key, values) => translateMessage('ja', key, values),
    ).label).toBe('マウスオーバー')
  })
})
