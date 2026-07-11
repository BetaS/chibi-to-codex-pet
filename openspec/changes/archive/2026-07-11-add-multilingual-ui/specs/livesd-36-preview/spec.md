## MODIFIED Requirements

### Requirement: 안정적인 LiveSD 진단 계약
runtime loader와 `LiveSD36Adapter`가 반환하는 알려진 실패는 아래의 안정적인 영문 code만 사용해야 하며(MUST), browser UI는 code와 문제 해결에 필요한 현재 locale의 message를 함께 표시해야 한다(MUST). 관련 path 또는 실제 input version이 있으면 구조화된 정보나 localized message에 포함해야 한다(MUST). 알려지지 않은 예외는 stack이나 원문 예외를 노출하지 않고 `PREVIEW_UNKNOWN_ERROR`와 현재 locale의 일반 message로 정규화해야 한다(MUST). compatibility metadata는 programmatic contract로만 제공하고 UI에 label, badge 또는 warning으로 표시해서는 안 된다(MUST NOT).

```text
RuntimeLoadErrorCode =
  RUNTIME_SCRIPT_LOAD_FAILED
  RUNTIME_GLOBAL_MISSING

LiveSDPreviewErrorCode =
  ANIMATION_MISSING
  ANIMATION_UNKNOWN
  ATLAS_IMAGE_DECODE_FAILED
  ATLAS_RUNTIME_PARSE_FAILED
  PREVIEW_RENDERER_CREATE_FAILED
  PREVIEW_RENDER_FAILED
  SKELETON_HEADER_CORRUPT
  SKELETON_PARSE_FAILED
  WEBGL_UNSUPPORTED

PreviewUIFallbackErrorCode =
  PREVIEW_UNKNOWN_ERROR

LiveSDSkeletonCompatibility =
  verified
  experimental
  best_effort
```

#### Scenario: 알려진 오류 표시
- **WHEN** runtime loader 또는 adapter가 위 enum의 알려진 오류를 반환한다
- **THEN** UI는 안정적인 영문 code와 현재 locale의 실행 가능한 message를 함께 표시해야 한다

#### Scenario: 알 수 없는 예외 정규화
- **WHEN** importer, input, runtime 또는 preview 경계 밖의 예외가 UI까지 전파된다
- **THEN** UI는 raw exception이나 stack 대신 `PREVIEW_UNKNOWN_ERROR`와 현재 locale의 일반 오류 message를 표시해야 한다

#### Scenario: locale 전환 뒤 오류 표시
- **WHEN** preview 오류가 표시된 상태에서 locale을 변경한다
- **THEN** 동일한 stable code는 유지되고 message만 새 locale로 즉시 변경되어야 한다

#### Scenario: compatibility 비표시
- **WHEN** 세션 또는 header가 `experimental`이나 `best_effort` compatibility를 가진다
- **THEN** 호출자는 metadata를 programmatic하게 읽을 수 있지만 UI는 compatibility 상태를 표시하지 않는다

#### Scenario: parse 실패 정보
- **WHEN** `SKELETON_PARSE_FAILED`를 사용자에게 표시한다
- **THEN** message는 실제 input version과 사용한 LiveSD runtime `3.6`을 포함하고 `verified`, `experimental`, `best_effort` label은 포함하지 않는다
