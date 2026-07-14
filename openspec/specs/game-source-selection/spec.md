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

#### Scenario: 활성화된 게임 목록 조회
- **WHEN** 앱이 게임 source registry를 조회한다
- **THEN** 첫 항목은 `id: "prsk"`, `labelKey: "game.prsk"`, 상태 `available`과 PRSK integration을 가져야 한다
- **AND** 두 번째 항목은 `id: "strr"`, `labelKey: "game.strr"`, 상태 `available`과 STRR integration을 가져야 한다
- **AND** 세 번째 항목은 `id: "garupa"`, `labelKey: "game.garupa"`, 상태 `available`과 공개 `GarupaSourceIntegration`을 가져야 한다

#### Scenario: 표시와 routing의 단일 정의
- **WHEN** 활성 게임 탭을 렌더링하고 builder integration을 결정한다
- **THEN** 두 동작은 같은 registry entry를 사용해야 한다
- **AND** localized label 문자열은 routing key로 사용하지 않고 stable ID와 status로 integration을 결정해야 한다

### Requirement: 상단 게임 선택 탭
앱은 model source, preview와 Codex Pet builder보다 위에 게임 선택 tablist를 표시해야 한다(SHALL). 초기 선택은 `프로세카`여야 하며(MUST), 선택된 available 탭, 선택 가능한 available 탭과 준비중 탭의 상태를 시각적·programmatic 방식으로 구분해야 한다(MUST).

#### Scenario: 기본 초기 화면
- **WHEN** 사용자가 앱에 처음 진입한다
- **THEN** 상단 tablist에 `프로세카`, `레뷰 스타라이트`, `BanG Dream!`이 순서대로 표시되어야 한다
- **AND** `프로세카`는 선택 상태여야 한다
- **AND** `레뷰 스타라이트`와 `BanG Dream!`도 선택 가능하고 어느 탭에도 `준비중` 상태가 표시되어서는 안 된다

#### Scenario: 기본 설정의 접근 가능한 탭 상태
- **WHEN** 보조 기술이 게임 tablist를 탐색한다
- **THEN** 선택된 `프로세카`는 selected 상태로 노출되어야 한다
- **AND** `레뷰 스타라이트`와 `BanG Dream!`은 모두 enabled tab으로 노출되어야 한다

### Requirement: 선택된 게임 integration으로 빌드
시스템은 현재 선택된 available game entry의 integration을 통해 source 입력, resource loading, preview, 방향 설정과 Codex Pet build를 수행해야 한다(SHALL). `prsk` entry는 `src/features/livesd/prsk/`, `strr` entry는 `src/features/livesd/strr/`, `garupa` entry는 `src/features/livesd/garupa/` 공개 integration에 연결되어야 한다(MUST).

#### Scenario: 프로세카 선택 상태의 local build
- **WHEN** `프로세카`가 선택된 상태에서 사용자가 유효한 local PRSK source를 준비한다
- **THEN** 앱은 PRSK archive와 LiveSD preview 계약을 사용해야 한다
- **AND** PRSK 방향 설정을 포함해 Codex Pet build를 제공해야 한다

#### Scenario: 프로세카 선택 상태의 remote build
- **WHEN** `프로세카`가 선택된 상태에서 사용자가 PRSK remote catalog와 model을 명시적으로 불러온다
- **THEN** 앱은 PRSK 공개 integration의 provider와 resource loader만 사용해야 한다
- **AND** 생성 recipe는 PRSK provider 계약을 사용해야 한다

#### Scenario: Garupa pinned source preview와 build
- **WHEN** 사용자가 `BanG Dream!`을 선택하고 기본 live resource pack의 캐릭터와 모델을 순서대로 선택한다
- **THEN** 앱은 exact-commit provider에서 canonical Spine 4.0 source를 만들고 첫 visible frame 뒤에 preview를 ready로 표시해야 한다
- **AND** 실제 animation 목록, paired-eye look와 Garupa frame sampler를 사용해 Codex Pet package build를 제공해야 한다
- **AND** Pet 기본 이름은 현재 locale의 `모델 bundle 이름 - 캐릭터 이름` 형식이어야 하며 이름을 결정할 수 없는 model은 bundle 이름만 사용해야 한다
- **AND** 새 Garupa source의 전체 캐릭터 수평 반전은 기본으로 비활성화되어야 하며 Garupa runtime 안에서 명시적으로 저장한 preset만 이 값을 덮어쓸 수 있다

#### Scenario: Garupa local pack preview와 build
- **WHEN** 사용자가 `BanG Dream!`에서 유효한 canonical ZIP을 선택하고 명시적으로 불러온다
- **THEN** 앱은 외부 request 없이 local importer와 같은 Garupa preview·builder 계약을 사용해야 한다

#### Scenario: STRR pinned source preview와 build
- **WHEN** 사용자가 `레뷰 스타라이트`를 선택하고 기본 catalog의 캐릭터와 에디션을 순서대로 선택한다
- **THEN** 앱은 STRR 전용 integration과 exact-commit provider로 Spine 3.6 source를 만들고 첫 visible frame 뒤에 preview를 ready로 표시해야 한다
- **AND** STRR 전용 기본값과 static look fallback, 실제 animation 목록, 공통 builder·sampler를 사용해 Codex Pet package와 `strr-res-pak` recipe를 제공해야 한다

### Requirement: 게임 탭 전환과 비활성 상태
선택 가능한 탭은 실행 가능한 integration을 가진 `available` entry로 제한해야 한다(MUST). available 게임으로 전환하면 기존 integration의 request와 preview를 정리한 뒤 새 integration을 mount해야 한다(MUST). 향후 `coming-soon` entry가 생기면 비활성 상태를 표시하고 activation event에도 현재 선택과 integration 상태를 유지해야 한다(MUST).

#### Scenario: 레뷰 스타라이트 선택
- **WHEN** 사용자가 `레뷰 스타라이트` 탭을 선택한다
- **THEN** 선택된 game ID는 `strr`로 바뀌어야 한다
- **AND** 기존 PRSK request와 preview session을 정리해야 한다
- **AND** 사용자가 명시적으로 catalog 불러오기를 누르기 전에는 STRR resource request를 시작해서는 안 된다

#### Scenario: BanG Dream! 선택
- **WHEN** 사용자가 `BanG Dream!` 탭을 활성화한다
- **THEN** 선택된 game ID는 `garupa`로 변경되고 Garupa integration이 mount되어야 한다
- **AND** 탭 선택과 mount만으로 remote request 또는 runtime load를 시작해서는 안 된다

### Requirement: 게임 integration 활성화 조건
Registry의 `available` entry는 해당 ID의 source lifecycle, preview 입력과 builder source 계약을 구현한 integration을 가져야 한다(MUST). Runtime이 추가되는 provider는 고정 dependency와 license/provenance, synthetic integration harness와 production artifact allowlist를 가져야 하며(MUST), registry validation은 이 추적 가능한 조건을 충족한 entry만 선택 가능한 상태로 허용해야 한다(MUST). 실제 provider byte를 사용하는 fixture matrix와 render smoke는 operator-local release 검증일 수 있지만(MAY), registry validation과 CI가 이를 읽거나 요구해서는 안 된다(MUST NOT).

#### Scenario: integration 없는 상태 변경 거부
- **WHEN** `strr` 또는 `garupa` entry에 실행 가능한 integration 없이 상태를 `available`로 구성한다
- **THEN** type 또는 registry 검증이 해당 구성을 거부해야 한다

#### Scenario: 향후 available 게임 전환
- **WHEN** 향후 게임이 검증된 integration과 함께 `available`로 등록된다
- **THEN** 탭 선택은 기존 active request와 preview session을 정리한 뒤 새 integration을 mount해야 한다
- **AND** 이전 게임의 source, recipe 또는 방향 설정을 새 게임에 재사용해서는 안 된다

#### Scenario: 검증된 Garupa 활성화
- **WHEN** Garupa integration, 고정 runtime provenance와 synthetic harness가 검증된 build에 기록된다
- **THEN** registry는 dev·production mode 구분 없이 `garupa`를 `available`로 허용해야 한다
- **AND** production artifact는 공식 Spine 4.0 runtime과 고지를 포함하되 Garupa 원본 asset은 포함하지 않아야 한다
