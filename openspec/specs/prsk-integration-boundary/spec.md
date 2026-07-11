# PRSK integration 경계 명세

## Purpose

PRSK의 archive, remote provider와 방향 기본값을 하나의 game integration으로 제공한다. 공통 LiveSD 계층은 source 독립 모델을 소비하고 PRSK 세부 구현은 공개 integration API 뒤에 위치한다.

## Requirements

### Requirement: PRSK 전용 구현의 디렉터리 소유권
시스템은 PRSK에만 적용되는 archive importer, development source, remote catalog/resource provider, provider URL·network 정책, PRSK 오류·제한·타입과 직접 대응하는 단위 테스트를 `src/features/livesd/prsk/` 하위에 배치해야 한다(SHALL). 범용 LiveSD production module은 source 독립 기능만 소유해야 한다(MUST).

#### Scenario: PRSK 구현 위치 검사
- **WHEN** 저장소의 production source와 대응 unit test 경로를 검사한다
- **THEN** PRSK 전용 모듈은 `src/features/livesd/prsk/` 하위에 존재해야 한다
- **AND** 범용 LiveSD 디렉터리에는 PRSK source 구현이 없어야 한다

### Requirement: Source 독립 LiveSD 모델 계약
시스템은 `LiveSDAtlasBundle`, atlas page reference와 상대 경로 처리처럼 adapter와 exporter가 공동 소비하는 계약을 PRSK 폴더 밖의 범용 LiveSD 모델 모듈에서 제공해야 한다(SHALL). 이 계약의 입력과 오류는 source 독립 타입으로 구성해야 한다(MUST).

#### Scenario: 여러 producer와 consumer가 동일 계약 사용
- **WHEN** local PRSK archive 또는 remote PRSK resource가 모델 입력을 생성한다
- **THEN** 두 source는 동일한 source 독립 LiveSD 모델 계약을 반환해야 한다
- **AND** LiveSD adapter와 frame exporter는 source 독립 계약만 소비해야 한다

#### Scenario: 범용 path 실패의 source 오류 변환
- **WHEN** 범용 atlas path 처리가 PRSK 입력에서 유효하지 않은 page reference를 발견한다
- **THEN** PRSK 경계는 source별 안정적 오류 코드와 locale message로 실패를 변환해야 한다
- **AND** 범용 모델 모듈은 source 독립 오류를 반환해야 한다

### Requirement: 단방향 import 경계
Import 방향은 PRSK integration에서 범용 LiveSD module로 향해야 한다(MUST). PRSK 폴더 밖의 composition root는 `src/features/livesd/prsk/index.ts`가 제공하는 공개 API를 사용해야 한다(MUST).

#### Scenario: 범용 계층 import 검사
- **WHEN** `model`, `adapter`, `export`, `rendering`, `runtime`, source 독립 `input`과 `ui` 모듈의 import graph를 검사한다
- **THEN** `livesd/prsk`를 향하는 import가 없어야 한다

#### Scenario: Composition root의 PRSK 사용
- **WHEN** App 또는 Codex Pet recipe renderer가 PRSK 기능을 사용한다
- **THEN** 해당 소비자는 PRSK 공개 진입점을 통해 필요한 타입과 동작을 가져와야 한다
- **AND** `prsk/archive`, `prsk/development`, `prsk/remote` 내부 경로를 직접 import해서는 안 된다

### Requirement: PRSK integration 입출력 계약
PRSK integration은 local ZIP, development source, custom provider와 `prsk-chibi-viewer` snapshot을 source producer로 제공해야 한다(SHALL). 모든 producer는 공통 LiveSD preview 입력을 반환하고(MUST), remote recipe와 package 생성은 정의된 provider·recipe·Codex Pet v2 계약을 사용해야 한다(MUST).

#### Scenario: Local PRSK 입력
- **WHEN** 사용자가 공통 skeleton과 유효한 PRSK character ZIP을 가져오거나 development source를 사용한다
- **THEN** integration은 archive 제한을 검증한 atlas bundle, skeleton과 source별 오류를 제공한다
- **AND** 공통 LiveSD adapter는 실제 animation 목록과 ready preview를 생성한다

#### Scenario: Remote PRSK 입력
- **WHEN** 사용자가 custom provider 또는 `prsk-chibi-viewer` catalog를 명시적으로 불러오고 모델을 선택한다
- **THEN** integration은 명세된 origin, fetch policy, resource limit과 요청 trigger를 사용한다
- **AND** catalog와 model 실패를 PRSK stable error code로 반환한다

#### Scenario: Recipe와 package 출력
- **WHEN** PRSK remote recipe를 renderer 또는 CLI로 처리하거나 ready 모델에서 Codex Pet package를 만든다
- **THEN** provider와 recipe schema가 같은 source를 표현한다
- **AND** 생성된 `pet.json`, spritesheet와 ZIP은 Codex Pet v2 package 계약을 만족한다

### Requirement: 구조와 산출물 검증
프로젝트는 PRSK file ownership, import 방향, 공개 API 사용과 production asset 경계를 자동으로 검사해야 한다(SHALL). Production 및 CLI 산출물의 allowlist는 application code, renderer, runtime과 license 고지이며 PRSK development asset, provider 응답과 test fixture는 포함되지 않는다(MUST).

#### Scenario: 구조 경계 검사
- **WHEN** 구조 검증을 실행한다
- **THEN** PRSK 파일 소유권, 금지된 역방향 import와 공개 API 우회 deep import를 실패로 보고해야 한다

#### Scenario: 전체 검증
- **WHEN** PRSK integration 변경을 제출한다
- **THEN** typecheck, lint, unit/component test, 관련 Playwright E2E와 production build가 통과해야 한다
- **AND** CLI renderer build와 production artifact 검사가 산출물 allowlist를 확인해야 한다

### Requirement: PRSK 기본 facing 보정 설정
PRSK integration은 왼쪽을 보는 source 모델을 기준 방향으로 사용하고 전체와 좌·우 이동을 독립적으로 조절하는 수평 반전 선택을 제공해야 한다(SHALL). Ready PRSK source의 초기 추천은 `globalMirrorX: false`, `running-left.mirrorX: false`, `running-right.mirrorX: true`이며(MUST), 사용자는 package 생성 전에 세 값을 독립적으로 변경할 수 있어야 한다(MUST).

#### Scenario: PRSK 기본 추천
- **WHEN** local 또는 remote PRSK source가 ready가 된다
- **THEN** UI는 전체 캐릭터와 왼쪽 이동 수평 반전을 해제하고 오른쪽 이동 수평 반전만 활성화한 초기 추천을 표시해야 한다
- **AND** 사용자는 source animation mapping을 바꾸지 않고 세 선택을 독립적으로 변경할 수 있어야 한다

#### Scenario: PRSK source 교체
- **WHEN** 사용자가 다른 PRSK source를 성공적으로 활성화한다
- **THEN** 시스템은 새 source에 대한 전체 반전 추천을 다시 계산해야 한다
- **AND** 이전 source에서 수정한 방향 설정을 암묵적으로 유지해서는 안 된다
