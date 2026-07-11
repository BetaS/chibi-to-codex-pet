## Why

페이지를 다시 열거나 새 모델 session을 시작할 때 framing, 반전, 상태별 animation과 Pet metadata가 모두 초기화되어 반복 설정 비용이 크다. 또한 상태별 animation은 일반 `<select>`라 animation이 많은 LiveSD 스켈레톤에서 원하는 항목을 빠르게 찾기 어렵다.

## What Changes

- 검증된 Codex Pet build가 성공하면 Pet 표시 이름을 key로 현재 설정 preset을 versioned same-origin `localStorage`에 저장한다.
- 마지막으로 저장하거나 선택한 preset을 다음 방문의 기본 preset으로 복원하고, preset dropdown에서 다른 preset 또는 `새 세션`을 선택할 수 있게 한다.
- preset은 framing scale·X/Y offset, 눈 이동량, 전체·상태별 반전, Pet metadata와 상태별 animation 이름만 저장한다.
- 모델 byte, ZIP, atlas/PNG, provider URL, character ID, download URL, 생성 package와 validation 결과는 저장하지 않는다.
- 저장된 animation이 새 source에 없으면 해당 상태만 현재 source의 추천 mapping으로 안전하게 fallback한다.
- 손상되었거나 지원하지 않는 preset storage는 제거하거나 무시하고 앱과 현재 session을 계속 사용할 수 있게 한다.
- 9개 상태별 animation `<select>`를 현재 스켈레톤의 실제 animation만 검색하는 accessible combobox로 교체한다.
- preset 및 mapping 검색 UI의 보이는 문구와 ARIA 이름을 한국어·영어·일본어·중국어로 제공한다.

## Capabilities

### New Capabilities

- `pet-settings-presets`: Pet 이름 기반 versioned preset 저장, 마지막 preset 복원, preset 전환과 새 session reset의 수명주기·개인정보 계약

### Modified Capabilities

- `codex-pet-animation-mapping`: 상태별 animation control을 검색 가능한 실제 animation combobox로 확장한다.
- `web-app-foundation`: locale 외에 명시적으로 허용된 versioned Pet preset만 same-origin localStorage에 저장하도록 production persistence 정책을 변경한다.
- `web-ui-localization`: preset selector와 상태별 searchable animation UI를 네 locale catalog에 포함한다.

## Impact

- Codex Pet builder 상태 초기화·생성 완료 흐름과 PRSK integration framing state가 preset 선택을 소비하도록 변경된다.
- versioned preset schema, parser, bounded localStorage repository와 손상 복구 테스트가 추가된다.
- 상태 mapping row가 공용 `SearchableCombobox`를 사용하도록 바뀌고 keyboard·query 동작 테스트가 확장된다.
- production artifact 검증의 localStorage allowlist가 locale과 Pet preset module 두 곳으로 확장된다.
