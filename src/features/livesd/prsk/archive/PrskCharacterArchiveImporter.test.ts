import { describe, expect, it } from 'vitest'

import {
  createMetadataOnlyZipFile,
  createZipFile,
  VALID_ATLAS,
} from '../../../../test/zipFixtures'
import {
  PRSK_ARCHIVE_LIMITS,
  PrskCharacterArchiveImporter,
  normalizeArchivePath,
  resolveAtlasPagePath,
} from './index'

const importer = new PrskCharacterArchiveImporter()

async function expectImportError(file: File, code: string): Promise<void> {
  await expect(importer.import(file)).rejects.toMatchObject({ code })
}

describe('PrskCharacterArchiveImporter', () => {
  it('중첩 atlas와 상대 PNG를 런타임 독립 bundle로 정규화하고 여분 파일을 조용히 무시한다', async () => {
    const file = await createZipFile([
      {
        name: 'character/sekai_atlas.atlas',
        content: VALID_ATLAS.replace('page.png', 'textures/page.png'),
      },
      { name: 'character/textures/page.png', content: 'png' },
      { name: 'character/readme.txt', content: 'ignored' },
    ])

    const result = await importer.import(file)

    expect(result.sourceName).toBe('character.zip')
    expect(result.atlasPath).toBe('character/sekai_atlas.atlas')
    expect([...result.atlasPages.keys()]).toEqual([
      'character/textures/page.png',
    ])
    expect(result.atlasPages.get('character/textures/page.png')).toMatchObject({
      size: 3,
      type: 'image/png',
    })
    expect(Object.keys(result)).not.toContain('warnings')
    expect(Object.keys(result)).not.toContain('objectUrl')
  })

  it('손상 ZIP을 구분한다', async () => {
    await expectImportError(
      new File(['not-a-zip'], 'broken.zip'),
      'ARCHIVE_CORRUPT',
    )
  })

  it.each([
    {
      code: 'ARCHIVE_ENCRYPTED_ENTRY',
      entries: [
        {
          name: 'secret.txt',
          content: 'secret',
          password: 'password',
        },
      ],
      name: '암호화 항목',
    },
    {
      code: 'ATLAS_MISSING',
      entries: [{ name: 'page.png', content: 'png' }],
      name: 'atlas 없음',
    },
    {
      code: 'ATLAS_MULTIPLE',
      entries: [
        { name: 'a/sekai_atlas.atlas', content: VALID_ATLAS },
        { name: 'b/sekai_atlas.atlas', content: VALID_ATLAS },
      ],
      name: 'atlas 여러 개',
    },
    {
      code: 'ARCHIVE_SKEL_FORBIDDEN',
      entries: [
        { name: 'sekai_atlas.atlas', content: VALID_ATLAS },
        { name: 'page.png', content: 'png' },
        { name: 'shared.SKEL', content: 'skeleton' },
      ],
      name: '.skel 포함',
    },
    {
      code: 'ATLAS_PAGE_LIST_EMPTY',
      entries: [
        { name: 'sekai_atlas.atlas', content: '' },
        { name: 'page.png', content: 'png' },
      ],
      name: '빈 atlas 페이지 목록',
    },
    {
      code: 'ATLAS_PAGE_MISSING',
      entries: [{ name: 'sekai_atlas.atlas', content: VALID_ATLAS }],
      name: '참조 PNG 누락',
    },
    {
      code: 'ATLAS_UNSUPPORTED_PAGE_FORMAT',
      entries: [
        {
          name: 'sekai_atlas.atlas',
          content: VALID_ATLAS.replace('page.png', 'page.webp'),
        },
        { name: 'page.webp', content: 'image' },
      ],
      name: 'PNG가 아닌 참조',
    },
    {
      code: 'ATLAS_DUPLICATE_PAGE',
      entries: [
        {
          name: 'sekai_atlas.atlas',
          content: `${VALID_ATLAS}\n${VALID_ATLAS.replace('page.png', './page.png')}`,
        },
        { name: 'page.png', content: 'png' },
      ],
      name: '정규화 후 중복 페이지',
    },
    {
      code: 'ARCHIVE_UNSAFE_PATH',
      entries: [
        {
          name: 'nested/sekai_atlas.atlas',
          content: VALID_ATLAS.replace('page.png', '../../page.png'),
        },
        { name: 'page.png', content: 'png' },
      ],
      name: 'atlas 참조 경로 탈출',
    },
  ])('$name을 $code로 거부한다', async ({ code, entries }) => {
    await expectImportError(await createZipFile(entries), code)
  })

  it('strict UTF-8이 아닌 atlas를 거부한다', async () => {
    await expectImportError(
      await createZipFile([
        {
          name: 'sekai_atlas.atlas',
          content: new Uint8Array([0xc3, 0x28]),
        },
        { name: 'page.png', content: 'png' },
      ]),
      'ATLAS_INVALID_TEXT',
    )
  })

  it('안전하지 않은 ZIP 경로와 정규화 충돌을 거부한다', async () => {
    await expectImportError(
      createMetadataOnlyZipFile([{ name: '../sekai_atlas.atlas' }]),
      'ARCHIVE_UNSAFE_PATH',
    )
    await expectImportError(
      createMetadataOnlyZipFile([
        { name: 'a/../sekai_atlas.atlas' },
        { name: 'sekai_atlas.atlas' },
      ]),
      'ARCHIVE_PATH_COLLISION',
    )
    await expectImportError(
      createMetadataOnlyZipFile([{ name: '../unused-readme.txt' }]),
      'ARCHIVE_UNSAFE_PATH',
    )
  })

  it('Windows separator를 먼저 slash로 바꿔 경로와 atlas page를 정규화한다', () => {
    expect(normalizeArchivePath('character\\textures\\page.png')).toBe(
      'character/textures/page.png',
    )
    expect(
      resolveAtlasPagePath(
        'character/sekai_atlas.atlas',
        'textures\\page.png',
      ),
    ).toBe('character/textures/page.png')
  })

  it('separator 정규화 후 ZIP 경로 충돌을 거부한다', async () => {
    await expectImportError(
      createMetadataOnlyZipFile([
        { name: 'character\\readme.txt' },
        { name: 'character/readme.txt' },
      ]),
      'ARCHIVE_PATH_COLLISION',
    )
  })

  it.each(['/absolute/path', 'C:relative-drive-path', 'C:\\absolute', 'bad\0path'])(
    '안전하지 않은 경로 %s를 거부한다',
    (path) => {
      expect(() => normalizeArchivePath(path)).toThrowError(
        expect.objectContaining({ code: 'ARCHIVE_UNSAFE_PATH' }),
      )
    },
  )

  it('압축 파일 크기 제한을 압축 해제 전에 적용한다', async () => {
    const oversized = {
      name: 'large.zip',
      size: PRSK_ARCHIVE_LIMITS.compressedBytes + 1,
    } as File

    await expectImportError(oversized, 'ARCHIVE_TOO_LARGE')
  })

  it('압축 해제 합계와 파일 항목 수 제한을 metadata로 적용한다', async () => {
    await expectImportError(
      createMetadataOnlyZipFile([
        {
          name: 'sekai_atlas.atlas',
          uncompressedSize: PRSK_ARCHIVE_LIMITS.uncompressedBytes + 1,
        },
      ]),
      'ARCHIVE_UNCOMPRESSED_LIMIT_EXCEEDED',
    )

    await expectImportError(
      createMetadataOnlyZipFile(
        Array.from({ length: PRSK_ARCHIVE_LIMITS.fileEntries + 1 }, (_, index) => ({
          name: `entry-${index}.txt`,
        })),
      ),
      'ARCHIVE_ENTRY_LIMIT_EXCEEDED',
    )
  })

  it('미사용 여분 파일도 해제 크기와 항목 수 제한에 포함한다', async () => {
    await expectImportError(
      createMetadataOnlyZipFile([
        { name: 'sekai_atlas.atlas' },
        {
          name: 'unused.bin',
          uncompressedSize: PRSK_ARCHIVE_LIMITS.uncompressedBytes + 1,
        },
      ]),
      'ARCHIVE_UNCOMPRESSED_LIMIT_EXCEEDED',
    )

    await expectImportError(
      createMetadataOnlyZipFile([
        { name: 'sekai_atlas.atlas' },
        ...Array.from(
          { length: PRSK_ARCHIVE_LIMITS.fileEntries },
          (_, index) => ({ name: `unused-${index}.txt` }),
        ),
      ]),
      'ARCHIVE_ENTRY_LIMIT_EXCEEDED',
    )
  })

  it('압축 해제 합계와 파일 항목 수의 정확한 상한은 허용한다', async () => {
    await expectImportError(
      createMetadataOnlyZipFile([
        {
          name: 'payload.bin',
          uncompressedSize: PRSK_ARCHIVE_LIMITS.uncompressedBytes,
        },
      ]),
      'ATLAS_MISSING',
    )

    await expectImportError(
      createMetadataOnlyZipFile(
        Array.from({ length: PRSK_ARCHIVE_LIMITS.fileEntries }, (_, index) => ({
          name: `entry-${index}.txt`,
        })),
      ),
      'ATLAS_MISSING',
    )
  })
})
