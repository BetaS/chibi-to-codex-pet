import { describe, expect, it } from 'vitest'

import {
  compareGarupaCharacterSectionPlacements,
  garupaCharacterSectionPlacement,
} from './characterSections'

describe('Garupa character sections', () => {
  it('known bandId를 공식 band와 roster 순서로 투영한다', () => {
    const inputs = [
      { bandId: 45, characterId: 36, kind: 'unique' as const },
      { bandId: 3, characterId: 11, kind: 'unique' as const },
      { bandId: 18, characterId: 31, kind: 'unique' as const },
      { bandId: 5, characterId: 21, kind: 'unique' as const },
      { bandId: 4, characterId: 17, kind: 'unique' as const },
      { bandId: 2, characterId: 6, kind: 'unique' as const },
      { bandId: 21, characterId: 26, kind: 'unique' as const },
      { bandId: 1, characterId: 2, kind: 'unique' as const },
      { bandId: 1, characterId: 1, kind: 'unique' as const },
    ]

    const placements = inputs
      .map((input) => garupaCharacterSectionPlacement(input, 'ko'))
      .sort(compareGarupaCharacterSectionPlacements)

    expect(placements.map(({ group }) => group.key)).toEqual([
      'poppin-party',
      'poppin-party',
      'afterglow',
      'pastel-palettes',
      'roselia',
      'hello-happy-world',
      'morfonica',
      'raise-a-suilen',
      'mygo',
    ])
    expect(placements.slice(0, 2).map(({ rosterOrder }) => rosterOrder)).toEqual([
      0,
      1,
    ])
  })

  it('unknown band, Mob과 미매핑을 locale별 기타 section에 보존한다', () => {
    const unknown = garupaCharacterSectionPlacement({
      bandId: 999,
      characterId: 77,
      kind: 'unique',
    }, 'en')
    const mob = garupaCharacterSectionPlacement({
      bandId: 3,
      characterId: 601,
      kind: 'mob',
    }, 'ko')
    const unmapped = garupaCharacterSectionPlacement({
      bandId: null,
      characterId: null,
      kind: 'unmapped',
    }, 'ja')

    expect(unknown.group).toMatchObject({ key: 'other', label: 'Other' })
    expect(mob.group).toMatchObject({ key: 'other', label: '기타' })
    expect(unmapped.group).toMatchObject({ key: 'other', label: 'その他' })
    expect(mob.rosterOrder).toBeLessThan(unmapped.rosterOrder)
    expect(Object.isFrozen(mob)).toBe(true)
    expect(Object.isFrozen(mob.group)).toBe(true)
  })

  it('section alias를 searchable group metadata로 제공한다', () => {
    const poppinParty = garupaCharacterSectionPlacement({
      bandId: 1,
      characterId: 1,
      kind: 'unique',
    }, 'ko')

    expect(poppinParty.group).toMatchObject({
      key: 'poppin-party',
      label: "Poppin'Party",
      searchTerms: ['popipa', '포피파'],
    })
  })
})
