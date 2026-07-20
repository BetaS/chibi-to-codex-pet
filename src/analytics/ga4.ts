const GOOGLE_TAG_SCRIPT_ID = 'google-analytics-gtag'
const GOOGLE_TAG_SCRIPT_URL = 'https://www.googletagmanager.com/gtag/js'
const GA4_MEASUREMENT_ID_PATTERN = /^G-[A-Z0-9]+$/u
const ANALYTICS_IDENTIFIER_PATTERN = /^[A-Za-z0-9][A-Za-z0-9._:-]{0,99}$/u

export const BUTTON_CLICK_EVENT = 'button_click'
export const CHARACTER_SELECT_EVENT = 'character_select'
export const GAME_SELECT_EVENT = 'game_select'
export const MODEL_SELECT_EVENT = 'model_select'
export const PET_ZIP_DOWNLOAD_EVENT = 'pet_zip_download'

export type AnalyticsGameId = 'garupa' | 'prsk' | 'strr'
export type AnalyticsSelectionSource =
  | 'custom'
  | 'local'
  | 'pinned'
  | 'provided'

export type AnalyticsButtonId =
  | 'framing_reset'
  | 'garupa_catalog_load'
  | 'garupa_local_load'
  | 'github_repository_open'
  | 'install_command_copy'
  | 'locale_change'
  | 'look_movement_reset'
  | 'new_game_support_open'
  | 'pet_generate'
  | 'pet_generation_cancel'
  | 'preset_load'
  | 'preset_new'
  | 'prsk_catalog_load'
  | 'prsk_local_preview'
  | 'prsk_source_change'
  | 'star_prompt_close'
  | 'star_prompt_dismiss'
  | 'star_prompt_repository_open'
  | 'state_preview'
  | 'strr_catalog_load'

type GoogleTag = (...args: unknown[]) => void

declare global {
  interface Window {
    dataLayer?: IArguments[]
    gtag?: GoogleTag
  }
}

function normalizeMeasurementId(
  measurementId: string | undefined,
): string | null {
  const normalized = measurementId?.trim() ?? ''
  return GA4_MEASUREMENT_ID_PATTERN.test(normalized) ? normalized : null
}

function getOrCreateGoogleTag(): GoogleTag {
  window.dataLayer ??= []
  window.gtag ??= function googleTag() {
    // Google tag commands must retain the native Arguments object shape.
    // eslint-disable-next-line prefer-rest-params
    window.dataLayer?.push(arguments)
  }
  return window.gtag
}

function sendAnalyticsEvent(
  eventName: string,
  parameters?: Readonly<Record<string, string>>,
): void {
  if (typeof window === 'undefined') {
    return
  }

  try {
    if (parameters) {
      window.gtag?.('event', eventName, parameters)
    } else {
      window.gtag?.('event', eventName)
    }
  } catch {
    // Analytics must never interrupt an app interaction.
  }
}

function validAnalyticsIdentifier(value: string): boolean {
  return ANALYTICS_IDENTIFIER_PATTERN.test(value)
}

export function initializeGoogleAnalytics(
  measurementId: string | undefined = import.meta.env.VITE_GA_MEASUREMENT_ID,
): boolean {
  const normalizedId = normalizeMeasurementId(measurementId)
  if (!normalizedId || typeof window === 'undefined') {
    return false
  }

  const existingScript = document.getElementById(GOOGLE_TAG_SCRIPT_ID)
  if (existingScript) {
    return existingScript.dataset.measurementId === normalizedId
  }

  const googleTag = getOrCreateGoogleTag()
  googleTag('js', new Date())
  googleTag('config', normalizedId)

  const script = document.createElement('script')
  script.async = true
  script.dataset.measurementId = normalizedId
  script.id = GOOGLE_TAG_SCRIPT_ID
  const scriptUrl = new URL(GOOGLE_TAG_SCRIPT_URL)
  scriptUrl.searchParams.set('id', normalizedId)
  script.src = scriptUrl.href
  document.head.append(script)

  return true
}

export function trackPetZipDownload(): void {
  sendAnalyticsEvent(PET_ZIP_DOWNLOAD_EVENT)
}

export function trackButtonClick(
  buttonId: AnalyticsButtonId,
  buttonValue?: string,
): void {
  const parameters: Record<string, string> = { button_id: buttonId }
  if (buttonValue && validAnalyticsIdentifier(buttonValue)) {
    parameters.button_value = buttonValue
  }
  sendAnalyticsEvent(BUTTON_CLICK_EVENT, parameters)
}

export function trackGameSelection(gameId: AnalyticsGameId): void {
  sendAnalyticsEvent(GAME_SELECT_EVENT, { game_id: gameId })
}

export function trackCharacterSelection(
  gameId: AnalyticsGameId,
  characterId: string,
  sourceType: AnalyticsSelectionSource,
): void {
  const safeCharacterId = sourceType === 'custom' ? 'custom' : characterId
  if (!validAnalyticsIdentifier(safeCharacterId)) return
  sendAnalyticsEvent(CHARACTER_SELECT_EVENT, {
    character_id: safeCharacterId,
    game_id: gameId,
    source_type: sourceType,
  })
}

export function trackModelSelection(
  gameId: AnalyticsGameId,
  modelId: string,
  sourceType: AnalyticsSelectionSource,
): void {
  const safeModelId = sourceType === 'custom' ? 'custom' : modelId
  if (!validAnalyticsIdentifier(safeModelId)) return
  sendAnalyticsEvent(MODEL_SELECT_EVENT, {
    game_id: gameId,
    model_id: safeModelId,
    source_type: sourceType,
  })
}
