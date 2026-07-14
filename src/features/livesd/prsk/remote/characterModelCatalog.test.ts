import { describe, expect, it } from 'vitest'

import {
  findPrskRemoteModelSelection,
  groupPrskRemoteCharacterModels,
  PRSK_CANONICAL_CHARACTER_TOKENS,
  PRSK_CHARACTER_UNIT_ORDER,
} from './characterModelCatalog'

describe('PRSK character-model catalog projection', () => {
  it('공식 roster의 canonical token 26개를 중복 없이 고정한다', () => {
    expect(PRSK_CANONICAL_CHARACTER_TOKENS).toHaveLength(26)
    expect(new Set(PRSK_CANONICAL_CHARACTER_TOKENS).size).toBe(26)
    expect(Object.isFrozen(PRSK_CANONICAL_CHARACTER_TOKENS)).toBe(true)
    expect(PRSK_CHARACTER_UNIT_ORDER).toEqual([
      'leo-need',
      'more-more-jump',
      'vivid-bad-squad',
      'wonderlands-showtime',
      'nightcord',
      'virtual-singer',
      'other',
    ])
    expect(Object.isFrozen(PRSK_CHARACTER_UNIT_ORDER)).toBe(true)
  })

  it('canonical leaf를 캐릭터별로 묶고 multi-part suffix를 모델 이름으로 만든다', () => {
    const groups = groupPrskRemoteCharacterModels(
      [
        { id: 'sd_21miku_street_live', label: 'sd_21miku_street_live' },
        { id: 'sd_01ichika_normal', label: 'sd_01ichika_normal' },
        { id: 'sd_21miku_normal', label: 'sd_21miku_normal' },
      ],
      'en',
    )

    expect(groups).toEqual([
      {
        key: 'character:01ichika',
        label: 'Ichika Hoshino',
        models: [{
          defaultDisplayName: 'Normal - Ichika Hoshino',
          id: 'sd_01ichika_normal',
          label: 'Normal',
        }],
        section: { key: 'leo-need', label: 'Leo/need' },
      },
      {
        key: 'character:21miku',
        label: 'Hatsune Miku',
        models: [
          {
            defaultDisplayName: 'Street Live - Hatsune Miku',
            id: 'sd_21miku_street_live',
            label: 'Street Live',
          },
          {
            defaultDisplayName: 'Normal - Hatsune Miku',
            id: 'sd_21miku_normal',
            label: 'Normal',
          },
        ],
        section: { key: 'virtual-singer', label: 'VIRTUAL SINGER' },
      },
    ])
    expect(Object.isFrozen(groups)).toBe(true)
    expect(Object.isFrozen(groups[1]?.models)).toBe(true)
  })

  it('custom label을 보존하고 알려진 family가 아닌 leaf는 singleton으로 남긴다', () => {
    const groups = groupPrskRemoteCharacterModels(
      [
        { id: 'custom-model', label: 'Custom Costume' },
        { id: 'sd_alpha', label: 'sd_alpha' },
        { id: 'sd_21miku_street', label: 'Street Miku' },
      ],
      'en',
    )

    expect(groups).toEqual([
      {
        key: 'character:21miku',
        label: 'Hatsune Miku',
        models: [{
          defaultDisplayName: 'Street Miku - Hatsune Miku',
          id: 'sd_21miku_street',
          label: 'Street Miku',
        }],
        section: { key: 'virtual-singer', label: 'VIRTUAL SINGER' },
      },
      {
        key: 'model:sd_alpha',
        label: 'Alpha',
        models: [{
          defaultDisplayName: 'sd_alpha - Alpha',
          id: 'sd_alpha',
          label: 'sd_alpha',
        }],
        section: { key: 'other', label: 'Other' },
      },
      {
        key: 'model:custom-model',
        label: 'Custom Model',
        models: [{
          defaultDisplayName: 'Custom Costume - Custom Model',
          id: 'custom-model',
          label: 'Custom Costume',
        }],
        section: { key: 'other', label: 'Other' },
      },
    ])
  })

  it('번호형 mob과 staff leaf를 서로 다른 stable family group으로 묶는다', () => {
    const groups = groupPrskRemoteCharacterModels(
      [
        { id: 'sd_mob003', label: 'sd_mob003' },
        { id: 'sd_mob010', label: 'Stage Extra' },
        { id: 'sd_staff001', label: 'sd_staff001' },
        { id: 'sd_staff009', label: 'sd_staff009' },
      ],
      'ko',
    )

    expect(groups).toEqual([
      {
        key: 'character:mob',
        label: 'Mob',
        models: [
          {
            defaultDisplayName: '003 - Mob',
            id: 'sd_mob003',
            label: '003',
          },
          {
            defaultDisplayName: 'Stage Extra - Mob',
            id: 'sd_mob010',
            label: 'Stage Extra',
          },
        ],
        section: { key: 'other', label: '기타' },
      },
      {
        key: 'character:staff',
        label: 'Staff',
        models: [
          {
            defaultDisplayName: '001 - Staff',
            id: 'sd_staff001',
            label: '001',
          },
          {
            defaultDisplayName: '009 - Staff',
            id: 'sd_staff009',
            label: '009',
          },
        ],
        section: { key: 'other', label: '기타' },
      },
    ])
    expect(findPrskRemoteModelSelection(groups, 'sd_staff009')).toEqual({
      character: groups[1],
      model: groups[1]?.models[1],
    })
  })

  it('mob·staff exact pattern과 다른 singleton은 family로 추측하지 않는다', () => {
    const groups = groupPrskRemoteCharacterModels(
      [
        { id: 'sd_mob003_extra', label: 'sd_mob003_extra' },
        { id: 'sd_staff', label: 'sd_staff' },
      ],
      'en',
    )

    expect(groups.map(({ key, label }) => ({ key, label }))).toEqual([
      { key: 'character:mob003', label: 'Mob 003' },
      { key: 'model:sd_staff', label: 'Staff' },
    ])
  })

  it('canonical model ID로 상위 캐릭터와 기본 이름을 함께 찾는다', () => {
    const groups = groupPrskRemoteCharacterModels(
      [
        { id: 'sd_21miku_normal', label: 'Normal' },
        { id: 'sd_21miku_street', label: 'Street' },
      ],
      'en',
    )

    expect(findPrskRemoteModelSelection(groups, 'sd_21miku_street')).toEqual({
      character: groups[0],
      model: {
        defaultDisplayName: 'Street - Hatsune Miku',
        id: 'sd_21miku_street',
        label: 'Street',
      },
    })
    expect(findPrskRemoteModelSelection(groups, 'sd_missing')).toBeNull()
  })

  it.each([
    ['ko', '하츠네 미쿠', '버추얼 싱어'],
    ['en', 'Hatsune Miku', 'VIRTUAL SINGER'],
    ['ja', '初音ミク', 'バーチャル・シンガー'],
    ['zh-CN', '初音未来', 'VIRTUAL SINGER'],
  ] as const)('%s locale의 공식 이름과 기본 Pet 이름을 만든다', (
    locale,
    expectedName,
    expectedUnitName,
  ) => {
    const groups = groupPrskRemoteCharacterModels(
      [{ id: 'sd_21miku_normal', label: 'Normal' }],
      locale,
    )

    expect(groups[0]).toMatchObject({
      key: 'character:21miku',
      label: expectedName,
      models: [{
        defaultDisplayName: `Normal - ${expectedName}`,
        id: 'sd_21miku_normal',
      }],
      section: {
        key: 'virtual-singer',
        label: expectedUnitName,
      },
    })
    expect(Object.isFrozen(groups)).toBe(true)
    expect(Object.isFrozen(groups[0])).toBe(true)
    expect(Object.isFrozen(groups[0]?.models)).toBe(true)
    expect(Object.isFrozen(groups[0]?.models[0])).toBe(true)
    expect(Object.isFrozen(groups[0]?.section)).toBe(true)
  })

  it.each([
    ['ko', '시노노메 아키토'],
    ['en', 'Akito Shinonome'],
    ['ja', '東雲彰人'],
    ['zh-CN', '东云彰人'],
  ] as const)('실제 11akito leaf를 %s 공식 이름으로 투영한다', (
    locale,
    expectedName,
  ) => {
    const groups = groupPrskRemoteCharacterModels(
      [{ id: 'sd_11akito_normal', label: 'sd_11akito_normal' }],
      locale,
    )

    expect(groups).toEqual([{
      key: 'character:11akito',
      label: expectedName,
      models: [{
        defaultDisplayName: `Normal - ${expectedName}`,
        id: 'sd_11akito_normal',
        label: 'Normal',
      }],
      section: { key: 'vivid-bad-squad', label: 'Vivid BAD SQUAD' },
    }])
  })

  it('provider의 touya token을 canonical Toya 공식 이름으로 정규화한다', () => {
    const groups = groupPrskRemoteCharacterModels(
      [{ id: 'sd_12touya_unit', label: 'sd_12touya_unit' }],
      'en',
    )

    expect(groups[0]).toMatchObject({
      key: 'character:12touya',
      label: 'Toya Aoyagi',
      models: [{
        defaultDisplayName: 'Unit - Toya Aoyagi',
        id: 'sd_12touya_unit',
        label: 'Unit',
      }],
      section: { key: 'vivid-bad-squad', label: 'Vivid BAD SQUAD' },
    })
  })

  it('공식 unit과 roster 순서로 정렬하고 VIRTUAL SINGER를 독립 section으로 둔다', () => {
    const expectedRoster = [
      ['leo-need', '01ichika'],
      ['leo-need', '02saki'],
      ['leo-need', '03honami'],
      ['leo-need', '04shiho'],
      ['more-more-jump', '05minori'],
      ['more-more-jump', '06haruka'],
      ['more-more-jump', '07airi'],
      ['more-more-jump', '08shizuku'],
      ['vivid-bad-squad', '09kohane'],
      ['vivid-bad-squad', '10an'],
      ['vivid-bad-squad', '11akito'],
      ['vivid-bad-squad', '12touya'],
      ['wonderlands-showtime', '13tsukasa'],
      ['wonderlands-showtime', '14emu'],
      ['wonderlands-showtime', '15nene'],
      ['wonderlands-showtime', '16rui'],
      ['nightcord', '17kanade'],
      ['nightcord', '18mafuyu'],
      ['nightcord', '19ena'],
      ['nightcord', '20mizuki'],
      ['virtual-singer', '21miku'],
      ['virtual-singer', '22rin'],
      ['virtual-singer', '23len'],
      ['virtual-singer', '24luka'],
      ['virtual-singer', '25meiko'],
      ['virtual-singer', '26kaito'],
    ] as const
    const groups = groupPrskRemoteCharacterModels(
      [...expectedRoster].reverse().map(([, token]) => ({
        id: `sd_${token}_normal`,
        label: `sd_${token}_normal`,
      })),
      'en',
    )

    expect(groups.map(({ key, section }) => ({
      character: key,
      unit: section.key,
    }))).toEqual(expectedRoster.map(([unit, token]) => ({
      character: `character:${token}`,
      unit,
    })))
    expect([...new Set(groups.map(({ section }) => section.key))]).toEqual(
      PRSK_CHARACTER_UNIT_ORDER.slice(0, 6),
    )
  })

  it.each([
    ['ko', '25시, 나이트 코드에서.'],
    ['en', 'Nightcord at 25:00'],
    ['ja', '25時、ナイトコードで。'],
    ['zh-CN', '25点，Nightcord见。'],
  ] as const)('%s locale의 Nightcord section label을 투영한다', (
    locale,
    expectedUnitName,
  ) => {
    const groups = groupPrskRemoteCharacterModels(
      [{ id: 'sd_17kanade_normal', label: 'sd_17kanade_normal' }],
      locale,
    )

    expect(groups[0]?.section).toEqual({
      key: 'nightcord',
      label: expectedUnitName,
    })
  })
})
