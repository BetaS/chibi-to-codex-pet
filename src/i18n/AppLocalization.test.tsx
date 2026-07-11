import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it } from 'vitest'

import { App } from '../App'
import { APP_LOCALE_STORAGE_KEY } from './locale'

describe('App localization shell', () => {
  it.each([
    ['ko', '게임 리소스를 브라우저에서 직접 가져와', '게임 선택'],
    ['en', 'Import game resources directly in your browser', 'Game selection'],
    ['ja', 'ゲームリソースをブラウザで直接読み込み', 'ゲーム選択'],
    ['zh-CN', '直接在浏览器中导入游戏资源', '选择游戏'],
  ] as const)('%s 저장 locale로 최초 shell을 렌더링한다', (locale, summary, navLabel) => {
    localStorage.setItem(APP_LOCALE_STORAGE_KEY, locale)
    render(<App />)

    expect(screen.getByText(new RegExp(summary))).toBeVisible()
    expect(screen.getByRole('navigation', { name: navLabel })).toBeVisible()
    expect(document.documentElement).toHaveAttribute('lang', locale)
  })

  it('국기 selector가 game tab 상태를 유지하면서 shell을 즉시 번역한다', async () => {
    const user = userEvent.setup()
    render(<App />)

    const prskTab = screen.getByRole('tab', { name: '프로세카' })
    expect(prskTab).toHaveAttribute('aria-selected', 'true')
    await user.click(screen.getByRole('button', { name: 'English' }))

    expect(screen.getByRole('tab', { name: 'Project SEKAI' })).toHaveAttribute(
      'aria-selected',
      'true',
    )
    expect(screen.getByRole('tab', {
      name: /Revue Starlight.*Coming soon/,
    })).toBeDisabled()
  })
})
