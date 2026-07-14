import { describe, expect, it } from 'vitest'

import { filterComboboxOptions } from '../ui/searchableComboboxOptions'
import type { StrrCharacter } from './types'
import { createStrrCharacterOptions } from './characterSections'

function character(
  id: string,
  en: string,
  ko: string,
): StrrCharacter {
  return {
    id,
    labels: { en, ko },
    editions: [{
      id: `${id}0001`,
      labels: { en: 'Edition' },
      metadataSource: 'local',
      side: 'right',
    }],
  }
}

describe('STRR character sections', () => {
  it('exact canonical roster를 공식 학교와 roster 순서로 정렬한다', () => {
    const options = createStrrCharacterOptions([
      character('901', 'Sakura Shinguji', '신구지 사쿠라'),
      character('501', 'Koharu Yanagi', '야나기 코하루'),
      character('401', 'Akira Yukishiro', '유키시로 아키라'),
      character('301', 'Aruru Otsuki', '오츠키 아루루'),
      character('201', 'Tamao Tomoe', '토모에 타마오'),
      character('102', 'Hikari Kagura', '카구라 히카리'),
      character('101', 'Karen Aijo', '아이조 카렌'),
    ], 'ko')

    expect(options.map(({ value }) => value)).toEqual([
      '101',
      '102',
      '201',
      '301',
      '401',
      '501',
      '901',
    ])
    expect(options.map(({ group }) => group?.key)).toEqual([
      'seisho',
      'seisho',
      'rinmeikan',
      'frontier',
      'siegfeld',
      'seiran',
      'other',
    ])
    expect(options.map(({ group }) => group?.label)).toEqual([
      '세이쇼 음악학교',
      '세이쇼 음악학교',
      '린메이칸 여학교',
      '프론티어 예술학교',
      '시크펠트 음악학원',
      '세이란 종합예술원',
      '기타',
    ])
  })

  it('known prefix처럼 보이는 unknown ID도 기타로 보존한다', () => {
    const options = createStrrCharacterOptions([
      character('199', 'Unknown Seisho', '미분류 캐릭터'),
      character('101', 'Karen Aijo', '아이조 카렌'),
    ], 'en')

    expect(options[1]).toMatchObject({
      group: { key: 'other', label: 'Other' },
      value: '199',
    })
    expect(Object.isFrozen(options)).toBe(true)
    expect(Object.isFrozen(options[0])).toBe(true)
    expect(Object.isFrozen(options[0]?.group)).toBe(true)
  })

  it('현재 locale의 학교 label과 alias를 검색 metadata로 제공한다', () => {
    const options = createStrrCharacterOptions([
      character('101', 'Karen Aijo', '아이조 카렌'),
      character('201', 'Tamao Tomoe', '토모에 타마오'),
    ], 'ja')

    expect(options[0]?.group?.label).toBe('聖翔音楽学園')
    expect(filterComboboxOptions(options, 'seisho')).toEqual([options[0]])
    expect(filterComboboxOptions(options, '린메이칸')).toEqual([options[1]])
  })
})
