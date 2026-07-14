import { describe, expect, it } from 'vitest'

import { localizeErrorNotice } from './errorMessages'
import { translateMessage } from './messages'

describe('localized browser errors', () => {
  it('stable code와 기술 detail은 유지하고 한국어 원문 대신 현재 locale 안내를 쓴다', () => {
    const message = localizeErrorNotice(
      'en',
      (key, values) => translateMessage('en', key, values),
      {
        code: 'SKELETON_PARSE_FAILED',
        message: '3.3 공통 스켈레톤을 LiveSD 3.6 runtime으로 파싱하지 못했습니다.',
        details: { path: 'base_model/sekai_skeleton.skel' },
      },
    )

    expect(message).toContain('skeleton')
    expect(message).toContain('3.3')
    expect(message).toContain('base_model/sekai_skeleton.skel')
    expect(message).not.toMatch(/[가-힣]/u)
  })

  it('unknown exception은 선택 locale의 일반 오류로 정규화한다', () => {
    expect(localizeErrorNotice(
      'ja',
      (key, values) => translateMessage('ja', key, values),
      { code: 'PREVIEW_UNKNOWN_ERROR', message: '내부 비밀 오류' },
    )).toBe('プレビューの準備中に不明なエラーが発生しました。')
  })

  it('한국어에서도 내부 원문 대신 사용자 복구 안내를 쓴다', () => {
    expect(localizeErrorNotice(
      'ko',
      (key, values) => translateMessage('ko', key, values),
      {
        code: 'REMOTE_NETWORK_OR_CORS',
        message: '원격 서버의 CORS 설정과 request generation을 확인하세요.',
      },
    )).toBe('서버에 연결하지 못했습니다. 네트워크와 URL을 확인해주세요.')
  })
})
