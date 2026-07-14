import type { PrskRemoteCharacterOption } from './types'
import type { AppLocale } from '../../../../i18n'

const CANONICAL_MODEL_ID = /^sd_([^_]+)_(.+)$/u
const NUMBERED_FAMILY_MODEL_ID = /^sd_(mob|staff)(\d+)$/u

type PrskLocalizedCharacterName = Readonly<Record<AppLocale, string>>

export const PRSK_CANONICAL_CHARACTER_TOKENS = Object.freeze([
  'airi',
  'akito',
  'an',
  'ena',
  'emu',
  'haruka',
  'honami',
  'ichika',
  'kaito',
  'kanade',
  'kohane',
  'len',
  'luka',
  'mafuyu',
  'meiko',
  'miku',
  'minori',
  'mizuki',
  'nene',
  'rin',
  'rui',
  'saki',
  'shiho',
  'shizuku',
  'toya',
  'tsukasa',
] as const)

type PrskCanonicalCharacterToken =
  (typeof PRSK_CANONICAL_CHARACTER_TOKENS)[number]

export const PRSK_CHARACTER_UNIT_ORDER = Object.freeze([
  'leo-need',
  'more-more-jump',
  'vivid-bad-squad',
  'wonderlands-showtime',
  'nightcord',
  'virtual-singer',
  'other',
] as const)

export type PrskCharacterUnitKey =
  (typeof PRSK_CHARACTER_UNIT_ORDER)[number]

const PRSK_CHARACTER_UNIT_ORDER_INDEX = Object.freeze({
  'leo-need': 0,
  'more-more-jump': 1,
  'vivid-bad-squad': 2,
  'wonderlands-showtime': 3,
  nightcord: 4,
  'virtual-singer': 5,
  other: 6,
} as const satisfies Readonly<Record<PrskCharacterUnitKey, number>>)

const PRSK_CHARACTER_PLACEMENTS = Object.freeze({
  ichika: ['leo-need', 0],
  saki: ['leo-need', 1],
  honami: ['leo-need', 2],
  shiho: ['leo-need', 3],
  minori: ['more-more-jump', 0],
  haruka: ['more-more-jump', 1],
  airi: ['more-more-jump', 2],
  shizuku: ['more-more-jump', 3],
  kohane: ['vivid-bad-squad', 0],
  an: ['vivid-bad-squad', 1],
  akito: ['vivid-bad-squad', 2],
  toya: ['vivid-bad-squad', 3],
  tsukasa: ['wonderlands-showtime', 0],
  emu: ['wonderlands-showtime', 1],
  nene: ['wonderlands-showtime', 2],
  rui: ['wonderlands-showtime', 3],
  kanade: ['nightcord', 0],
  mafuyu: ['nightcord', 1],
  ena: ['nightcord', 2],
  mizuki: ['nightcord', 3],
  miku: ['virtual-singer', 0],
  rin: ['virtual-singer', 1],
  len: ['virtual-singer', 2],
  luka: ['virtual-singer', 3],
  meiko: ['virtual-singer', 4],
  kaito: ['virtual-singer', 5],
} as const satisfies Readonly<
  Record<
    PrskCanonicalCharacterToken,
    readonly [Exclude<PrskCharacterUnitKey, 'other'>, number]
  >
>)

const PRSK_CANONICAL_CHARACTER_TOKEN_ALIASES = Object.freeze({
  touya: 'toya',
} as const satisfies Readonly<Record<string, PrskCanonicalCharacterToken>>)

const PRSK_OFFICIAL_UNIT_NAMES = Object.freeze({
  'leo-need': {
    ko: 'Leo/need',
    en: 'Leo/need',
    ja: 'Leo/need',
    'zh-CN': 'Leo/need',
  },
  'more-more-jump': {
    ko: 'MORE MORE JUMP!',
    en: 'MORE MORE JUMP!',
    ja: 'MORE MORE JUMP！',
    'zh-CN': 'MORE MORE JUMP!',
  },
  'vivid-bad-squad': {
    ko: 'Vivid BAD SQUAD',
    en: 'Vivid BAD SQUAD',
    ja: 'Vivid BAD SQUAD',
    'zh-CN': 'Vivid BAD SQUAD',
  },
  'wonderlands-showtime': {
    ko: '원더랜즈×쇼타임',
    en: 'Wonderlands×Showtime',
    ja: 'ワンダーランズ×ショウタイム',
    'zh-CN': 'Wonderlands×Showtime',
  },
  nightcord: {
    ko: '25시, 나이트 코드에서.',
    en: 'Nightcord at 25:00',
    ja: '25時、ナイトコードで。',
    'zh-CN': '25点，Nightcord见。',
  },
  'virtual-singer': {
    ko: '버추얼 싱어',
    en: 'VIRTUAL SINGER',
    ja: 'バーチャル・シンガー',
    'zh-CN': 'VIRTUAL SINGER',
  },
  other: {
    ko: '기타',
    en: 'Other',
    ja: 'その他',
    'zh-CN': '其他',
  },
} as const satisfies Readonly<
  Record<PrskCharacterUnitKey, PrskLocalizedCharacterName>
>)

const PRSK_CHARACTER_UNIT_SEARCH_TERMS = Object.freeze({
  'leo-need': Object.freeze(['leoneed', 'ln']),
  'more-more-jump': Object.freeze(['mmj']),
  'vivid-bad-squad': Object.freeze(['vbs']),
  'wonderlands-showtime': Object.freeze(['wxs', 'wls']),
  nightcord: Object.freeze(['25', 'n25']),
  'virtual-singer': Object.freeze(['vs', '버싱']),
  other: Object.freeze(['etc']),
} as const satisfies Readonly<
  Record<PrskCharacterUnitKey, readonly string[]>
>)

const PRSK_OFFICIAL_CHARACTER_NAMES = {
  airi: {
    ko: '모모이 아이리',
    en: 'Airi Momoi',
    ja: '桃井愛莉',
    'zh-CN': '桃井爱莉',
  },
  akito: {
    ko: '시노노메 아키토',
    en: 'Akito Shinonome',
    ja: '東雲彰人',
    'zh-CN': '东云彰人',
  },
  an: {
    ko: '시라이시 안',
    en: 'An Shiraishi',
    ja: '白石杏',
    'zh-CN': '白石杏',
  },
  ena: {
    ko: '시노노메 에나',
    en: 'Ena Shinonome',
    ja: '東雲絵名',
    'zh-CN': '东云绘名',
  },
  emu: {
    ko: '오오토리 에무',
    en: 'Emu Otori',
    ja: '鳳えむ',
    'zh-CN': '凤笑梦',
  },
  haruka: {
    ko: '키리타니 하루카',
    en: 'Haruka Kiritani',
    ja: '桐谷遥',
    'zh-CN': '桐谷遥',
  },
  honami: {
    ko: '모치즈키 호나미',
    en: 'Honami Mochizuki',
    ja: '望月穂波',
    'zh-CN': '望月穗波',
  },
  ichika: {
    ko: '호시노 이치카',
    en: 'Ichika Hoshino',
    ja: '星乃一歌',
    'zh-CN': '星乃一歌',
  },
  kaito: {
    ko: 'KAITO',
    en: 'KAITO',
    ja: 'KAITO',
    'zh-CN': 'KAITO',
  },
  kanade: {
    ko: '요이사키 카나데',
    en: 'Kanade Yoisaki',
    ja: '宵崎奏',
    'zh-CN': '宵崎奏',
  },
  kohane: {
    ko: '아즈사와 코하네',
    en: 'Kohane Azusawa',
    ja: '小豆沢こはね',
    'zh-CN': '小豆泽心羽',
  },
  len: {
    ko: '카가미네 렌',
    en: 'Kagamine Len',
    ja: '鏡音レン',
    'zh-CN': '镜音连',
  },
  luka: {
    ko: '메구리네 루카',
    en: 'Megurine Luka',
    ja: '巡音ルカ',
    'zh-CN': '巡音流歌',
  },
  mafuyu: {
    ko: '아사히나 마후유',
    en: 'Mafuyu Asahina',
    ja: '朝比奈まふゆ',
    'zh-CN': '朝比奈真冬',
  },
  meiko: {
    ko: 'MEIKO',
    en: 'MEIKO',
    ja: 'MEIKO',
    'zh-CN': 'MEIKO',
  },
  miku: {
    ko: '하츠네 미쿠',
    en: 'Hatsune Miku',
    ja: '初音ミク',
    'zh-CN': '初音未来',
  },
  minori: {
    ko: '하나사토 미노리',
    en: 'Minori Hanasato',
    ja: '花里みのり',
    'zh-CN': '花里实乃理',
  },
  mizuki: {
    ko: '아키야마 미즈키',
    en: 'Mizuki Akiyama',
    ja: '暁山瑞希',
    'zh-CN': '晓山瑞希',
  },
  nene: {
    ko: '쿠사나기 네네',
    en: 'Nene Kusanagi',
    ja: '草薙寧々',
    'zh-CN': '草薙宁宁',
  },
  rin: {
    ko: '카가미네 린',
    en: 'Kagamine Rin',
    ja: '鏡音リン',
    'zh-CN': '镜音铃',
  },
  rui: {
    ko: '카미시로 루이',
    en: 'Rui Kamishiro',
    ja: '神代類',
    'zh-CN': '神代类',
  },
  saki: {
    ko: '텐마 사키',
    en: 'Saki Tenma',
    ja: '天馬咲希',
    'zh-CN': '天马咲希',
  },
  shiho: {
    ko: '히노모리 시호',
    en: 'Shiho Hinomori',
    ja: '日野森志歩',
    'zh-CN': '日野森志步',
  },
  shizuku: {
    ko: '히노모리 시즈쿠',
    en: 'Shizuku Hinomori',
    ja: '日野森雫',
    'zh-CN': '日野森雫',
  },
  toya: {
    ko: '아오야기 토우야',
    en: 'Toya Aoyagi',
    ja: '青柳冬弥',
    'zh-CN': '青柳冬弥',
  },
  tsukasa: {
    ko: '텐마 츠카사',
    en: 'Tsukasa Tenma',
    ja: '天馬司',
    'zh-CN': '天马司',
  },
} as const satisfies Readonly<
  Record<PrskCanonicalCharacterToken, PrskLocalizedCharacterName>
>

export interface PrskRemoteModelChoice {
  readonly defaultDisplayName: string
  readonly id: string
  readonly label: string
}

export interface PrskRemoteCharacterGroup {
  readonly key: string
  readonly label: string
  readonly models: readonly PrskRemoteModelChoice[]
  readonly section: PrskCharacterUnitSection
}

export interface PrskCharacterUnitSection {
  readonly key: PrskCharacterUnitKey
  readonly label: string
}

export function prskCharacterUnitSearchTerms(
  unit: PrskCharacterUnitKey,
): readonly string[] {
  return PRSK_CHARACTER_UNIT_SEARCH_TERMS[unit]
}

export interface PrskRemoteModelSelection {
  readonly character: PrskRemoteCharacterGroup
  readonly model: PrskRemoteModelChoice
}

interface MutableCharacterGroup {
  readonly key: string
  readonly label: string
  readonly models: Array<{
    readonly id: string
    readonly label: string
  }>
  readonly rosterOrder: number
  readonly sectionKey: PrskCharacterUnitKey
}

function compareText(left: string, right: string): number {
  if (left < right) return -1
  if (left > right) return 1
  return 0
}

function humanizeToken(value: string, stripLeadingOrdinal = false): string {
  const normalized = stripLeadingOrdinal
    ? value.replace(/^\d+(?=[A-Za-z])/u, '')
    : value
  const words = normalized
    .replace(/[._-]+/gu, ' ')
    .replace(/([A-Za-z])(\d)/gu, '$1 $2')
    .trim()
    .split(/\s+/u)
    .filter(Boolean)

  const label = words
    .map((word) => `${word.charAt(0).toLocaleUpperCase('en-US')}${word.slice(1)}`)
    .join(' ')
  return label || value
}

function canonicalCharacterToken(
  characterToken: string,
): PrskCanonicalCharacterToken | null {
  const normalizedToken = characterToken
    .replace(/^\d+/u, '')
    .toLocaleLowerCase('en-US')
  if (Object.hasOwn(PRSK_OFFICIAL_CHARACTER_NAMES, normalizedToken)) {
    return normalizedToken as PrskCanonicalCharacterToken
  }
  return PRSK_CANONICAL_CHARACTER_TOKEN_ALIASES[
    normalizedToken as keyof typeof PRSK_CANONICAL_CHARACTER_TOKEN_ALIASES
  ] ?? null
}

function localizedCharacterLabel(
  characterToken: string,
  locale: AppLocale,
): string {
  const canonicalToken = canonicalCharacterToken(characterToken)
  const officialNames = canonicalToken
    ? PRSK_OFFICIAL_CHARACTER_NAMES[canonicalToken]
    : undefined
  return officialNames?.[locale] ?? humanizeToken(characterToken, true)
}

function singletonCharacterLabel(id: string): string {
  return humanizeToken(id.startsWith('sd_') ? id.slice(3) : id, true)
}

function otherGroupOrder(key: string): number {
  if (key === 'character:mob') return 0
  if (key === 'character:staff') return 1
  return 2
}

export function groupPrskRemoteCharacterModels(
  options: readonly PrskRemoteCharacterOption[],
  locale: AppLocale,
): readonly PrskRemoteCharacterGroup[] {
  const groups = new Map<string, MutableCharacterGroup>()

  for (const option of options) {
    const match = CANONICAL_MODEL_ID.exec(option.id)
    const characterToken = match?.[1]
    const numberedFamilyMatch = NUMBERED_FAMILY_MODEL_ID.exec(option.id)
    const numberedFamilyToken = numberedFamilyMatch?.[1]
    const modelToken = match?.[2] ?? numberedFamilyMatch?.[2]
    const canonicalToken = characterToken
      ? canonicalCharacterToken(characterToken)
      : null
    const placement = canonicalToken
      ? PRSK_CHARACTER_PLACEMENTS[canonicalToken]
      : null
    const sectionKey = placement?.[0] ?? 'other'
    const rosterOrder = placement?.[1] ?? Number.MAX_SAFE_INTEGER
    const key = characterToken && modelToken
      ? `character:${characterToken}`
      : numberedFamilyToken && modelToken
        ? `character:${numberedFamilyToken}`
        : `model:${option.id}`
    const characterLabel = characterToken && modelToken
      ? localizedCharacterLabel(characterToken, locale)
      : numberedFamilyToken && modelToken
        ? humanizeToken(numberedFamilyToken)
        : singletonCharacterLabel(option.id)
    const modelLabel = option.label !== option.id
      ? option.label
      : modelToken
        ? humanizeToken(modelToken)
        : option.id
    const current = groups.get(key)
    if (current) {
      current.models.push({ id: option.id, label: modelLabel })
    } else {
      groups.set(key, {
        key,
        label: characterLabel,
        models: [{ id: option.id, label: modelLabel }],
        rosterOrder,
        sectionKey,
      })
    }
  }

  return Object.freeze(
    Array.from(groups.values())
      .sort((left, right) => {
        const sectionOrder =
          PRSK_CHARACTER_UNIT_ORDER_INDEX[left.sectionKey] -
          PRSK_CHARACTER_UNIT_ORDER_INDEX[right.sectionKey]
        if (sectionOrder !== 0) return sectionOrder
        if (left.sectionKey !== 'other') {
          const rosterOrder = left.rosterOrder - right.rosterOrder
          if (rosterOrder !== 0) return rosterOrder
        } else {
          const familyOrder =
            otherGroupOrder(left.key) - otherGroupOrder(right.key)
          if (familyOrder !== 0) return familyOrder
        }
        return (
          compareText(left.label, right.label) ||
          compareText(left.key, right.key)
        )
      })
      .map((group) => {
        const models = Object.freeze(
          group.models.map((model) => Object.freeze({
            ...model,
            defaultDisplayName: `${model.label} - ${group.label}`,
          })),
        )
        return Object.freeze({
          key: group.key,
          label: group.label,
          models,
          section: Object.freeze({
            key: group.sectionKey,
            label: PRSK_OFFICIAL_UNIT_NAMES[group.sectionKey][locale],
          }),
        })
      }),
  )
}

export function findPrskRemoteModelSelection(
  groups: readonly PrskRemoteCharacterGroup[],
  modelId: string,
): PrskRemoteModelSelection | null {
  for (const character of groups) {
    const model = character.models.find((candidate) => candidate.id === modelId)
    if (model) {
      return Object.freeze({ character, model })
    }
  }
  return null
}
