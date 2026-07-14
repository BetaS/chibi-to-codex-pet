import type { AppLocale } from '../../../i18n'
import type { SearchableComboboxOption } from '../ui/SearchableCombobox'
import { localizeStrrLabels } from './staticProvider'
import type { StrrCharacter } from './types'

export const STRR_CHARACTER_SECTION_ORDER = Object.freeze([
  'seisho',
  'rinmeikan',
  'frontier',
  'siegfeld',
  'seiran',
  'other',
] as const)

export type StrrCharacterSectionKey =
  (typeof STRR_CHARACTER_SECTION_ORDER)[number]

type KnownStrrCharacterSectionKey = Exclude<
  StrrCharacterSectionKey,
  'other'
>

const SECTION_ORDER_INDEX = Object.freeze(
  Object.fromEntries(
    STRR_CHARACTER_SECTION_ORDER.map((key, index) => [key, index]),
  ) as Readonly<Record<StrrCharacterSectionKey, number>>,
)

const SECTION_ROSTERS = Object.freeze({
  seisho: Object.freeze([
    '101',
    '102',
    '103',
    '104',
    '105',
    '106',
    '107',
    '108',
    '109',
  ]),
  rinmeikan: Object.freeze(['201', '202', '203', '204', '205']),
  frontier: Object.freeze(['301', '302', '303', '304', '305']),
  siegfeld: Object.freeze([
    '401',
    '402',
    '403',
    '404',
    '405',
    '406',
    '407',
    '408',
    '409',
    '410',
  ]),
  seiran: Object.freeze(['501', '502', '503']),
} as const satisfies Readonly<
  Record<KnownStrrCharacterSectionKey, readonly string[]>
>)

const SECTION_LABELS = Object.freeze({
  seisho: {
    ko: '세이쇼 음악학교',
    en: 'Seisho Music Academy',
    ja: '聖翔音楽学園',
    'zh-CN': '聖翔音樂學院',
  },
  rinmeikan: {
    ko: '린메이칸 여학교',
    en: 'Rinmeikan Girls School',
    ja: '凛明館女学校',
    'zh-CN': '凜明館女子學校',
  },
  frontier: {
    ko: '프론티어 예술학교',
    en: 'Frontier School of Arts',
    ja: 'フロンティア芸術学校',
    'zh-CN': '芙羅提亞藝術學校',
  },
  siegfeld: {
    ko: '시크펠트 음악학원',
    en: 'Siegfeld Institute of Music',
    ja: 'シークフェルト音楽学院',
    'zh-CN': '席格菲特音樂學院',
  },
  seiran: {
    ko: '세이란 종합예술원',
    en: 'Seiran General Arts Institute',
    ja: '青嵐総合芸術院',
    'zh-CN': '青嵐綜合藝術院',
  },
  other: {
    ko: '기타',
    en: 'Other',
    ja: 'その他',
    'zh-CN': '其他',
  },
} as const satisfies Readonly<
  Record<StrrCharacterSectionKey, Readonly<Record<AppLocale, string>>>
>)

const SECTION_SEARCH_TERMS = Object.freeze({
  seisho: Object.freeze(['seisho', '세이쇼', '성상']),
  rinmeikan: Object.freeze(['rinmeikan', '린메이칸']),
  frontier: Object.freeze(['frontier', '프론티어']),
  siegfeld: Object.freeze(['siegfeld', '시크펠트']),
  seiran: Object.freeze(['seiran', '세이란']),
  other: Object.freeze(['etc', '기타']),
} as const satisfies Readonly<
  Record<StrrCharacterSectionKey, readonly string[]>
>)

interface StrrCharacterPlacement {
  readonly rosterOrder: number
  readonly sectionKey: StrrCharacterSectionKey
}

function characterPlacement(characterId: string): StrrCharacterPlacement {
  for (const sectionKey of STRR_CHARACTER_SECTION_ORDER) {
    if (sectionKey === 'other') continue
    const rosterOrder = SECTION_ROSTERS[sectionKey].indexOf(characterId)
    if (rosterOrder >= 0) {
      return { rosterOrder, sectionKey }
    }
  }
  return {
    rosterOrder: Number.MAX_SAFE_INTEGER,
    sectionKey: 'other',
  }
}

interface SectionedStrrCharacterOption {
  readonly option: SearchableComboboxOption
  readonly rosterOrder: number
  readonly sectionOrder: number
}

export function createStrrCharacterOptions(
  characters: readonly StrrCharacter[],
  locale: AppLocale,
): readonly SearchableComboboxOption[] {
  const sectioned: SectionedStrrCharacterOption[] = characters.map(
    (character) => {
      const placement = characterPlacement(character.id)
      return {
        option: Object.freeze({
          group: Object.freeze({
            key: placement.sectionKey,
            label: SECTION_LABELS[placement.sectionKey][locale],
            searchTerms: SECTION_SEARCH_TERMS[placement.sectionKey],
          }),
          label: localizeStrrLabels(
            character.labels,
            locale,
            `#${character.id}`,
          ),
          value: character.id,
        }),
        rosterOrder: placement.rosterOrder,
        sectionOrder: SECTION_ORDER_INDEX[placement.sectionKey],
      }
    },
  )

  sectioned.sort((left, right) => (
    left.sectionOrder - right.sectionOrder ||
    left.rosterOrder - right.rosterOrder ||
    left.option.label.localeCompare(right.option.label, locale) ||
    left.option.value.localeCompare(right.option.value, 'en')
  ))
  return Object.freeze(sectioned.map(({ option }) => option))
}
