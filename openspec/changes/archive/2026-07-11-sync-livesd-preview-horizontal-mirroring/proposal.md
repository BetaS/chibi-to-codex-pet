## Why

Codex Pet builder의 전체 수평 반전과 `running-left`·`running-right` 상태별 반전은 export frame에는 적용되지만, 현재 LiveSD preview는 animation 이름만 재생해 실제 생성 결과의 방향을 보여주지 않는다. 사용자가 상태 바로가기와 mapping editor에서 확인한 방향이 최종 Pet과 일치하도록 preview session까지 같은 반전 계약을 연결해야 한다.

## What Changes

- `LiveSDPreviewSession`에 현재 projection을 중심으로 수평 반전하는 runtime 독립 API를 추가한다.
- 전체 반전과 활성 상태의 `mirrorX`를 export와 동일하게 XOR 합성해 상태 바로가기, mapping focus·변경과 mirror checkbox에 즉시 반영한다.
- 직접 animation combobox는 상태 선택을 해제하되 현재 전체 반전은 유지한다.
- 반전된 preview에서도 pointer 기준 눈 이동의 화면상 좌우 의미가 유지되도록 look target을 보정한다.
- source 교체에서는 반전 preview 상태를 기본값으로 초기화하고 locale 전환에서는 보존한다.
- unit/component 및 실제 WebGL pixel 회귀로 반전 방향과 기존 session 재사용을 검증한다.

## Capabilities

### New Capabilities

없음.

### Modified Capabilities

- `livesd-36-preview`: 활성 session의 projection 기반 수평 반전과 반전된 화면 좌표의 pointer look 의미를 추가한다.
- `codex-pet-animation-mapping`: 전체·상태별 mirror XOR 결과를 실시간 LiveSD 상태 preview에도 적용하는 요구사항을 추가한다.

## Impact

- `LiveSDPreviewSession` interface와 `WebGLLiveSDPreviewSession` projection 처리
- `CodexPetBuilder`의 전체·상태별 mirror snapshot callback
- `PrskIntegration`의 direct/state preview 전환과 source lifecycle
- adapter, builder, App component 및 실제 PRSK Playwright 검증
- export frame, recipe, manifest와 package schema 변경 없음
