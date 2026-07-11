import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, vi } from 'vitest'

import { useI18n } from './I18nContext'
import { I18nProvider } from './I18nProvider'
import { LocaleSelector } from './LocaleSelector'
import type { LocaleStorage } from './locale'

function Probe() {
  const { locale, t } = useI18n()
  return <output>{locale}:{t('app.summary')}</output>
}

describe('I18nProvider and LocaleSelector', () => {
  it('국기 button의 native 이름·선택 상태로 locale과 document lang을 바꿔 저장한다', async () => {
    const user = userEvent.setup()
    const storage: LocaleStorage = {
      getItem: vi.fn(() => null),
      setItem: vi.fn(),
    }
    render(
      <I18nProvider initialLocale="en" storage={storage}>
        <LocaleSelector />
        <Probe />
      </I18nProvider>,
    )

    expect(screen.getByRole('group', { name: 'Language' })).toBeVisible()
    expect(screen.getByRole('button', { name: 'English' })).toHaveAttribute(
      'aria-pressed',
      'true',
    )
    await user.click(screen.getByRole('button', { name: '日本語' }))

    expect(document.documentElement).toHaveAttribute('lang', 'ja')
    expect(screen.getByRole('group', { name: '言語を選択' })).toBeVisible()
    expect(screen.getByRole('button', { name: '日本語' })).toHaveAttribute(
      'aria-pressed',
      'true',
    )
    expect(screen.getByText(/^ja:/)).toHaveTextContent(
      'ゲームリソースをブラウザで直接読み込み',
    )
    expect(storage.setItem).toHaveBeenCalledWith(
      'chibi-to-codex-pet.locale.v1',
      'ja',
    )
  })

  it('storage 쓰기가 실패해도 현재 locale을 전환한다', async () => {
    const user = userEvent.setup()
    const storage: LocaleStorage = {
      getItem: vi.fn(() => null),
      setItem: vi.fn(() => {
        throw new DOMException('blocked')
      }),
    }
    render(
      <I18nProvider initialLocale="ko" storage={storage}>
        <LocaleSelector />
        <Probe />
      </I18nProvider>,
    )

    await user.click(screen.getByRole('button', { name: '简体中文' }))
    expect(screen.getByText(/^zh-CN:/)).toBeVisible()
    expect(document.documentElement).toHaveAttribute('lang', 'zh-CN')
  })
})
