# STRR integration 경계 명세

## Purpose

레뷰 스타라이트의 보존 catalog에서 캐릭터와 에디션을 선택해 Spine 3.6 preview와 Codex Pet v2 package를 만드는 STRR 전용 UI·lifecycle·기본값 계약을 정의한다. 고정 원격 provider의 byte와 schema 검증은 STRR pinned mirror source 명세가 소유하고, preview·sampler·preset·recipe의 공통 동작은 각 공통 명세를 그대로 사용한다.

## Requirements

### Requirement: STRR 전용 구현과 lazy registry entrypoint

STRR catalog·model provider, 타입, integration UI, route와 직접 대응하는 test는 `src/features/livesd/strr/` 아래에 있어야 한다(SHALL). 기본 game source registry의 `strr` entry는 `StrrIntegrationRoute`를 가진 `available` 상태여야 하며(MUST), route는 `StrrIntegration`을 lazy load해야 한다(MUST). 탭 선택과 integration mount만으로 catalog·model request 또는 Spine runtime fetch를 시작해서는 안 된다(MUST NOT).

#### Scenario: 기본 registry에서 STRR 조회
- **WHEN** 앱이 기본 game source registry를 만든다
- **THEN** 두 번째 entry는 `id: "strr"`, `labelKey: "game.strr"`, `status: "available"`이어야 한다
- **AND** 실행 가능한 lazy STRR integration route를 가져야 한다

#### Scenario: STRR 탭 mount
- **WHEN** 사용자가 레뷰 스타라이트 탭을 선택하고 추가 동작을 하지 않는다
- **THEN** STRR source panel과 비어 있는 preview가 표시되어야 한다
- **AND** catalog·model request와 Spine runtime fetch는 0건이어야 한다

### Requirement: 명시적 캐릭터→에디션 선택 흐름

STRR 화면은 runtime별 preset loader를 source control보다 먼저 표시하고(MUST), `새 세션`이 대기 선택일 때만 `캐릭터 목록 불러오기`로 catalog request를 시작해야 한다(MUST). Catalog가 준비되면 현재 locale의 이름과 ID로 검색 가능한 캐릭터 combobox를 활성화하고(MUST), 캐릭터를 commit한 뒤에만 그 캐릭터에 속한 에디션 combobox를 활성화해야 한다(MUST). 캐릭터 선택은 model request를 시작하지 않고 이전 에디션·preview·preview control을 비워야 하며(MUST), 에디션 commit은 별도 버튼 없이 해당 model load를 시작해야 한다(MUST).

#### Scenario: 새 세션의 2단계 선택
- **WHEN** 사용자가 `캐릭터 목록 불러오기`를 실행해 catalog를 준비한다
- **THEN** 캐릭터 option은 localized label, ID 순으로 안정적으로 정렬되어야 한다
- **AND** 아직 model asset request는 발생하지 않아야 한다
- **WHEN** 사용자가 캐릭터를 선택한다
- **THEN** 두 번째 combobox에는 그 캐릭터의 에디션만 catalog 순서대로 `localized label · edition ID` 형식으로 표시되어야 한다
- **AND** 사용자가 에디션을 commit할 때 해당 model load가 시작되어야 한다

#### Scenario: 캐릭터 교체
- **WHEN** ready preview가 있는 상태에서 다른 캐릭터를 선택한다
- **THEN** 진행 중 model request와 이전 preview session을 정리해야 한다
- **AND** 에디션, animation, framing, look target과 builder mapping을 STRR 기본 상태로 reset해야 한다

### Requirement: request generation과 preview lifecycle

Catalog와 model load는 각각 `AbortSignal`과 증가하는 request generation으로 관리해야 한다(MUST). 새 catalog load, 캐릭터·에디션 변경, preset source load, `새 세션` 전환 또는 unmount가 이전 작업을 무효화하면 해당 request를 abort하고(MUST), 늦게 완료된 결과를 catalog나 active preview에 적용해서는 안 된다(MUST NOT). 교체 model은 skeleton inspection과 WebGL preview 생성이 모두 성공한 뒤에만 ready 상태로 노출해야 하며(MUST), 실패하면 stable STRR provider code 또는 `STRR_PREVIEW_FAILED`와 message를 alert에 표시해야 한다(MUST).

#### Scenario: stale model completion
- **WHEN** 첫 에디션 model을 불러오는 동안 사용자가 다른 캐릭터 또는 source session으로 전환한다
- **THEN** 첫 request를 abort하고 generation을 무효화해야 한다
- **AND** 첫 request가 나중에 resolve해도 session을 즉시 dispose하고 active preview로 표시해서는 안 된다

#### Scenario: preview ready evidence
- **WHEN** 선택한 skeleton inspection과 첫 WebGL preview 생성이 성공한다
- **THEN** status는 ready가 되고 `characterId/editionId · LiveSD version · animation count` render evidence를 표시해야 한다
- **AND** 실제 animation 검색·재생, 상태 바로가기, framing과 Codex Pet builder를 활성화해야 한다

### Requirement: STRR 기본 이름과 animation·facing 설정

저장 preset이 없는 새 STRR source의 Pet 이름은 현재 locale의 `에디션 이름 - 캐릭터 이름`이어야 한다(MUST). 초기 전체 수평 반전은 `true`여야 하고(MUST), 상태별 기본 반전은 `running-right: true`, `running-left: false`여야 한다(MUST). 실제 animation 목록에서 대소문자까지 정확히 일치하거나 대소문자만 다른 이름이 있으면 `idle`은 `wait1`, `running`은 `walk1`, mouse-over에 쓰는 `jumping`은 `surprized1`을 공통 추천보다 우선해야 하며(MUST), 해당 이름이 없으면 그 상태의 공통 추천을 유지해야 한다(MUST). 명시적으로 불러온 STRR preset의 이름, mapping, framing, look scale과 반전은 이 source 기본값보다 우선해야 한다(MUST).

#### Scenario: STRR 기본 mapping
- **WHEN** 새 source의 실제 animation 목록에 `wait1`, `walk1`, `surprized1`이 있다
- **THEN** 대기, 작업 중, 마우스 오버 상태는 각각 그 animation으로 초기화되어야 한다
- **AND** 전체 캐릭터 수평 반전 checkbox는 활성화되어야 한다
- **AND** 오른쪽·왼쪽 이동 상태별 반전 값은 각각 `true`, `false`여야 한다

#### Scenario: locale별 기본 Pet 이름
- **WHEN** 현재 locale의 캐릭터 이름이 `다이바 나나`이고 에디션 이름이 `태양의 나라 기사`인 source가 처음 ready가 된다
- **THEN** 저장 preset이 없는 builder의 기본 Pet 이름은 `태양의 나라 기사 - 다이바 나나`여야 한다

### Requirement: STRR static look fallback

STRR preview input, builder source와 `strr-res-pak` recipe sampling input은 모두 `lookRigFallback: "static"`을 전달해야 한다(MUST). Preview는 parent가 있는 `eye_scale` bone을 찾으면 공통 pointer look 동작을 사용하고(MUST), bone이 없거나 parent matrix 역변환이 불안정하면 pointer 이동으로 오류를 내지 않고 현재 animation pose를 유지해야 한다(MUST). Export sampler는 `eye_scale`, parent 또는 유효한 좌우 눈 attachment 부족으로 look rig 검증이 `LOOK_RIG_MISSING`을 반환할 때 idle animation의 `time=0` pose를 눈 offset 없이 16개 look cell에 반복해 전체 73-frame package를 완성해야 한다(MUST). Rig 검증 뒤의 다른 좌표 변환 오류까지 static fallback으로 숨겨서는 안 된다(MUST NOT).

#### Scenario: eye rig가 없는 STRR model
- **WHEN** STRR skeleton에 parent transform을 가진 유효한 `eye_scale` bone이 없다
- **THEN** canvas pointer 이동은 `LOOK_RIG_MISSING`으로 preview를 중단하지 않아야 한다
- **AND** web build와 CLI recipe renderer는 static look 16개를 포함한 73-frame spritesheet를 생성해야 한다

### Requirement: STRR preset source와 recipe handoff

STRR integration은 `strr` runtime 전용 preset repository만 사용해야 하고(MUST), remote source identity를 `{ provider: "strr-res-pak", characterId, editionId }`로 builder에 전달해야 한다(MUST). 저장 preset option 선택은 대기 선택만 바꾸고 request를 시작해서는 안 되며(MUST NOT), `프리셋 불러오기`를 실행하면 고정 catalog를 불러온 뒤 저장된 캐릭터·에디션 model을 복원하고 source-ready 이후 저장 설정을 적용해야 한다(MUST). 검증된 package build는 같은 source identity를 가진 recipe, npx 설치 명령과 `CLI 바로가기 복사` action을 제공해야 한다(MUST).

#### Scenario: 저장 STRR preset 명시적 복원
- **WHEN** 저장된 `strr-res-pak` preset을 선택만 한다
- **THEN** catalog와 model request는 0건이고 캐릭터 목록 action은 비활성이어야 한다
- **WHEN** 사용자가 `프리셋 불러오기`를 실행한다
- **THEN** 저장 character ID와 edition ID를 같은 고정 catalog에서 검증한 뒤 model preview를 만들어야 한다
- **AND** preview가 ready가 된 뒤 preset의 metadata, mapping, framing, look scale과 반전을 적용해야 한다

#### Scenario: STRR build recipe
- **WHEN** STRR package 생성과 validation이 성공한다
- **THEN** recipe source에는 `strr-res-pak`, 현재 `characterId`와 `editionId`가 포함되어야 한다
- **AND** 화면은 recipe를 포함한 npx 명령과 그 전체 text를 복사하는 action을 제공해야 한다
