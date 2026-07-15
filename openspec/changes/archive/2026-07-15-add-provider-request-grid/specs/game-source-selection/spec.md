## MODIFIED Requirements

### Requirement: 상단 게임 선택 탭
앱은 model source, preview와 Codex Pet builder보다 위에 게임 선택 tablist를 표시해야 한다(SHALL). Tablist는 registry 순서를 유지하는 grid여야 하며(MUST), 넓은 화면에서 현재 provider 수와 4 중 작은 값을 열 수로 사용하고(MUST), 네 개를 초과하는 provider는 다음 행에 배치해야 한다(MUST). 좁은 화면에서는 label과 상태가 잘리거나 가로 overflow가 생기지 않도록 열 수를 2개 이하, mobile에서는 1개로 줄여야 한다(MUST). 초기 선택은 `프로세카`여야 하며(MUST), 선택된 available 탭, 선택 가능한 available 탭과 준비중 탭의 상태를 시각적·programmatic 방식으로 구분해야 한다(MUST).

#### Scenario: 기본 초기 화면
- **WHEN** 사용자가 앱에 처음 진입한다
- **THEN** 상단 tablist에 `프로세카`, `레뷰 스타라이트`, `BanG Dream!`이 순서대로 표시되어야 한다
- **AND** 세 provider는 같은 행을 채우는 3열 grid로 배치되어야 한다
- **AND** `프로세카`는 선택 상태여야 한다
- **AND** `레뷰 스타라이트`와 `BanG Dream!`도 선택 가능하고 어느 탭에도 `준비중` 상태가 표시되어서는 안 된다

#### Scenario: 기본 설정의 접근 가능한 탭 상태
- **WHEN** 보조 기술이 게임 tablist를 탐색한다
- **THEN** 선택된 `프로세카`는 selected 상태로 노출되어야 한다
- **AND** `레뷰 스타라이트`와 `BanG Dream!`은 모두 enabled tab으로 노출되어야 한다

#### Scenario: 다섯 개 이상의 provider 배치
- **WHEN** registry가 다섯 개 이상의 provider를 노출한다
- **THEN** 첫 행에는 registry 순서대로 최대 네 개의 tab만 배치되어야 한다
- **AND** 다섯 번째 이후 tab은 다음 행에서 같은 grid 순서를 이어가야 한다

#### Scenario: 좁은 화면의 provider 배치
- **WHEN** viewport가 desktop 4열을 안전하게 표시할 수 없는 폭으로 줄어든다
- **THEN** tablist는 2열 이하로 줄어야 한다
- **AND** mobile 폭에서는 각 provider tab이 한 행을 차지하고 가로 overflow가 없어야 한다

## ADDED Requirements

### Requirement: 새 게임 지원 요청 링크
게임 선택 navigation은 provider tablist 바로 아래에 locale별 `새 게임 지원요청` link를 항상 표시해야 한다(MUST). Link는 game tablist와 tab selection model 밖의 native anchor여야 하고(MUST), `https://github.com/BetaS/chibi-to-codex-pet/issues/new`을 새 browsing context에서 열어야 하며(MUST), opener referrer를 전달하지 않아야 한다(MUST). Accessible name은 지원 요청과 새 창 동작을 함께 알려야 한다(MUST).

#### Scenario: 기본 화면의 지원 요청
- **WHEN** 사용자가 앱에 처음 진입한다
- **THEN** provider tablist 다음에 `새 게임 지원요청` link가 표시되어야 한다
- **AND** link는 game tab이 아니며 정확한 GitHub Issue 작성 URL, 새 창 target과 안전한 relation을 가져야 한다

#### Scenario: 지원 요청 link 활성화
- **WHEN** 사용자가 어느 provider를 선택한 상태에서 `새 게임 지원요청`을 활성화한다
- **THEN** browser는 GitHub Issue 작성 URL을 새 browsing context에서 열어야 한다
- **AND** 현재 선택된 provider와 mounted integration 상태를 변경해서는 안 된다

#### Scenario: locale 변경
- **WHEN** 사용자가 지원 locale을 변경한다
- **THEN** 지원 요청의 visible label과 accessible name은 선택한 locale로 표시되어야 한다
- **AND** GitHub Issue 작성 URL과 새 창 동작은 동일하게 유지되어야 한다
