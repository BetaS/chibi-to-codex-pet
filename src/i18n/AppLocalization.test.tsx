import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it } from 'vitest'

import { App } from '../App'
import { APP_LOCALE_STORAGE_KEY } from './locale'

describe('App localization shell', () => {
  it.each([
    ['ko', '좋아하는 캐릭터를 선택해', '게임 선택', 'GitHub에서 Star (새 탭에서 열림)'],
    ['en', 'Choose a favorite character', 'Game selection', 'Star this project on GitHub (opens in a new tab)'],
    ['ja', 'お気に入りのキャラクターを選び', 'ゲーム選択', 'GitHub で Star（新しいタブで開きます）'],
    ['zh-CN', '选择喜欢的角色', '选择游戏', '在 GitHub 点 Star（在新标签页中打开）'],
  ] as const)('%s 저장 locale로 최초 shell을 렌더링한다', (locale, summary, navLabel, starLabel) => {
    localStorage.setItem(APP_LOCALE_STORAGE_KEY, locale)
    render(<App />)

    expect(screen.getByText(new RegExp(summary))).toBeVisible()
    expect(screen.getByRole('navigation', { name: navLabel })).toBeVisible()
    expect(screen.getByRole('link', { name: starLabel })).toBeVisible()
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
    expect(screen.getByRole('tab', { name: 'Revue Starlight' })).toBeEnabled()
    expect(screen.getByRole('link', {
      name: 'Star this project on GitHub (opens in a new tab)',
    })).toBeVisible()
  })
})
