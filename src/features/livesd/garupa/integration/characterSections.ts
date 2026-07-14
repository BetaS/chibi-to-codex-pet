import type { AppLocale } from '../../../../i18n'
import type { SearchableComboboxOptionGroup } from '../../ui/SearchableCombobox'
import type { GarupaCharacterKind } from '../remote'

export const GARUPA_CHARACTER_SECTION_ORDER = Object.freeze([
  'poppin-party',
  'afterglow',
  'pastel-palettes',
  'roselia',
  'hello-happy-world',
  'morfonica',
  'raise-a-suilen',
  'mygo',
  'other',
] as const)

export type GarupaCharacterSectionKey =
  (typeof GARUPA_CHARACTER_SECTION_ORDER)[number]

type KnownGarupaCharacterSectionKey = Exclude<
  GarupaCharacterSectionKey,
  'other'
>

interface GarupaSectionInput {
  readonly bandId: number | null
  readonly characterId: number | null
  readonly kind: GarupaCharacterKind
}

export interface GarupaCharacterSectionPlacement {
  readonly group: SearchableComboboxOptionGroup
  readonly rosterOrder: number
  readonly sectionOrder: number
}

const SECTION_ORDER_INDEX = Object.freeze(
  Object.fromEntries(
    GARUPA_CHARACTER_SECTION_ORDER.map((key, index) => [key, index]),
  ) as Readonly<Record<GarupaCharacterSectionKey, number>>,
)

const SECTION_BY_BAND_ID: Readonly<
  Record<number, KnownGarupaCharacterSectionKey>
> = Object.freeze({
  1: 'poppin-party',
  2: 'afterglow',
  3: 'hello-happy-world',
  4: 'pastel-palettes',
  5: 'roselia',
  18: 'raise-a-suilen',
  21: 'morfonica',
  45: 'mygo',
})

const ROSTER_ORDER_BY_CHARACTER_ID: Readonly<Record<number, number>> =
  Object.freeze({
    1: 0,
    2: 1,
    3: 2,
    4: 3,
    5: 4,
    6: 0,
    7: 1,
    8: 2,
    9: 3,
    10: 4,
    11: 0,
    12: 1,
    13: 2,
    14: 3,
    15: 4,
    16: 0,
    17: 1,
    18: 2,
    19: 3,
    20: 4,
    21: 0,
    22: 1,
    23: 2,
    24: 3,
    25: 4,
    26: 0,
    27: 1,
    28: 2,
    29: 3,
    30: 4,
    31: 0,
    32: 1,
    33: 2,
    34: 3,
    35: 4,
    36: 0,
    37: 1,
    38: 2,
    39: 3,
    40: 4,
  })

const SECTION_LABELS = Object.freeze({
  'poppin-party': {
    ko: "Poppin'Party",
    en: "Poppin'Party",
    ja: "Poppin'Party",
    'zh-CN': "Poppin'Party",
  },
  afterglow: {
    ko: 'Afterglow',
    en: 'Afterglow',
    ja: 'Afterglow',
    'zh-CN': 'Afterglow',
  },
  'pastel-palettes': {
    ko: 'Pastel＊Palettes',
    en: 'Pastel＊Palettes',
    ja: 'Pastel＊Palettes',
    'zh-CN': 'Pastel＊Palettes',
  },
  roselia: {
    ko: 'Roselia',
    en: 'Roselia',
    ja: 'Roselia',
    'zh-CN': 'Roselia',
  },
  'hello-happy-world': {
    ko: 'Hello, Happy World!',
    en: 'Hello, Happy World!',
    ja: 'ハロー、ハッピーワールド！',
    'zh-CN': 'Hello, Happy World!',
  },
  morfonica: {
    ko: 'Morfonica',
    en: 'Morfonica',
    ja: 'Morfonica',
    'zh-CN': 'Morfonica',
  },
  'raise-a-suilen': {
    ko: 'RAISE A SUILEN',
    en: 'RAISE A SUILEN',
    ja: 'RAISE A SUILEN',
    'zh-CN': 'RAISE A SUILEN',
  },
  mygo: {
    ko: 'MyGO!!!!!',
    en: 'MyGO!!!!!',
    ja: 'MyGO!!!!!',
    'zh-CN': 'MyGO!!!!!',
  },
  other: {
    ko: '기타',
    en: 'Other',
    ja: 'その他',
    'zh-CN': '其他',
  },
} as const satisfies Readonly<
  Record<GarupaCharacterSectionKey, Readonly<Record<AppLocale, string>>>
>)

const SECTION_SEARCH_TERMS = Object.freeze({
  'poppin-party': Object.freeze(['popipa', '포피파']),
  afterglow: Object.freeze(['애프터글로우']),
  'pastel-palettes': Object.freeze(['pasupare', '파스파레']),
  roselia: Object.freeze(['로젤리아']),
  'hello-happy-world': Object.freeze(['hhw', '하로하피']),
  morfonica: Object.freeze(['monica', '모니카']),
  'raise-a-suilen': Object.freeze(['ras', '레이즈 어 스이렌']),
  mygo: Object.freeze(['마이고']),
  other: Object.freeze(['etc', '기타']),
} as const satisfies Readonly<
  Record<GarupaCharacterSectionKey, readonly string[]>
>)

function sectionKey(input: GarupaSectionInput): GarupaCharacterSectionKey {
  if (input.kind !== 'unique' || input.bandId === null) return 'other'
  return SECTION_BY_BAND_ID[input.bandId] ?? 'other'
}

function fallbackRosterOrder(input: GarupaSectionInput): number {
  if (input.kind === 'unique') {
    return input.characterId ?? Number.MAX_SAFE_INTEGER - 2
  }
  if (input.kind === 'mob') return Number.MAX_SAFE_INTEGER - 1
  return Number.MAX_SAFE_INTEGER
}

export function garupaCharacterSectionPlacement(
  input: GarupaSectionInput,
  locale: AppLocale,
): GarupaCharacterSectionPlacement {
  const key = sectionKey(input)
  const knownRosterOrder = input.characterId === null
    ? undefined
    : ROSTER_ORDER_BY_CHARACTER_ID[input.characterId]
  return Object.freeze({
    group: Object.freeze({
      key,
      label: SECTION_LABELS[key][locale],
      searchTerms: SECTION_SEARCH_TERMS[key],
    }),
    rosterOrder: key === 'other'
      ? fallbackRosterOrder(input)
      : knownRosterOrder ?? Number.MAX_SAFE_INTEGER,
    sectionOrder: SECTION_ORDER_INDEX[key],
  })
}

export function compareGarupaCharacterSectionPlacements(
  left: GarupaCharacterSectionPlacement,
  right: GarupaCharacterSectionPlacement,
): number {
  return (
    left.sectionOrder - right.sectionOrder ||
    left.rosterOrder - right.rosterOrder
  )
}
