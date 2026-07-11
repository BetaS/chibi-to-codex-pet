# 게임 source 선택 명세

## Purpose

사용자는 상단 탭에서 게임을 선택하고 해당 게임 integration으로 resource loading부터 Codex Pet build까지 진행한다. Registry는 표시 이름, 지원 상태와 integration routing의 단일 기준이다.

## Requirements

### Requirement: 게임 source registry
시스템은 지원 대상 게임을 안정적인 ID, locale message key, 노출 순서, 지원 상태와 선택 가능한 integration으로 정의하는 단일 registry를 제공해야 한다(SHALL). Registry 순서는 `prsk`, `strr`, `garupa`이고(MUST), label은 현재 locale에서 아래 값으로 해석해야 한다(MUST).

| ID | `ko` | `en` | `ja` | `zh-CN` |
|---|---|---|---|---|
| `prsk` | 프로세카 | Project SEKAI | プロセカ | 世界计划 |
| `strr` | 레뷰 스타라이트 | Revue Starlight | 少女☆歌劇 レヴュースタァライト | 少女☆歌剧 Revue Starlight |
| `garupa` | BanG Dream! | BanG Dream! | BanG Dream! | BanG Dream! |

#### Scenario: 초기 게임 목록 조회
- **WHEN** 앱이 게임 source registry를 조회한다
- **THEN** 첫 항목은 `id: "prsk"`, `labelKey: "game.prsk"`, 상태 `available`과 PRSK integration을 가져야 한다
- **AND** 두 번째 항목은 `id: "strr"`, `labelKey: "game.strr"`, 상태 `coming-soon`이고 integration이 없어야 한다
- **AND** 세 번째 항목은 `id: "garupa"`, `labelKey: "game.garupa"`, 상태 `coming-soon`이고 integration이 없어야 한다

#### Scenario: 표시와 routing의 단일 정의
- **WHEN** 활성 게임 탭을 렌더링하고 builder integration을 결정한다
- **THEN** 두 동작은 같은 registry entry를 사용해야 한다
- **AND** localized label 문자열은 routing key로 사용하지 않고 stable ID와 status로 integration을 결정해야 한다

### Requirement: 상단 게임 선택 탭
앱은 model source, preview와 Codex Pet builder보다 위에 게임 선택 tablist를 표시해야 한다(SHALL). 초기 선택은 `프로세카`여야 하며(MUST), 선택된 available 탭과 준비중 탭의 상태를 시각적·programmatic 방식으로 구분해야 한다(MUST).

#### Scenario: 초기 화면
- **WHEN** 사용자가 앱에 처음 진입한다
- **THEN** 상단 tablist에 `프로세카`, `레뷰 스타라이트`, `BanG Dream!`이 순서대로 표시되어야 한다
- **AND** `프로세카`는 선택 상태여야 한다
- **AND** `레뷰 스타라이트`와 `BanG Dream!`에는 `준비중` 상태가 표시되어야 한다

#### Scenario: 접근 가능한 탭 상태
- **WHEN** 보조 기술이 게임 tablist를 탐색한다
- **THEN** 선택된 `프로세카`는 selected 상태로 노출되어야 한다
- **AND** `레뷰 스타라이트`와 `BanG Dream!`은 disabled 또는 `aria-disabled`에 해당하는 비활성 상태와 `준비중` 이름을 노출해야 한다

### Requirement: 선택된 게임 integration으로 빌드
시스템은 현재 선택된 available game entry의 integration을 통해 source 입력, resource loading, preview, 방향 설정과 Codex Pet build를 수행해야 한다(SHALL). 초기 `prsk` entry는 `src/features/livesd/prsk/` 공개 integration에 연결되어야 한다(MUST).

#### Scenario: 프로세카 선택 상태의 local build
- **WHEN** `프로세카`가 선택된 상태에서 사용자가 유효한 local PRSK source를 준비한다
- **THEN** 앱은 PRSK archive와 LiveSD preview 계약을 사용해야 한다
- **AND** PRSK 방향 설정을 포함해 Codex Pet build를 제공해야 한다

#### Scenario: 프로세카 선택 상태의 remote build
- **WHEN** `프로세카`가 선택된 상태에서 사용자가 PRSK remote catalog와 model을 명시적으로 불러온다
- **THEN** 앱은 PRSK 공개 integration의 provider와 resource loader만 사용해야 한다
- **AND** 생성 recipe는 PRSK provider 계약을 사용해야 한다

### Requirement: 준비중 게임의 비활성 탭 상태
선택 가능한 탭은 실행 가능한 integration을 가진 `available` entry로 제한해야 한다(MUST). `coming-soon`인 `strr`와 `garupa` 탭은 비활성 상태를 표시하고(MUST), activation event가 발생해도 현재 `prsk` 선택, source UI, request, preview session과 build 상태를 유지해야 한다(MUST).

#### Scenario: 레뷰 스타라이트 활성화 시도
- **WHEN** 사용자가 pointer, keyboard 또는 programmatic UI event로 `레뷰 스타라이트(준비중)` 탭 활성화를 시도한다
- **THEN** 선택된 game ID는 `prsk`로 유지되어야 한다
- **AND** STRR 또는 PRSK resource request가 새로 시작되어서는 안 된다
- **AND** 현재 PRSK 입력, preview와 builder 상태가 유지되어야 한다

#### Scenario: BanG Dream! 활성화 시도
- **WHEN** 사용자가 pointer, keyboard 또는 programmatic UI event로 `BanG Dream!(준비중)` 탭 활성화를 시도한다
- **THEN** 선택된 game ID는 `prsk`로 유지되어야 한다
- **AND** Garupa 또는 PRSK resource request가 새로 시작되어서는 안 된다
- **AND** Codex Pet build가 Garupa integration으로 실행되어서는 안 된다

### Requirement: 게임 integration 활성화 조건
Registry의 `available` entry는 해당 ID의 source lifecycle, preview 입력과 builder source 계약을 구현한 integration을 가져야 한다(MUST). Registry validation은 이 조건을 충족한 entry만 선택 가능한 상태로 허용해야 한다(MUST).

#### Scenario: integration 없는 상태 변경 거부
- **WHEN** `strr` 또는 `garupa` entry에 실행 가능한 integration 없이 상태를 `available`로 구성한다
- **THEN** type 또는 registry 검증이 해당 구성을 거부해야 한다

#### Scenario: 향후 available 게임 전환
- **WHEN** 향후 게임이 검증된 integration과 함께 `available`로 등록된다
- **THEN** 탭 선택은 기존 active request와 preview session을 정리한 뒤 새 integration을 mount해야 한다
- **AND** 이전 게임의 source, recipe 또는 방향 설정을 새 게임에 재사용해서는 안 된다
