## Why

게임 provider가 늘어날 때 현재 3열 고정 탭은 확장 규칙이 없고, 원하는 게임이 없는 사용자가 지원을 요청할 경로도 화면에 없다. Provider 선택 영역을 최대 4열 grid로 확장하고 항상 발견 가능한 GitHub Issue 진입점을 제공한다.

## What Changes

- Provider tablist를 현재 registry 항목 수에 따라 1–4열로 배치하고, 다섯 번째 provider부터 다음 행에 배치한다.
- 작은 화면에서는 열 수를 줄여 탭 label과 상태가 잘리거나 가로 overflow가 생기지 않게 한다.
- Provider tablist 바로 아래에 지원 locale별 `새 게임 지원요청` 링크를 항상 표시한다.
- 지원 요청 링크는 `https://github.com/BetaS/chibi-to-codex-pet/issues/new`을 새 탭에서 열고 현재 선택된 provider와 integration 상태를 변경하지 않는다.
- 외부 링크를 game tab으로 오인하지 않도록 tablist 밖에 두고, 새 탭 동작을 포함한 accessible name을 제공한다.

## Capabilities

### New Capabilities

없음.

### Modified Capabilities

- `game-source-selection`: Provider 탭의 최대 4열 grid 배치와 tablist 하단의 새 게임 지원 요청 링크 계약을 추가한다.

## Impact

- `AppContent`의 provider navigation markup과 grid column 계산이 변경된다.
- `src/styles.css`의 game source tablist와 지원 요청 링크에 반응형 style이 추가된다.
- 지원 locale message catalog와 App 접근성·routing 회귀 test가 변경된다.
- Game source registry, provider integration lifecycle, GitHub 인증, application dependency에는 변경이 없다.
