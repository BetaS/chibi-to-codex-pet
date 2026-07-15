## Why

저장 프리셋이 선택된 상태에서도 provider의 character catalog 불러오기 action이 비활성 상태로 남아 있어, 사용자는 왜 실행할 수 없는지와 새 작업을 어떻게 시작해야 하는지 직관적으로 알기 어렵다. 프리셋 복원과 새 session의 source 선택 경로를 시각적으로 분리하고, 저장 프리셋에서 새 session으로 전환하는 명시적 동작을 제공한다.

## What Changes

- PRSK, STRR, Garupa의 remote character catalog/list 불러오기 action을 preset dropdown이 `새 세션`인 동안에만 표시하고 기존 활성화 조건을 만족할 때 실행할 수 있게 한다.
- 저장 프리셋이 대기 선택된 동안 공통 프리셋 영역에 locale별 `새로 만들기` action을 표시한다.
- `새로 만들기`는 preset dropdown의 `새 세션` option을 선택한 것과 동일한 reset·request 취소·storage 갱신 경로를 사용한다.
- Local upload file 선택과 명시적 local import는 기존 동작을 유지한다.
- 공통 UI와 세 provider의 회귀 테스트 및 provider development harness로 visibility와 동일 동작 계약을 고정한다.

## Capabilities

### New Capabilities

없음.

### Modified Capabilities

- `pet-settings-presets`: 새 session에서만 remote catalog action을 노출하고, 저장 프리셋에서 동일한 새 session 전환을 제공하도록 loader 계약을 변경한다.

## Impact

- 공통 `CodexPetPresetLoader`의 action 구성과 지원 locale message가 변경된다.
- PRSK, STRR, Garupa integration의 `catalog-load` capability 표시 조건이 변경된다.
- Preset selection callback과 기존 session reset 로직은 유지하며, component 및 provider integration/harness 테스트가 추가·갱신된다.
- 저장 schema, provider API, network transport, local upload 계약과 production dependency에는 변경이 없다.
