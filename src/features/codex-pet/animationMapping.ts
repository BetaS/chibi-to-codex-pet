import {
  CODEX_PET_STATES,
  type CodexPetStateId,
} from './contract'

export interface CodexPetAnimationMapping {
  readonly animationName: string
  readonly mirrorX: boolean
}

export type CodexPetAnimationMappings = Record<
  CodexPetStateId,
  CodexPetAnimationMapping
>

export function resolveCodexPetMirrorX(
  globalMirrorX: boolean,
  stateMirrorX: boolean,
): boolean {
  return globalMirrorX !== stateMirrorX
}

export type CodexPetAnimationMappingErrorCode = 'ANIMATION_MISSING'

export class CodexPetAnimationMappingError extends Error {
  readonly code: CodexPetAnimationMappingErrorCode

  constructor(message: string) {
    super(message)
    this.name = 'CodexPetAnimationMappingError'
    this.code = 'ANIMATION_MISSING'
  }
}

interface AnimationCandidate {
  readonly animationName: string
  readonly index: number
  readonly normalized: string
  readonly tokens: ReadonlySet<string>
}

interface StateRecommendationRule {
  readonly directTokens: readonly (readonly string[])[]
  readonly fallbackTokens: readonly (readonly string[])[]
  readonly preferredNames: readonly string[]
}

type RecommendedStateId = Exclude<CodexPetStateId, 'running-left'>

const STATE_RULES: Readonly<
  Record<RecommendedStateId, StateRecommendationRule>
> = {
  idle: {
    directTokens: [['idle'], ['rest'], ['stand'], ['breath']],
    fallbackTokens: [['default'], ['neutral']],
    preferredNames: ['w_happy_idle01_f'],
  },
  'running-right': {
    directTokens: [
      ['running', 'right'],
      ['run', 'right'],
      ['walking', 'right'],
      ['walk', 'right'],
      ['walk'],
      ['run'],
    ],
    fallbackTokens: [['move']],
    preferredNames: ['w_normal_walk01_f'],
  },
  waving: {
    directTokens: [['waving'], ['wave'], ['greeting'], ['greet']],
    fallbackTokens: [['joy'], ['cheer'], ['laugh']],
    preferredNames: ['w_cute_joy01_f'],
  },
  jumping: {
    directTokens: [['jumping'], ['jump'], ['leap'], ['hop']],
    fallbackTokens: [['surprise'], ['excited']],
    preferredNames: ['z_test_f_negi01', 'w_happy_surprise01_f'],
  },
  failed: {
    directTokens: [['failed'], ['fail'], ['failure'], ['error']],
    fallbackTokens: [['sad'], ['deflated'], ['angry']],
    preferredNames: ['w_happy_sad01_f'],
  },
  waiting: {
    directTokens: [['waiting'], ['wait']],
    fallbackTokens: [['listen'], ['ask'], ['talk']],
    preferredNames: ['w_happy_listen01_f'],
  },
  running: {
    directTokens: [
      ['running'],
      ['run'],
      ['working'],
      ['work'],
      ['processing'],
      ['process'],
      ['thinking'],
      ['think'],
    ],
    fallbackTokens: [['doubt'], ['focus'], ['scan']],
    preferredNames: ['w_happy_doubt01_f'],
  },
  review: {
    directTokens: [
      ['review'],
      ['reviewing'],
      ['inspect'],
      ['checking'],
      ['check'],
    ],
    fallbackTokens: [['doubt'], ['focus'], ['think']],
    preferredNames: ['w_happy_doubt02_f'],
  },
}

function normalizeAnimationName(animationName: string): string {
  return animationName
    .normalize('NFKD')
    .replace(/([a-z])([A-Z])/g, '$1_$2')
    .toLocaleLowerCase('en-US')
    .replace(/[^a-z0-9]+/g, '_')
    .replace(/^_+|_+$/g, '')
}

function tokenizeAnimationName(normalized: string): ReadonlySet<string> {
  const tokens = normalized.split('_').filter(Boolean)
  return new Set(
    tokens.flatMap((token) => {
      const withoutNumber = token.replace(/\d+$/g, '')
      return withoutNumber && withoutNumber !== token
        ? [token, withoutNumber]
        : [token]
    }),
  )
}

function hasAllTokens(
  candidate: AnimationCandidate,
  requiredTokens: readonly string[],
): boolean {
  return requiredTokens.every((token) => candidate.tokens.has(token))
}

function candidateRank(
  candidate: AnimationCandidate,
  requiredTokens: readonly string[],
  preferredNames: readonly string[],
): readonly number[] {
  const canonicalName = requiredTokens.join('_')
  const preferredIndex = preferredNames.indexOf(candidate.normalized)
  const isExactSemanticName = candidate.normalized === canonicalName
  const isPreferredName = preferredIndex !== -1
  const isFrontFacing = !candidate.normalized.endsWith('_b')
  const isFeminine = candidate.normalized.startsWith('w_')

  return [
    isExactSemanticName ? 1 : 0,
    isPreferredName ? 1 : 0,
    isPreferredName ? preferredNames.length - preferredIndex : 0,
    isFrontFacing ? 1 : 0,
    isFeminine ? 1 : 0,
    -candidate.tokens.size,
    -candidate.index,
  ]
}

function compareRank(left: readonly number[], right: readonly number[]): number {
  for (let index = 0; index < left.length; index += 1) {
    const difference = (right[index] ?? 0) - (left[index] ?? 0)
    if (difference !== 0) {
      return difference
    }
  }
  return 0
}

function selectCandidate(
  candidates: readonly AnimationCandidate[],
  tokenPriorities: readonly (readonly string[])[],
  preferredNames: readonly string[],
): AnimationCandidate | undefined {
  for (const requiredTokens of tokenPriorities) {
    const matchingCandidates = candidates.filter((candidate) =>
      hasAllTokens(candidate, requiredTokens),
    )
    if (matchingCandidates.length > 0) {
      return matchingCandidates.reduce((best, candidate) =>
        compareRank(
          candidateRank(candidate, requiredTokens, preferredNames),
          candidateRank(best, requiredTokens, preferredNames),
        ) < 0
          ? candidate
          : best,
      )
    }
  }
  return undefined
}

function recommendStateAnimation(
  state: RecommendedStateId,
  candidates: readonly AnimationCandidate[],
): string | undefined {
  const rule = STATE_RULES[state]
  const preferredCandidate = rule.preferredNames
    .map((preferredName) =>
      candidates.find((candidate) => candidate.normalized === preferredName),
    )
    .find((candidate) => candidate !== undefined)

  return (
    preferredCandidate ??
    selectCandidate(candidates, rule.directTokens, rule.preferredNames) ??
    selectCandidate(candidates, rule.fallbackTokens, rule.preferredNames)
  )?.animationName
}

function findPoseDefault(
  candidates: readonly AnimationCandidate[],
): string | undefined {
  return candidates.find(
    (candidate) => candidate.normalized === 'pose_default',
  )?.animationName
}

export function recommendCodexPetMappings(
  animationNames: readonly string[],
): CodexPetAnimationMappings {
  const candidates = animationNames
    .map((animationName, index): AnimationCandidate => {
      const normalized = normalizeAnimationName(animationName)
      return {
        animationName,
        index,
        normalized,
        tokens: tokenizeAnimationName(normalized),
      }
    })
    .filter((candidate) => candidate.normalized.length > 0)

  if (candidates.length === 0) {
    throw new CodexPetAnimationMappingError(
      '사용할 수 있는 LiveSD animation이 없습니다.',
    )
  }

  const firstAnimation = candidates[0].animationName
  const poseDefault = findPoseDefault(candidates)
  const idleAnimation =
    recommendStateAnimation('idle', candidates) ?? poseDefault ?? firstAnimation
  const runningRightAnimation =
    recommendStateAnimation('running-right', candidates) ??
    poseDefault ??
    idleAnimation ??
    firstAnimation

  const mappings = {} as CodexPetAnimationMappings
  for (const state of CODEX_PET_STATES) {
    if (state.id === 'running-left') {
      mappings[state.id] = {
        animationName: runningRightAnimation,
        mirrorX: true,
      }
      continue
    }

    const animationName =
      state.id === 'idle'
        ? idleAnimation
        : state.id === 'running-right'
          ? runningRightAnimation
          : (recommendStateAnimation(state.id, candidates) ??
            poseDefault ??
            idleAnimation ??
            firstAnimation)

    mappings[state.id] = { animationName, mirrorX: false }
  }

  return mappings
}
