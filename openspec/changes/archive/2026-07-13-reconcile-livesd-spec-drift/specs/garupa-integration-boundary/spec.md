## MODIFIED Requirements

### Requirement: Garupa 오류 소유권과 locale 변환

Garupa pack, runtime과 rendering의 stable code는 Garupa 공개 entrypoint에서 source 독립 UI 진단으로 변환해야 한다(MUST). Adapter는 실제 오류 객체의 `details`, `context`와 직접 scalar metadata에서 allowlist에 포함된 안전한 구조화 context만 보존해야 하며(MUST), raw exception, stack, local absolute path와 ZIP byte를 UI 또는 log에 노출해서는 안 된다(MUST NOT). Locale 변경은 code와 source generation을 유지하면서 message만 즉시 갱신해야 한다(MUST).

#### Scenario: 알려진 Garupa 오류
- **WHEN** importer 또는 renderer가 알려진 stable code를 반환한다
- **THEN** 공개 entrypoint는 같은 code, 안전한 구조화 context와 현재 locale의 실행 가능한 message를 제공한다

#### Scenario: 실제 importer version 오류
- **WHEN** `GarupaPackImportError`가 직접 `actualVersion`을 포함해 공개 경계에 도달한다
- **THEN** 진단은 `actualVersion`을 보존하고 error message, stack과 `path`는 노출하지 않는다

#### Scenario: 실제 renderer 또는 runtime context
- **WHEN** renderer 또는 runtime 오류가 `context`에 allowlist key와 내부 key를 함께 포함한다
- **THEN** 진단은 allowlist key만 보존하고 내부 key와 raw exception은 노출하지 않는다

#### Scenario: 알 수 없는 예외
- **WHEN** Garupa 내부의 알 수 없는 예외가 공개 경계에 도달한다
- **THEN** entrypoint는 raw exception 대신 Garupa 일반 오류 code와 locale message로 정규화한다

#### Scenario: locale 변경
- **WHEN** Garupa 오류가 표시된 상태에서 locale을 변경한다
- **THEN** stable code와 source generation은 유지되고 message만 새 locale로 변경된다

## REMOVED Requirements

### Requirement: 검증된 branch-wide registry activation

**Reason**: Garupa가 통합된 뒤 `현재 feature branch`는 현재 제품 계약을 나타내지 않는 일회성 표현이다.

**Migration**: `검증된 registry activation` 요구사항을 사용한다.

## ADDED Requirements

### Requirement: 검증된 registry activation

Game source registry의 `garupa` entry는 외부 실제 fixture로 Spine 4.0 parse, straight-alpha edge, animation mapping, paired-eye 16방향, 73-frame package, 독립 설치 preview와 production artifact allowlist가 모두 통과한 증거를 전제로 `available`과 `GarupaSourceIntegration`을 가져야 한다(MUST). 활성화는 dev와 production mode를 분기하지 않고 검증된 모든 build에 동일하게 적용해야 하며(MUST), `strr`의 `coming-soon` 상태에는 영향을 주어서는 안 된다(MUST NOT).

#### Scenario: 검증 완료 후 registry 조회
- **WHEN** 앱이 검증된 build의 game source registry를 조회한다
- **THEN** `garupa`는 `available`이고 공개 Garupa entrypoint에서 가져온 integration을 가져야 한다
- **AND** `strr`는 `coming-soon`과 integration 없음 상태를 유지해야 한다

#### Scenario: Garupa 탭 선택
- **WHEN** 사용자가 `BanG Dream!` 탭을 선택한다
- **THEN** 앱은 Garupa source panel을 mount하고 탭을 selected 상태로 표시해야 한다
- **AND** mount만으로 importer, runtime 또는 외부 provider request를 시작해서는 안 된다

#### Scenario: production build registry
- **WHEN** production build의 registry와 application chunk를 검사한다
- **THEN** `garupa`는 dev build와 동일하게 선택 가능하고 Spine 4.0 runtime은 명시적 source load에서 lazy load할 수 있어야 한다
- **AND** Garupa 원본 skeleton, atlas, PNG, ZIP과 private fixture는 포함되지 않아야 한다
