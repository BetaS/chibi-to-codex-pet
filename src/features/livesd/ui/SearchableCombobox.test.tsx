import { render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, describe, expect, it, vi } from 'vitest'

import {
  SearchableCombobox,
  type SearchableComboboxOption,
} from './SearchableCombobox'
import { filterComboboxOptions } from './searchableComboboxOptions'

const OPTIONS: readonly SearchableComboboxOption[] = [
  { label: 'Hatsune Miku', value: 'sd_21miku_normal' },
  { label: 'Street Miku', value: 'sd_21miku_street' },
  { label: 'Mob Character', value: 'sd_mob001' },
]

afterEach(() => {
  vi.unstubAllGlobals()
})

describe('filterComboboxOptions', () => {
  it('label과 value를 대소문자 구분 없이 substring 검색하고 원래 순서를 유지한다', () => {
    const byLabel = filterComboboxOptions(OPTIONS, 'STREET')
    const byValue = filterComboboxOptions(OPTIONS, '21MIKU')

    expect(byLabel).toEqual([OPTIONS[1]])
    expect(byLabel[0]).toBe(OPTIONS[1])
    expect(byValue).toEqual([OPTIONS[0], OPTIONS[1]])
    expect(OPTIONS.map((option) => option.value)).toEqual([
      'sd_21miku_normal',
      'sd_21miku_street',
      'sd_mob001',
    ])
  })

  it('빈 query에서 canonical option 목록을 그대로 복원한다', () => {
    expect(filterComboboxOptions(OPTIONS, '')).toBe(OPTIONS)
  })
})

describe('SearchableCombobox', () => {
  it('label과 연결된 combobox, listbox, active option을 노출한다', async () => {
    const user = userEvent.setup()
    render(
      <SearchableCombobox
        label="캐릭터"
        onChange={vi.fn()}
        options={OPTIONS}
        value="sd_21miku_street"
      />,
    )

    const combobox = screen.getByRole('combobox', { name: '캐릭터' })
    expect(combobox).toHaveValue('Street Miku')
    expect(combobox).toHaveAttribute('aria-expanded', 'false')

    await user.click(combobox)

    const listbox = screen.getByRole('listbox', { name: '캐릭터' })
    const options = within(listbox).getAllByRole('option')
    expect(options.map((option) => option.textContent)).toEqual([
      'Hatsune Miku',
      'Street Miku',
      'Mob Character',
    ])
    expect(combobox).toHaveAttribute('aria-expanded', 'true')
    expect(combobox).toHaveAttribute(
      'aria-activedescendant',
      options[1]?.id,
    )
    expect(options[1]).toHaveAttribute('aria-selected', 'true')
  })

  it('popup을 열면 선택된 option이 보이도록 자동 스크롤한다', async () => {
    const user = userEvent.setup()
    const originalScrollIntoView = HTMLElement.prototype.scrollIntoView
    const scrollIntoView = vi.fn()
    Object.defineProperty(HTMLElement.prototype, 'scrollIntoView', {
      configurable: true,
      value: scrollIntoView,
    })

    try {
      const longOptions = Array.from({ length: 80 }, (_, index) => ({
        label: `Animation ${index + 1}`,
        value: `animation-${index + 1}`,
      }))
      render(
        <SearchableCombobox
          label="애니메이션"
          onChange={vi.fn()}
          options={longOptions}
          value="animation-72"
        />,
      )

      await user.click(
        screen.getByRole('combobox', { name: '애니메이션' }),
      )

      const selectedOption = screen.getByRole('option', {
        name: 'Animation 72',
      })
      expect(scrollIntoView.mock.contexts[0]).toBe(selectedOption)
      expect(scrollIntoView).toHaveBeenCalledWith({ block: 'nearest' })
    } finally {
      if (originalScrollIntoView) {
        Object.defineProperty(HTMLElement.prototype, 'scrollIntoView', {
          configurable: true,
          value: originalScrollIntoView,
        })
      } else {
        Reflect.deleteProperty(HTMLElement.prototype, 'scrollIntoView')
      }
    }
  })

  it('검색과 keyboard highlight는 commit과 network 요청을 만들지 않고 Enter로만 option을 commit한다', async () => {
    const user = userEvent.setup()
    const onChange = vi.fn()
    const fetchSpy = vi.fn()
    vi.stubGlobal('fetch', fetchSpy)
    render(
      <SearchableCombobox
        label="캐릭터"
        onChange={onChange}
        options={OPTIONS}
        value={null}
      />,
    )

    const combobox = screen.getByRole('combobox', { name: '캐릭터' })
    await user.click(combobox)
    await user.type(combobox, 'MIKU')

    expect(screen.getAllByRole('option').map((option) => option.textContent)).toEqual([
      'Hatsune Miku',
      'Street Miku',
    ])
    expect(onChange).not.toHaveBeenCalled()
    expect(fetchSpy).not.toHaveBeenCalled()

    await user.keyboard('{ArrowDown}{ArrowUp}{ArrowUp}{Enter}')

    expect(onChange).toHaveBeenCalledTimes(1)
    expect(onChange).toHaveBeenCalledWith(
      'sd_21miku_street',
      OPTIONS[1],
    )
    expect(fetchSpy).not.toHaveBeenCalled()
  })

  it('pointer로 visible canonical option을 선택할 수 있다', async () => {
    const user = userEvent.setup()
    const onChange = vi.fn()
    render(
      <SearchableCombobox
        label="캐릭터"
        onChange={onChange}
        options={OPTIONS}
        value={null}
      />,
    )

    await user.click(screen.getByRole('combobox', { name: '캐릭터' }))
    await user.click(screen.getByRole('option', { name: 'Mob Character' }))

    expect(onChange).toHaveBeenCalledWith('sd_mob001', OPTIONS[2])
    expect(screen.queryByRole('listbox')).not.toBeInTheDocument()
  })

  it('빈 query는 전체 option을 순서대로 복원하고 자유 입력은 commit하지 않는다', async () => {
    const user = userEvent.setup()
    const onChange = vi.fn()
    render(
      <SearchableCombobox
        label="애니메이션"
        noResultsMessage="검색 결과 없음"
        onChange={onChange}
        options={OPTIONS}
        value={null}
      />,
    )

    const combobox = screen.getByRole('combobox', { name: '애니메이션' })
    await user.click(combobox)
    await user.type(combobox, 'miku')
    expect(screen.getAllByRole('option')).toHaveLength(2)

    await user.clear(combobox)
    expect(screen.getAllByRole('option').map((option) => option.textContent)).toEqual([
      'Hatsune Miku',
      'Street Miku',
      'Mob Character',
    ])

    await user.type(combobox, 'not-an-option')
    expect(screen.queryAllByRole('option')).toHaveLength(0)
    expect(screen.getByRole('status')).toHaveTextContent('검색 결과 없음')
    await user.keyboard('{Enter}')
    expect(onChange).not.toHaveBeenCalled()

    await user.tab()
    expect(combobox).toHaveValue('')
  })

  it('Escape는 현재 commit 값을 유지하고 popup만 닫는다', async () => {
    const user = userEvent.setup()
    const onChange = vi.fn()
    render(
      <SearchableCombobox
        label="애니메이션"
        onChange={onChange}
        options={OPTIONS}
        value="sd_mob001"
      />,
    )

    const combobox = screen.getByRole('combobox', { name: '애니메이션' })
    await user.click(combobox)
    await user.type(combobox, 'missing')
    await user.keyboard('{Escape}')

    expect(combobox).toHaveAttribute('aria-expanded', 'false')
    expect(combobox).toHaveValue('Mob Character')
    expect(onChange).not.toHaveBeenCalled()
  })

  it('queryResetKey 변경 시 uncontrolled query와 popup highlight를 초기화한다', async () => {
    const user = userEvent.setup()
    const { rerender } = render(
      <SearchableCombobox
        label="캐릭터"
        onChange={vi.fn()}
        options={OPTIONS}
        queryResetKey="catalog-1"
        value={null}
      />,
    )
    const combobox = screen.getByRole('combobox', { name: '캐릭터' })
    await user.click(combobox)
    await user.type(combobox, 'mob')
    expect(screen.getAllByRole('option')).toHaveLength(1)

    rerender(
      <SearchableCombobox
        label="캐릭터"
        onChange={vi.fn()}
        options={OPTIONS}
        queryResetKey="catalog-2"
        value={null}
      />,
    )

    expect(combobox).toHaveAttribute('aria-expanded', 'false')
    await user.click(combobox)
    expect(screen.getAllByRole('option')).toHaveLength(3)
    expect(combobox).toHaveValue('')
  })

  it('controlled query를 option 선택값과 독립적으로 반영한다', async () => {
    const user = userEvent.setup()
    const onQueryChange = vi.fn()
    const { rerender } = render(
      <SearchableCombobox
        label="캐릭터"
        onChange={vi.fn()}
        onQueryChange={onQueryChange}
        options={OPTIONS}
        query="miku"
        value="sd_mob001"
      />,
    )

    const combobox = screen.getByRole('combobox', { name: '캐릭터' })
    expect(combobox).toHaveValue('Mob Character')
    await user.click(combobox)
    expect(combobox).toHaveValue('miku')
    expect(screen.getAllByRole('option')).toHaveLength(2)

    await user.type(combobox, 'x')
    expect(onQueryChange).toHaveBeenLastCalledWith('mikux')
    rerender(
      <SearchableCombobox
        label="캐릭터"
        onChange={vi.fn()}
        onQueryChange={onQueryChange}
        options={OPTIONS}
        query=""
        value="sd_mob001"
      />,
    )
    expect(screen.getAllByRole('option')).toHaveLength(3)
  })

  it('loading, disabled, empty, error 상태를 안내하고 입력을 비활성화한다', () => {
    const props = {
      label: '캐릭터',
      onChange: vi.fn(),
      options: OPTIONS,
      value: null,
    } as const
    const { rerender } = render(
      <SearchableCombobox {...props} loading loadingMessage="로딩 중" />,
    )

    const combobox = screen.getByRole('combobox', { name: '캐릭터' })
    expect(combobox).toBeDisabled()
    expect(combobox).toHaveAttribute('aria-busy', 'true')
    expect(screen.getByRole('status')).toHaveTextContent('로딩 중')

    rerender(
      <SearchableCombobox
        {...props}
        disabled
        disabledMessage="목록을 먼저 불러오세요"
      />,
    )
    expect(combobox).toBeDisabled()
    expect(screen.getByRole('status')).toHaveTextContent(
      '목록을 먼저 불러오세요',
    )

    rerender(<SearchableCombobox {...props} options={[]} emptyMessage="빈 목록" />)
    expect(combobox).toBeDisabled()
    expect(screen.getByRole('status')).toHaveTextContent('빈 목록')

    rerender(<SearchableCombobox {...props} error="catalog 오류" />)
    expect(combobox).toBeDisabled()
    expect(combobox).toHaveAttribute('aria-invalid', 'true')
    expect(combobox).toHaveAttribute(
      'aria-errormessage',
      screen.getByRole('status').id,
    )
    expect(screen.getByRole('status')).toHaveTextContent('catalog 오류')
  })
})
