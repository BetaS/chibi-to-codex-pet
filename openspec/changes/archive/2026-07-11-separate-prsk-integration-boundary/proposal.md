## Why

현재 PRSK 전용 가져오기, 개발 입력, 원격 provider 코드가 `src/features/livesd/importer`, `input`, `remote`에 범용 LiveSD 코드와 같은 수준으로 흩어져 있다. 이 구조에서는 새 LiveSD source나 후속 Live2D 지원을 추가할 때 PRSK 규칙과 범용 렌더링 계약의 경계가 불명확하므로, 기존 동작을 유지하면서 PRSK 통합을 명시적인 폴더와 공개 진입점으로 격리할 필요가 있다.

## What Changes

- PRSK 전용 archive importer, 개발용 asset 입력, remote catalog/resource provider와 관련 오류·타입·테스트를 `src/features/livesd/prsk/` 아래로 모은다.
- `LiveSDAtlasBundle`과 atlas page path 처리처럼 런타임·exporter도 사용하는 source 독립 계약을 PRSK importer에서 분리해 범용 LiveSD 계층으로 옮긴다.
- 앱, Codex Pet recipe renderer, UI 오류 정규화는 PRSK 내부 파일이 아니라 `prsk` 공개 진입점을 통해서만 통합 기능을 사용한다.
- 범용 LiveSD adapter, runtime, rendering, frame export와 공용 UI는 PRSK 폴더를 직접 참조하지 않도록 의존성 방향을 정리한다.
- PRSK LiveSD 모델의 기본 왼쪽 방향을 보정할 수 있도록 전체 출력 수평 반전 선택을 제공하고, `running-right`와 `running-left`에는 서로 독립적인 상태별 수평 반전 선택을 제공한다.
- 전체 반전과 상태별 반전은 XOR로 합성하고, look frame의 의미 방향과 recipe/CLI 재현성을 보존한다.
- 앱 상단에 게임 source 탭을 추가하고 `프로세카(prsk)`, `레뷰 스타라이트(strr)`, `BanG Dream!(garupa)`의 안정적인 ID·표시명·지원 상태를 단일 registry로 관리한다.
- 초기 선택은 활성화된 `프로세카`로 두고 PRSK integration을 builder에 연결한다. `레뷰 스타라이트`와 `BanG Dream!`은 `준비중`으로 표시하며 선택, resource 요청과 build 진입을 비활성화한다.
- PRSK 입력의 기본값을 기본 제공 resource manifest인 `prsk-chibi-viewer`로 변경하고, 로컬 resource 업로드와 custom provider는 사용자가 선택하는 대체 입력으로 둔다.
- 기존 `prsk-chibi-viewer 사용`과 `목록 불러오기` 두 버튼을 현재 선택된 provider를 실행하는 단일 `불러오기` 버튼으로 통합한다.
- 페이지 진입 시 개발 기본 모델 자동 import·preview와 원격 catalog 자동 요청을 실행하지 않고, 사용자의 `불러오기` 또는 local preview 동작 전까지 idle 상태를 유지한다.
- Codex Pet 상태 매핑을 선택하거나 변경하면 별도 sprite 근사본이 아니라 현재 Spine preview session에서 해당 source animation을 즉시 재생한다.
- preview 위 포인터 위치를 export와 같은 `eye_scale` bone 변환으로 반영하고, 눈 이동량 slider를 실시간 preview와 16방향 look frame export가 함께 사용하게 한다.
- 파일 이동 후에도 local ZIP, development fallback, custom remote provider, `prsk-chibi-viewer` snapshot, preview와 기존 오류 코드를 그대로 유지하며, 방향 설정 외 package 동작을 보존한다.
- 구조 회귀를 막는 import-boundary 검사와 기존 단위·컴포넌트·E2E·production artifact 검증을 추가하거나 갱신한다.

## Capabilities

### New Capabilities

- `prsk-integration-boundary`: PRSK 전용 구현의 디렉터리 소유권, 공개 API, 범용 LiveSD 계층과의 의존성 방향 및 무동작변경 이전 요구사항을 정의한다.
- `game-source-selection`: 상단 게임 탭, 안정적인 game ID와 지원 상태, 선택한 game integration을 통한 builder routing 및 준비중 게임의 비활성 동작을 정의한다.
- `resource-source-selection`: 기본 제공 resource manifest, 선택적인 local/custom resource 입력, 단일 불러오기 동작과 페이지 진입 시 무자동갱신 계약을 정의한다.

### Modified Capabilities

- `codex-pet-animation-mapping`: PRSK 전체 방향 보정, 좌·우 이동 상태의 독립적인 수평 반전과 상태별 실시간 Spine preview 연결을 추가한다.
- `livesd-frame-sampling`: 전체 반전과 상태별 반전의 합성, look 방향 의미 보존 및 preview/export의 눈 이동 변환 공유를 추가한다.
- `npx-pet-installation`: 선택한 전체 방향 보정을 recipe에 보존하고 headless renderer에서 동일하게 재현한다.

## Impact

- 주요 대상: `src/features/livesd/{importer,input,remote}`, `src/features/livesd/adapter`, `src/features/livesd/export`, `src/features/livesd/ui`, game/resource source registry, `src/App.tsx`, `src/features/codex-pet/{animationMapping,CodexPetBuilder,recipe,recipeRenderer}`와 대응 테스트.
- 테스트·검증 대상: Vitest import, Playwright fixture 경로, production artifact 검사와 로컬 PRSK asset 경로.
- recipe schema에는 전체 방향 보정 값이 추가된다. 네트워크 정책, ZIP/pet manifest 형식, 오류 코드 및 외부 dependency에는 변경이 없다.
