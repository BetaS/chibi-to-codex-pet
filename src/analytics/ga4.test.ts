import { afterEach, describe, expect, it, vi } from 'vitest'

import {
  BUTTON_CLICK_EVENT,
  CHARACTER_SELECT_EVENT,
  GAME_SELECT_EVENT,
  initializeGoogleAnalytics,
  MODEL_SELECT_EVENT,
  PET_ZIP_DOWNLOAD_EVENT,
  trackButtonClick,
  trackCharacterSelection,
  trackGameSelection,
  trackModelSelection,
  trackPetZipDownload,
} from './ga4'

function resetGoogleAnalyticsDom(): void {
  document.getElementById('google-analytics-gtag')?.remove()
  delete window.dataLayer
  delete window.gtag
}

afterEach(() => {
  resetGoogleAnalyticsDom()
})

describe('GA4 browser adapter', () => {
  it.each([undefined, '', 'UA-123456', 'G-invalid'])(
    'measurement ID %s에서는 초기화하지 않는다',
    (measurementId) => {
      expect(initializeGoogleAnalytics(measurementId)).toBe(false)
      expect(document.getElementById('google-analytics-gtag')).toBeNull()
      expect(window.dataLayer).toBeUndefined()
      expect(window.gtag).toBeUndefined()
    },
  )

  it('유효한 measurement ID를 한 번 초기화하고 기본 page view config를 enqueue한다', () => {
    expect(initializeGoogleAnalytics('  G-ABC123DEF4  ')).toBe(true)

    const script = document.getElementById(
      'google-analytics-gtag',
    ) as HTMLScriptElement | null
    expect(script).not.toBeNull()
    expect(script?.async).toBe(true)
    expect(script?.dataset.measurementId).toBe('G-ABC123DEF4')
    expect(script?.src).toBe(
      'https://www.googletagmanager.com/gtag/js?id=G-ABC123DEF4',
    )
    expect(window.dataLayer).toHaveLength(2)
    expect(Object.prototype.toString.call(window.dataLayer?.[0])).toBe(
      '[object Arguments]',
    )
    expect(Object.prototype.toString.call(window.dataLayer?.[1])).toBe(
      '[object Arguments]',
    )
    expect(window.dataLayer?.[0]?.[0]).toBe('js')
    expect(window.dataLayer?.[0]?.[1]).toBeInstanceOf(Date)
    expect(Array.from(window.dataLayer?.[1] ?? [])).toEqual([
      'config',
      'G-ABC123DEF4',
    ])

    expect(initializeGoogleAnalytics('G-ABC123DEF4')).toBe(true)
    expect(document.querySelectorAll('#google-analytics-gtag')).toHaveLength(1)
    expect(window.dataLayer).toHaveLength(2)
  })

  it('다른 measurement ID로 중복 초기화하지 않는다', () => {
    expect(initializeGoogleAnalytics('G-ABC123DEF4')).toBe(true)
    expect(initializeGoogleAnalytics('G-OTHER5678')).toBe(false)

    expect(document.querySelectorAll('#google-analytics-gtag')).toHaveLength(1)
    expect(window.dataLayer).toHaveLength(2)
  })

  it('Pet ZIP download event name만 전송한다', () => {
    const googleTag = vi.fn()
    window.gtag = googleTag

    trackPetZipDownload()

    expect(googleTag).toHaveBeenCalledTimes(1)
    expect(googleTag).toHaveBeenCalledWith('event', PET_ZIP_DOWNLOAD_EVENT)
  })

  it('버튼, 게임, 캐릭터, 모델 선택을 안정적인 식별자로 전송한다', () => {
    const googleTag = vi.fn()
    window.gtag = googleTag

    trackButtonClick('state_preview', 'running-left')
    trackGameSelection('garupa')
    trackCharacterSelection('garupa', '38', 'pinned')
    trackModelSelection('garupa', '00038_lottery2021', 'pinned')

    expect(googleTag.mock.calls).toEqual([
      [
        'event',
        BUTTON_CLICK_EVENT,
        { button_id: 'state_preview', button_value: 'running-left' },
      ],
      ['event', GAME_SELECT_EVENT, { game_id: 'garupa' }],
      [
        'event',
        CHARACTER_SELECT_EVENT,
        {
          character_id: '38',
          game_id: 'garupa',
          source_type: 'pinned',
        },
      ],
      [
        'event',
        MODEL_SELECT_EVENT,
        {
          game_id: 'garupa',
          model_id: '00038_lottery2021',
          source_type: 'pinned',
        },
      ],
    ])
  })

  it('사용자 지정 selection의 raw ID는 전송하지 않는다', () => {
    const googleTag = vi.fn()
    window.gtag = googleTag

    trackCharacterSelection('prsk', 'privateCharacterName', 'custom')
    trackModelSelection('prsk', 'privateModelName', 'custom')
    trackButtonClick('locale_change', '한국어')

    expect(googleTag.mock.calls).toEqual([
      [
        'event',
        CHARACTER_SELECT_EVENT,
        {
          character_id: 'custom',
          game_id: 'prsk',
          source_type: 'custom',
        },
      ],
      [
        'event',
        MODEL_SELECT_EVENT,
        {
          game_id: 'prsk',
          model_id: 'custom',
          source_type: 'custom',
        },
      ],
      [
        'event',
        BUTTON_CLICK_EVENT,
        { button_id: 'locale_change' },
      ],
    ])
  })

  it('analytics가 없거나 호출 중 실패해도 예외를 노출하지 않는다', () => {
    expect(() => trackPetZipDownload()).not.toThrow()

    window.gtag = vi.fn(() => {
      throw new Error('blocked')
    })
    expect(() => trackPetZipDownload()).not.toThrow()
  })
})
