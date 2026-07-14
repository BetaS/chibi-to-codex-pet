const GOOGLE_TAG_SCRIPT_ID = 'google-analytics-gtag'
const GOOGLE_TAG_SCRIPT_URL = 'https://www.googletagmanager.com/gtag/js'
const GA4_MEASUREMENT_ID_PATTERN = /^G-[A-Z0-9]+$/u

export const PET_ZIP_DOWNLOAD_EVENT = 'pet_zip_download'

type GoogleTag = (...args: unknown[]) => void

declare global {
  interface Window {
    dataLayer?: unknown[][]
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
  window.gtag ??= (...args: unknown[]) => {
    window.dataLayer?.push(args)
  }
  return window.gtag
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
  if (typeof window === 'undefined') {
    return
  }

  try {
    window.gtag?.('event', PET_ZIP_DOWNLOAD_EVENT)
  } catch {
    // Analytics must never interrupt the browser's Blob download.
  }
}
