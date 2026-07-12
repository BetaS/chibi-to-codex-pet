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

describe('LiveSD game integration architecture boundary', () => {
  it('game source 구현을 각 game 경계 아래에 소유한다', () => {
    expect(
      entriesUnder('/importer/').filter(
        ([path]) => !path.includes('/garupa/'),
      ),
    ).toEqual([])
    expect(
      entriesUnder('/remote/').filter(
        ([path]) =>
          !path.includes('/prsk/') &&
          !path.includes('/garupa/'),
      ),
    ).toEqual([])
    expect(entriesUnder('/prsk/archive/').length).toBeGreaterThan(0)
    expect(entriesUnder('/prsk/remote/').length).toBeGreaterThan(0)
    expect(entriesUnder('/prsk/development/').length).toBeGreaterThan(0)
    expect(entriesUnder('/garupa/importer/').length).toBeGreaterThan(0)
    expect(entriesUnder('/garupa/integration/').length).toBeGreaterThan(0)
    expect(entriesUnder('/garupa/remote/').length).toBeGreaterThan(0)
    expect(entriesUnder('/garupa/rendering/').length).toBeGreaterThan(0)
  })

  it('범용 LiveSD 계층이 game integration을 역참조하지 않는다', () => {
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
        .filter(
          ([path]) =>
            !path.includes('/prsk/') &&
            !path.includes('/garupa/'),
        )
        .filter(([, source]) =>
          /(?:from|import\()\s*['"][^'"]*(?:prsk|garupa)/u.test(source),
        )
        .map(([path]) => path),
    )
    expect(violations).toEqual([])
  })

  it('game 외부 소비자가 공개 facade를 우회해 deep import하지 않는다', () => {
    const violations = Object.entries(SOURCES)
      .filter(
        ([path]) =>
          !path.includes('/livesd/prsk/') &&
          !path.includes('/livesd/garupa/'),
      )
      .filter(([, source]) =>
        /livesd\/(?:prsk\/(?:archive|development|remote)|garupa\/(?:importer|integration|remote|rendering))/u.test(
          source,
        ),
      )
      .map(([path]) => path)
    expect(violations).toEqual([])
  })
})
