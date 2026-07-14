import { render, screen, waitFor, within } from '@testing-library/react'
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

const GROUPED_OPTIONS: readonly SearchableComboboxOption[] = [
  {
    group: { key: 'leo-need', label: 'Leo/need' },
    label: 'Ichika Hoshino',
    value: 'character:01ichika',
  },
  {
    group: {
      key: 'vivid-bad-squad',
      label: 'Vivid BAD SQUAD',
      searchTerms: ['vbs'],
    },
    label: 'Akito Shinonome',
    value: 'character:11akito',
  },
  {
    group: {
      key: 'vivid-bad-squad',
      label: 'Vivid BAD SQUAD',
      searchTerms: ['vbs'],
    },
    label: 'Toya Aoyagi',
    value: 'character:12touya',
  },
  {
    group: { key: 'virtual-singer', label: 'VIRTUAL SINGER' },
    label: 'Hatsune Miku',
    value: 'character:21miku',
  },
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

  it('group key와 label 검색은 해당 group의 selectable option만 유지한다', () => {
    expect(filterComboboxOptions(GROUPED_OPTIONS, 'VBS')).toEqual(
      GROUPED_OPTIONS.slice(1, 3),
    )
    expect(filterComboboxOptions(GROUPED_OPTIONS, 'virtual singer')).toEqual([
      GROUPED_OPTIONS[3],
    ])
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
    expect(within(listbox).queryAllByRole('group')).toHaveLength(0)
  })

  it('group heading은 option이 아닌 accessible section으로 렌더링하고 pointer 선택을 보존한다', async () => {
    const user = userEvent.setup()
    const onChange = vi.fn()
    render(
      <SearchableCombobox
        label="캐릭터"
        onChange={onChange}
        options={GROUPED_OPTIONS}
        value={null}
      />,
    )

    await user.click(screen.getByRole('combobox', { name: '캐릭터' }))

    const listbox = screen.getByRole('listbox', { name: '캐릭터' })
    expect(
      within(listbox).getAllByRole('group').map(
        (group) => group.getAttribute('aria-labelledby'),
      ),
    ).toHaveLength(3)
    expect(
      within(listbox).getAllByRole('group').map(
        (group) => group.querySelector(
          '.searchable-combobox__group-heading',
        )?.textContent,
      ),
    ).toEqual(['Leo/need', 'Vivid BAD SQUAD', 'VIRTUAL SINGER'])
    expect(
      within(listbox).getAllByRole('option').map((option) => option.textContent),
    ).toEqual([
      'Ichika Hoshino',
      'Akito Shinonome',
      'Toya Aoyagi',
      'Hatsune Miku',
    ])
    expect(
      within(listbox).queryByRole('option', { name: 'Vivid BAD SQUAD' }),
    ).not.toBeInTheDocument()

    await user.click(
      within(listbox).getByRole('option', { name: 'Hatsune Miku' }),
    )
    expect(onChange).toHaveBeenCalledWith(
      'character:21miku',
      GROUPED_OPTIONS[3],
    )
  })

  it('group 검색 뒤 arrow key는 heading을 건너뛰고 실제 option만 commit한다', async () => {
    const user = userEvent.setup()
    const onChange = vi.fn()
    render(
      <SearchableCombobox
        label="캐릭터"
        onChange={onChange}
        options={GROUPED_OPTIONS}
        value={null}
      />,
    )

    const combobox = screen.getByRole('combobox', { name: '캐릭터' })
    await user.click(combobox)
    await user.type(combobox, 'VBS')

    const listbox = screen.getByRole('listbox', { name: '캐릭터' })
    expect(
      within(listbox).getAllByRole('group').map((group) => group.textContent),
    ).toEqual(['Vivid BAD SQUADAkito ShinonomeToya Aoyagi'])
    const options = within(listbox).getAllByRole('option')
    expect(options.map((option) => option.textContent)).toEqual([
      'Akito Shinonome',
      'Toya Aoyagi',
    ])
    expect(combobox).toHaveAttribute('aria-activedescendant', options[0]?.id)

    await user.keyboard('{ArrowDown}{Enter}')

    expect(onChange).toHaveBeenCalledWith(
      'character:12touya',
      GROUPED_OPTIONS[2],
    )
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

  it('viewport 하단에서는 body portal popup을 위로 배치하고 scroll 시 다시 계산한다', async () => {
    const user = userEvent.setup()
    vi.stubGlobal('innerHeight', 800)
    vi.stubGlobal('innerWidth', 1200)
    render(
      <div style={{ overflow: 'hidden' }}>
        <SearchableCombobox
          label="애니메이션"
          onChange={vi.fn()}
          options={OPTIONS}
          value={null}
        />
      </div>,
    )

    const combobox = screen.getByRole('combobox', { name: '애니메이션' })
    let inputTop = 740
    vi.spyOn(combobox, 'getBoundingClientRect').mockImplementation(() => ({
      bottom: inputTop + 40,
      height: 40,
      left: 100,
      right: 420,
      top: inputTop,
      width: 320,
      x: 100,
      y: inputTop,
      toJSON: () => ({}),
    }))

    await user.click(combobox)

    const listbox = screen.getByRole('listbox', { name: '애니메이션' })
    expect(listbox.parentElement).toBe(document.body)
    expect(listbox).toHaveAttribute('data-placement', 'above')
    expect(listbox.style.bottom).not.toBe('auto')
    expect(Number.parseFloat(listbox.style.maxHeight)).toBeLessThanOrEqual(288)

    inputTop = 100
    document.dispatchEvent(new Event('scroll'))
    await waitFor(() => {
      expect(listbox).toHaveAttribute('data-placement', 'below')
    })
    expect(listbox.style.top).not.toBe('auto')
    expect(combobox).toHaveAttribute('aria-expanded', 'true')
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
