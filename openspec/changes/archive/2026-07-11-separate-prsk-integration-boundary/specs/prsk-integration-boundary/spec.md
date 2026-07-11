## ADDED Requirements

### Requirement: PRSK 전용 구현의 디렉터리 소유권
시스템은 PRSK에만 적용되는 archive importer, 개발용 fallback, remote catalog/resource provider, provider URL·network 정책, PRSK 오류·제한·타입과 직접 대응하는 단위 테스트를 `src/features/livesd/prsk/` 하위에 배치해야 한다(SHALL). 범용 LiveSD production 디렉터리에 PRSK 전용 구현 파일을 남겨서는 안 된다(MUST NOT).

#### Scenario: PRSK 구현 위치 검사
- **WHEN** 저장소의 production source와 대응 unit test 경로를 검사한다
- **THEN** PRSK 전용 모듈은 `src/features/livesd/prsk/` 하위에 존재해야 한다
- **AND** 범용 LiveSD 디렉터리에는 PRSK source 구현이 없어야 한다

### Requirement: Source 독립 LiveSD 모델 계약
시스템은 `LiveSDAtlasBundle`, atlas page reference와 상대 경로 처리처럼 adapter와 exporter가 공동 소비하는 계약을 PRSK 폴더 밖의 범용 LiveSD 모델 모듈에서 제공해야 한다(SHALL). 해당 범용 계약은 PRSK 오류 클래스, provider 또는 archive 제한을 참조해서는 안 된다(MUST NOT).

#### Scenario: 여러 producer와 consumer가 동일 계약 사용
- **WHEN** local PRSK archive 또는 remote PRSK resource가 모델 입력을 생성한다
- **THEN** 두 source는 동일한 source 독립 LiveSD 모델 계약을 반환해야 한다
- **AND** LiveSD adapter와 frame exporter는 PRSK 내부 모듈 없이 그 계약을 소비해야 한다

#### Scenario: 범용 path 실패의 source 오류 변환
- **WHEN** 범용 atlas path 처리가 PRSK 입력에서 유효하지 않은 page reference를 발견한다
- **THEN** PRSK 경계는 기존 source별 안정적 오류 코드와 메시지로 실패를 변환해야 한다
- **AND** 범용 모델 모듈은 PRSK 오류 타입을 생성해서는 안 된다

### Requirement: 단방향 import 경계
범용 LiveSD 모듈은 `src/features/livesd/prsk/`를 import해서는 안 된다(MUST NOT). PRSK 폴더 밖의 composition root는 `src/features/livesd/prsk/index.ts`가 제공하는 공개 API만 사용해야 하며 PRSK 내부 파일을 deep import해서는 안 된다(MUST NOT).

#### Scenario: 범용 계층 import 검사
- **WHEN** `model`, `adapter`, `export`, `rendering`, `runtime`, source 독립 `input`과 `ui` 모듈의 import graph를 검사한다
- **THEN** `livesd/prsk`를 향하는 import가 없어야 한다

#### Scenario: Composition root의 PRSK 사용
- **WHEN** App 또는 Codex Pet recipe renderer가 PRSK 기능을 사용한다
- **THEN** 해당 소비자는 PRSK 공개 진입점을 통해 필요한 타입과 동작을 가져와야 한다
- **AND** `prsk/archive`, `prsk/development`, `prsk/remote` 내부 경로를 직접 import해서는 안 된다

### Requirement: PRSK 분리의 동작 동등성
PRSK 디렉터리 분리는 기존 local ZIP, development fallback, custom remote provider, `prsk-chibi-viewer` snapshot, LiveSD preview, Codex Pet recipe와 package 생성의 관찰 가능한 동작을 보존해야 한다(SHALL). 기존 URL 정책, resource 제한, 네트워크 trigger, 오류 코드와 생성 파일 형식을 변경해서는 안 된다(MUST NOT).

#### Scenario: Local PRSK 입력 회귀
- **WHEN** 사용자가 공통 skeleton과 유효한 PRSK character ZIP을 가져오거나 development fallback을 사용한다
- **THEN** 기존과 동일한 atlas bundle, animation 목록과 ready preview를 얻어야 한다
- **AND** 기존 archive 제한과 오류 코드가 유지되어야 한다

#### Scenario: Remote PRSK 입력 회귀
- **WHEN** 사용자가 custom provider 또는 `prsk-chibi-viewer` preset의 catalog를 명시적으로 불러오고 모델을 선택한다
- **THEN** 기존에 승인된 origin, fetch policy, resource limit과 요청 trigger만 사용해야 한다
- **AND** catalog와 model 실패의 기존 오류 코드가 유지되어야 한다

#### Scenario: Recipe와 package 회귀
- **WHEN** PRSK remote recipe를 renderer 또는 CLI로 처리하거나 ready 모델에서 Codex Pet package를 만든다
- **THEN** 기존 recipe schema와 provider 의미를 사용해야 한다
- **AND** 생성된 `pet.json`, spritesheet와 ZIP 구조는 변경 전 계약을 만족해야 한다

### Requirement: 구조 및 전체 회귀 검증
프로젝트는 PRSK 경계를 자동으로 검사하고 기존 기능 검증을 모두 통과해야 한다(SHALL). production 및 CLI 산출물에는 PRSK 개발 자산, provider 응답 또는 테스트 fixture가 새롭게 포함되어서는 안 된다(MUST NOT).

#### Scenario: 구조 회귀 차단
- **WHEN** 구조 검증을 실행한다
- **THEN** PRSK 파일 소유권, 금지된 역방향 import와 공개 API 우회 deep import를 실패로 보고해야 한다

#### Scenario: 전체 검증 완료
- **WHEN** 리팩터링 구현을 완료한다
- **THEN** typecheck, lint, unit/component test, Playwright E2E와 production build가 통과해야 한다
- **AND** CLI renderer build와 production artifact 검사가 PRSK 자산 및 응답의 비포함을 확인해야 한다

### Requirement: PRSK 기본 facing 보정 설정
PRSK 통합은 source 모델이 기본적으로 왼쪽을 보는 특성을 기준 방향으로 유지하면서 전체와 좌·우 이동을 독립적으로 조절하는 수평 반전 선택을 제공해야 한다(SHALL). Ready PRSK source의 초기 추천은 전체 반전과 `running-left` 반전을 비활성화하고 `running-right` 반전만 활성화해야 하며(MUST), 사용자는 package 생성 전에 세 값을 명시적으로 변경할 수 있어야 한다(MUST).

#### Scenario: PRSK 기본 추천
- **WHEN** local 또는 remote PRSK source가 ready가 된다
- **THEN** UI는 전체 캐릭터와 왼쪽 이동 수평 반전을 해제하고 오른쪽 이동 수평 반전만 활성화한 초기 추천을 표시해야 한다
- **AND** 사용자는 source animation mapping을 바꾸지 않고 세 선택을 독립적으로 변경할 수 있어야 한다

#### Scenario: PRSK source 교체
- **WHEN** 사용자가 다른 PRSK source를 성공적으로 활성화한다
- **THEN** 시스템은 새 source에 대한 전체 반전 추천을 다시 계산해야 한다
- **AND** 이전 source에서 수정한 방향 설정을 암묵적으로 유지해서는 안 된다
