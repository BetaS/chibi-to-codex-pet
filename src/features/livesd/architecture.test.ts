import { describe, expect, it } from 'vitest'

const LIVESD_SOURCES = import.meta.glob('./**/*.{ts,tsx}', {
  eager: true,
  import: 'default',
  query: '?raw',
}) as Readonly<Record<string, string>>
const FEATURE_SOURCES = import.meta.glob('../**/*.{ts,tsx}', {
  eager: true,
  import: 'default',
  query: '?raw',
}) as Readonly<Record<string, string>>
const SOURCES = { ...FEATURE_SOURCES, ...LIVESD_SOURCES }

function entriesUnder(segment: string) {
  return Object.entries(SOURCES).filter(([path]) => path.includes(segment))
}

describe('LiveSD PRSK architecture boundary', () => {
  it('PRSK source 구현을 prsk 경계 아래에 소유한다', () => {
    expect(entriesUnder('/importer/')).toEqual([])
    expect(entriesUnder('/remote/').filter(([path]) => !path.includes('/prsk/'))).toEqual([])
    expect(entriesUnder('/prsk/archive/').length).toBeGreaterThan(0)
    expect(entriesUnder('/prsk/remote/').length).toBeGreaterThan(0)
    expect(entriesUnder('/prsk/development/').length).toBeGreaterThan(0)
  })

  it('범용 LiveSD 계층이 PRSK를 역참조하지 않는다', () => {
    const genericDirectories = [
      'adapter',
      'export',
      'input',
      'model',
      'rendering',
      'runtime',
      'ui',
    ]
    const violations = genericDirectories.flatMap((directory) =>
      entriesUnder(`/${directory}/`)
        .filter(([, source]) =>
          /(?:from|import\()\s*['"][^'"]*prsk/u.test(source),
        )
        .map(([path]) => path),
    )
    expect(violations).toEqual([])
  })

  it('PRSK 외부 소비자가 공개 facade를 우회해 deep import하지 않는다', () => {
    const violations = Object.entries(SOURCES)
      .filter(([path]) => !path.includes('/livesd/prsk/'))
      .filter(([, source]) =>
        /livesd\/prsk\/(?:archive|development|remote)/u.test(source),
      )
      .map(([path]) => path)
    expect(violations).toEqual([])
  })
})
