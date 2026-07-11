import { describe, expect, it } from 'vitest'

const tsxSources = import.meta.glob('../**/*.tsx', {
  eager: true,
  import: 'default',
  query: '?raw',
}) as Readonly<Record<string, string>>

describe('browser-visible translation boundary', () => {
  it('production TSX에 catalog를 우회하는 한국어 literal이 없다', () => {
    const violations = Object.entries(tsxSources).flatMap(([path, source]) =>
      path.endsWith('.test.tsx')
        ? []
        : source.split('\n').flatMap((line, index) =>
          /[가-힣]/u.test(line)
            ? [`${path}:${index + 1}: ${line.trim()}`]
            : [],
        ),
    )

    expect(violations).toEqual([])
  })
})
