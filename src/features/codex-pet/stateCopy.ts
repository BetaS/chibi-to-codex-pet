import type { I18nContextValue, MessageKey } from '../../i18n'
import type { CodexPetStateId } from './contract'

interface CodexPetStateCopyKeys {
  readonly description: MessageKey
  readonly label: MessageKey
}

const STATE_COPY_KEYS: Readonly<
  Record<CodexPetStateId, CodexPetStateCopyKeys>
> = {
  idle: {
    label: 'state.idle.label',
    description: 'state.idle.description',
  },
  'running-right': {
    label: 'state.running-right.label',
    description: 'state.running-right.description',
  },
  'running-left': {
    label: 'state.running-left.label',
    description: 'state.running-left.description',
  },
  waving: {
    label: 'state.waving.label',
    description: 'state.waving.description',
  },
  jumping: {
    label: 'state.jumping.label',
    description: 'state.jumping.description',
  },
  failed: {
    label: 'state.failed.label',
    description: 'state.failed.description',
  },
  waiting: {
    label: 'state.waiting.label',
    description: 'state.waiting.description',
  },
  running: {
    label: 'state.running.label',
    description: 'state.running.description',
  },
  review: {
    label: 'state.review.label',
    description: 'state.review.description',
  },
}

export interface CodexPetStateCopy {
  readonly description: string
  readonly label: string
}

export function getCodexPetStateCopy(
  stateId: CodexPetStateId,
  t: I18nContextValue['t'],
): CodexPetStateCopy {
  const keys = STATE_COPY_KEYS[stateId]
  return {
    label: t(keys.label),
    description: t(keys.description),
  }
}
