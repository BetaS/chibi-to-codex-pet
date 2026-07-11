## Why

현재 미리보기는 animation 이름을 직접 검색하거나 상태별 select에 focus해야만 특정 Codex Pet 상태의 동작을 확인할 수 있어, 9개 표준 상태를 빠르게 비교하기 어렵다. 사용자가 mapping을 변경하지 않고도 각 상태를 명시적인 아이콘으로 즉시 재생할 수 있는 진입점이 필요하다.

## What Changes

- ready Codex Pet mapping UI에 9개 표준 상태 순서의 아이콘 바로가기 group을 추가한다.
- 상태 바로가기를 누르면 현재 mapping의 실제 source animation을 기존 활성 Spine preview session에서 즉시 재생한다.
- 기존 animation 직접 검색·선택과 상태별 mapping select를 그대로 유지하며, 바로가기는 mapping, mirror, package 결과 또는 network 상태를 변경하지 않는다.
- 아이콘 button에 현재 locale의 상태명과 동작 설명을 accessible name, tooltip과 현재 선택 상태로 제공한다.
- source가 없거나 mapping이 준비되지 않은 경우 바로가기를 비활성화하고 별도 renderer나 spritesheet를 만들지 않는다.
- 모바일 toolbar에서는 9개 바로가기를 패널 폭 안의 3×3 grid로 배치하고 가로 overflow나 다른 toolbar control과의 겹침을 허용하지 않는다.

## Capabilities

### New Capabilities

없음.

### Modified Capabilities

- `codex-pet-animation-mapping`: 9개 상태의 명시적 아이콘 바로가기와 현재 mapping 기반 실시간 Spine 재생 계약을 추가한다.
- `web-ui-localization`: 상태 바로가기의 label, tooltip, 선택 상태와 ARIA 문구를 네 locale catalog에 포함한다.

## Impact

- Codex Pet Builder의 상태 매핑 UI, preview callback과 상태별 표시 metadata가 변경된다.
- 상태 바로가기 layout과 선택 상태를 위한 CSS가 추가되며, 모바일 세로 toolbar의 flex wrapping을 별도로 제한한다.
- component 및 Chromium 회귀 테스트가 직접 animation 선택과 상태 바로가기 공존, 무부작용 재생과 다국어 접근성을 검증한다.
