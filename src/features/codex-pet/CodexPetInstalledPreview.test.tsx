import { act, fireEvent, render, screen } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'

import { CodexPetInstalledPreview } from './CodexPetInstalledPreview'
import type { CodexPetManifest } from './manifest'

const manifest = {
  id: 'test-pet',
  displayName: 'Test Pet',
  description: 'Pointer look test',
  spriteVersionNumber: 2,
  spritesheetPath: 'spritesheet.png',
} satisfies CodexPetManifest

function renderPreview() {
  return render(
    <CodexPetInstalledPreview
      manifest={manifest}
      spritesheetUrl="blob:test-spritesheet"
    />,
  )
}

function setSpriteBounds(sprite: HTMLElement): void {
  vi.spyOn(sprite, 'getBoundingClientRect').mockReturnValue({
    bottom: 308,
    height: 208,
    left: 100,
    right: 292,
    top: 100,
    width: 192,
    x: 100,
    y: 100,
    toJSON: () => ({}),
  })
}

afterEach(() => {
  vi.useRealTimers()
})

describe('CodexPetInstalledPreview', () => {
  it('Codex v2 8x11 좌표로 표준 상태를 바꾸고 frame을 순환한다', () => {
    vi.useFakeTimers()
    renderPreview()

    const sprite = screen.getByRole('img', { name: /Test Pet/ })
    expect(screen.getByTestId('codex-pet-border-box')).toContainElement(sprite)
    expect(screen.getByText('Codex Pet cell · 192 × 208')).toBeVisible()
    expect(sprite).toHaveAttribute('data-pet-state', 'idle')
    expect(sprite).toHaveAttribute('data-sprite-version', '2')
    expect(sprite).toHaveAttribute('data-atlas-row', '0')
    expect(sprite).toHaveAttribute('data-atlas-column', '0')
    expect(sprite).not.toHaveAttribute('data-look-direction-index')
    expect(sprite).toHaveStyle({
      backgroundPosition: '0% 0%',
      backgroundSize: '800% 1100%',
    })

    fireEvent.change(
      screen.getByRole('combobox', { name: '설치 미리보기 상태' }),
      { target: { value: 'jumping' } },
    )
    expect(sprite).toHaveAttribute('data-pet-state', 'jumping')
    expect(sprite).toHaveAttribute('data-atlas-row', '4')
    expect(sprite).toHaveStyle({ backgroundPosition: '0% 40%' })

    act(() => {
      vi.advanceTimersByTime(140)
    })
    expect(sprite).toHaveAttribute('data-frame-index', '1')
    expect(sprite).toHaveAttribute('data-atlas-column', '1')
  })

  it('look이 없으면 Pet hover 동안 jumping을 재생하고 leave 시 선택 상태로 복귀한다', () => {
    renderPreview()

    const statePicker = screen.getByRole('combobox', {
      name: '설치 미리보기 상태',
    })
    const sprite = screen.getByRole('img', { name: /Test Pet/ })

    fireEvent.change(statePicker, { target: { value: 'running' } })
    expect(sprite).toHaveAttribute('data-pet-state', 'running')

    fireEvent.pointerEnter(sprite)
    expect(sprite).toHaveAttribute('data-pet-state', 'jumping')
    expect(sprite).toHaveAttribute('data-atlas-row', '4')
    expect(sprite).not.toHaveAttribute('data-look-direction-index')
    expect(statePicker).toHaveValue('running')

    fireEvent.pointerLeave(sprite)
    expect(sprite).toHaveAttribute('data-pet-state', 'running')
    expect(sprite).toHaveAttribute('data-atlas-row', '7')
  })

  it('pointer의 cardinal과 diagonal을 시계 방향 16개 look cell로 선택한다', () => {
    renderPreview()

    const stage = screen.getByTestId('codex-pet-preview-stage')
    const sprite = screen.getByRole('img', { name: /Test Pet/ })
    const statePicker = screen.getByRole('combobox', {
      name: '설치 미리보기 상태',
    })
    setSpriteBounds(sprite)
    fireEvent.change(statePicker, { target: { value: 'running' } })

    const pointers = [
      { clientX: 196, clientY: 100, index: 0, row: 9, column: 0 },
      { clientX: 296, clientY: 104, index: 2, row: 9, column: 2 },
      { clientX: 296, clientY: 204, index: 4, row: 9, column: 4 },
      { clientX: 296, clientY: 304, index: 6, row: 9, column: 6 },
      { clientX: 196, clientY: 308, index: 8, row: 10, column: 0 },
      { clientX: 96, clientY: 304, index: 10, row: 10, column: 2 },
      { clientX: 96, clientY: 204, index: 12, row: 10, column: 4 },
      { clientX: 96, clientY: 104, index: 14, row: 10, column: 6 },
    ] as const

    for (const pointer of pointers) {
      fireEvent.pointerMove(stage, pointer)
      expect(sprite).toHaveAttribute(
        'data-look-direction-index',
        String(pointer.index),
      )
      expect(sprite).toHaveAttribute('data-atlas-row', String(pointer.row))
      expect(sprite).toHaveAttribute(
        'data-atlas-column',
        String(pointer.column),
      )
      expect(sprite).toHaveAttribute('data-pet-state', 'running')
    }
  })

  it('1px dead zone과 stage leave에서 look을 제거하고 hover 또는 선택 상태를 복원한다', () => {
    renderPreview()

    const stage = screen.getByTestId('codex-pet-preview-stage')
    const sprite = screen.getByRole('img', { name: /Test Pet/ })
    setSpriteBounds(sprite)
    fireEvent.change(
      screen.getByRole('combobox', { name: '설치 미리보기 상태' }),
      { target: { value: 'running' } },
    )

    fireEvent.pointerEnter(sprite)
    fireEvent.pointerMove(stage, { clientX: 196, clientY: 100 })
    expect(sprite).toHaveAttribute('data-look-direction-index', '0')
    expect(sprite).toHaveAttribute('data-pet-state', 'jumping')

    fireEvent.pointerMove(stage, { clientX: 197, clientY: 204 })
    expect(sprite).not.toHaveAttribute('data-look-direction-index')
    expect(sprite).toHaveAttribute('data-pet-state', 'jumping')
    expect(sprite).toHaveAttribute('data-atlas-row', '4')

    fireEvent.pointerMove(stage, { clientX: 296, clientY: 204 })
    expect(sprite).toHaveAttribute('data-look-direction-index', '4')
    fireEvent.pointerLeave(stage)
    expect(sprite).not.toHaveAttribute('data-look-direction-index')
    expect(sprite).toHaveAttribute('data-pet-state', 'running')
    expect(sprite).toHaveAttribute('data-atlas-row', '7')
    expect(sprite).toHaveAttribute('data-atlas-column', '0')
  })
})
