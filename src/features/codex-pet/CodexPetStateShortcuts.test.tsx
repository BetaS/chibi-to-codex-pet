import { render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, vi } from 'vitest'

import { I18nProvider, LocaleSelector } from '../../i18n'
import { recommendCodexPetMappings } from './animationMapping'
import { CodexPetStateShortcuts } from './CodexPetStateShortcuts'

const mappings = recommendCodexPetMappings([
  'idle',
  'walk',
  'wave',
  'jump',
  'sad',
  'wait',
  'work',
  'review',
])

describe('CodexPetStateShortcuts', () => {
  it('9개 상태를 계약 순서의 icon button으로 표시하고 현재 mapping을 활성화한다', async () => {
    const user = userEvent.setup()
    const onActivate = vi.fn()
    const { rerender } = render(
      <CodexPetStateShortcuts
        activeStateId={null}
        mappings={mappings}
        onActivate={onActivate}
      />,
    )
    const group = screen.getByRole('group', {
      name: 'Codex Pet 상태 바로가기',
    })
    const buttons = within(group).getAllByRole('button')

    expect(buttons).toHaveLength(9)
    expect(buttons.map((button) => button.dataset.stateId)).toEqual([
      'idle',
      'running-right',
      'running-left',
      'waving',
      'jumping',
      'failed',
      'waiting',
      'running',
      'review',
    ])

    const idle = screen.getByRole('button', {
      name: '대기 미리보기: 차분한 호흡과 눈 깜박임',
    })
    expect(idle).toHaveTextContent('◉')
    expect(idle).toHaveAttribute(
      'title',
      '대기 미리보기: 차분한 호흡과 눈 깜박임',
    )
    await user.click(idle)

    expect(onActivate).toHaveBeenCalledWith(
      mappings.idle.animationName,
      'idle',
      false,
    )

    const mirroredMappings = {
      ...mappings,
      'running-right': {
        ...mappings['running-right'],
        mirrorX: true,
      },
    }
    rerender(
      <CodexPetStateShortcuts
        activeStateId={null}
        mappings={mirroredMappings}
        onActivate={onActivate}
      />,
    )
    await user.click(screen.getByRole('button', {
      name: /오른쪽 이동 미리보기/,
    }))
    expect(onActivate).toHaveBeenLastCalledWith(
      mappings['running-right'].animationName,
      'running-right',
      true,
    )

    rerender(
      <CodexPetStateShortcuts
        activeStateId="idle"
        mappings={mirroredMappings}
        onActivate={onActivate}
      />,
    )
    expect(idle).toHaveAttribute('aria-pressed', 'true')
    expect(
      screen.getByRole('button', {
        name: /오른쪽 이동 미리보기/,
      }),
    ).toHaveAttribute('aria-pressed', 'false')
  })

  it('mapping이 없으면 비활성화하고 locale 전환은 icon과 선택을 보존한다', async () => {
    const user = userEvent.setup()
    const onActivate = vi.fn()
    const { rerender } = render(
      <I18nProvider initialLocale="ko" storage={null}>
        <LocaleSelector />
        <CodexPetStateShortcuts
          activeStateId={null}
          mappings={null}
          onActivate={onActivate}
        />
      </I18nProvider>,
    )

    expect(
      screen.getAllByRole('button', { name: /미리보기:/ }),
    ).toHaveLength(9)
    for (const button of screen.getAllByRole('button', { name: /미리보기:/ })) {
      expect(button).toBeDisabled()
    }

    rerender(
      <I18nProvider initialLocale="ko" storage={null}>
        <LocaleSelector />
        <CodexPetStateShortcuts
          activeStateId="idle"
          mappings={mappings}
          onActivate={onActivate}
        />
      </I18nProvider>,
    )
    const koreanIdle = screen.getByRole('button', {
      name: /^대기 미리보기:/,
    })
    expect(koreanIdle).toHaveTextContent('◉')

    await user.click(screen.getByRole('button', { name: 'English' }))

    const englishIdle = screen.getByRole('button', {
      name: /^Preview Idle:/,
    })
    expect(englishIdle).toHaveTextContent('◉')
    expect(englishIdle).toHaveAttribute('aria-pressed', 'true')
    expect(onActivate).not.toHaveBeenCalled()
  })
})
