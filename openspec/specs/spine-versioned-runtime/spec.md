# Spine versioned runtime 명세

## Purpose

LiveSD skeleton version에 맞는 Spine 3.6·4.0 runtime routing, API 격리, byte 정책, provenance와 오류 계약을 정의한다.

## Requirements

### Requirement: Skeleton header 기반 runtime routing

시스템은 source manifest의 주장보다 실제 skeleton binary header의 major/minor를 기준으로 LiveSD runtime profile을 선택해야 한다(MUST). Header `3.6`은 기존 `spine-3.6`, header `4.0`은 `spine-4.0` profile로 routing해야 하며(MUST), source metadata의 `runtimeKey`가 실제 header와 다르면 runtime을 로드하기 전에 `RUNTIME_PROFILE_MISMATCH`로 거부해야 한다(MUST). 지원하지 않는 major/minor를 다른 runtime에 best-effort로 전달해서는 안 된다(MUST NOT).

#### Scenario: Spine 3.6 routing
- **WHEN** source skeleton의 정상 header가 `3.6.x`이고 metadata가 `spine-3.6`을 선언한다
- **THEN** runtime registry는 기존 Spine 3.6 adapter profile을 선택한다

#### Scenario: Spine 4.0 routing
- **WHEN** source skeleton의 정상 header가 `4.0.x`이고 metadata가 `spine-4.0`을 선언한다
- **THEN** runtime registry는 Spine 4.0 adapter profile을 선택한다

#### Scenario: metadata와 byte 불일치
- **WHEN** metadata는 `spine-4.0`을 선언하지만 실제 skeleton header가 `3.6.x`이다
- **THEN** registry는 `RUNTIME_PROFILE_MISMATCH`를 반환하고 3.6 또는 4.0 runtime을 로드하지 않는다

#### Scenario: 지원하지 않는 version
- **WHEN** skeleton header가 `3.8`, `4.1` 또는 등록되지 않은 major/minor이다
- **THEN** registry는 `RUNTIME_PROFILE_UNSUPPORTED`를 반환하고 다른 profile로 fallback하지 않는다

### Requirement: Runtime namespace와 상태 격리

각 runtime profile은 자신의 API namespace, load promise, adapter factory와 rendering 자원을 소유해야 한다(MUST). Spine 4.0 loader는 기존 `window.spine` Spine 3.6 global을 덮어쓰거나 유효한 4.0 API로 오인해서는 안 되며(MUST NOT), 같은 profile의 동시 load는 하나의 promise와 runtime instance를 재사용해야 한다(MUST). 서로 다른 profile의 load·오류·dispose 상태는 상호 독립적이어야 한다(MUST).

#### Scenario: 3.6 global과 4.0 동시 존재
- **WHEN** 유효한 Spine 3.6 `window.spine`이 있는 상태에서 `spine-4.0`을 로드한다
- **THEN** 4.0 API는 별도 namespace에서 반환되고 기존 global identity와 API shape은 변경되지 않는다

#### Scenario: 같은 profile 동시 요청
- **WHEN** 두 session이 `spine-4.0` load 완료 전에 동시에 요청한다
- **THEN** loader는 같은 단일 load promise와 runtime instance를 두 요청에 제공한다

#### Scenario: 4.0 load 실패 격리
- **WHEN** Spine 4.0 runtime load가 실패한다
- **THEN** 실패는 `spine-4.0` profile에만 귀속되고 이미 준비된 Spine 3.6 runtime과 session은 유지된다

### Requirement: Version별 skeleton byte 정책

Skeleton byte 변형은 선택된 adapter profile 내부 정책으로 제한해야 한다(MUST). 기존 Spine 3.6 profile은 명세된 trailing NUL 복사본을 parser에 전달해야 하고(MUST), Spine 4.0 profile은 원본 byte와 동일한 길이·내용의 view를 `SkeletonBinary`에 전달해야 한다(MUST). Runtime registry와 공통 facade는 source buffer를 직접 변경해서는 안 된다(MUST NOT).

#### Scenario: 3.6 padding 유지
- **WHEN** `spine-3.6` adapter가 정상 skeleton을 파싱한다
- **THEN** 기존 계약대로 원본보다 한 바이트 큰 별도 buffer와 trailing NUL을 parser에 전달하고 원본은 유지한다

#### Scenario: 4.0 원본 byte 전달
- **WHEN** `spine-4.0` adapter가 정상 skeleton을 파싱한다
- **THEN** parser가 받은 byte length와 내용은 source skeleton과 완전히 같고 trailing byte를 추가하지 않는다

### Requirement: Preview와 export runtime profile 고정

첫 frame까지 성공한 ready source는 선택된 `runtimeKey`와 adapter profile identity를 runtime 독립 export handoff에 보존해야 한다(MUST). Preview, canonical bounds calibration과 final frame sampler는 같은 source에 대해 같은 runtime profile을 사용해야 하며(MUST), ready 이후 metadata 변경이나 전역 runtime 상태로 profile을 다시 선택해서는 안 된다(MUST NOT).

#### Scenario: Spine 4.0 source handoff
- **WHEN** `spine-4.0` preview가 첫 frame까지 성공한다
- **THEN** export source는 `runtimeKey: "spine-4.0"`을 고정하고 sampler도 같은 profile로 skeleton과 animation을 파싱한다

#### Scenario: runtime drift 거부
- **WHEN** ready preview는 `spine-4.0`인데 export 호출이 `spine-3.6` profile을 요청한다
- **THEN** facade는 `RUNTIME_PROFILE_MISMATCH`로 export를 시작하지 않는다

### Requirement: Runtime API facade

Versioned runtime은 preview와 sampler에 skeleton parse, atlas parse, animation state, bounds, draw order와 WebGL rendering에 필요한 runtime 독립 facade를 제공해야 한다(MUST). Version별 클래스와 enum 객체는 adapter 밖으로 노출해서는 안 되며(MUST NOT), 공통 consumer는 `runtimeKey` 외의 version별 API shape을 분기해서는 안 된다(MUST NOT).

#### Scenario: 공통 preview 생성
- **WHEN** 공통 preview 계층이 3.6 또는 4.0 source를 받는다
- **THEN** 선택된 adapter는 동일한 session·animation·bounds·dispose 계약을 반환하고 version별 runtime 객체를 호출자에게 노출하지 않는다

#### Scenario: version API 차이
- **WHEN** Spine 3.6과 4.0의 animation apply 또는 world transform API signature가 다르다
- **THEN** 각 adapter가 차이를 내부에서 처리하고 공통 preview·sampler 코드는 runtime version별 조건문을 갖지 않는다

### Requirement: Spine 4.0 runtime provenance와 라이선스

시스템은 Spine 4.0 runtime의 정확한 package 또는 upstream commit, version, 파일별 SHA-256, 원문 LICENSE와 copyright notice를 저장소에 기록해야 한다(MUST). Build-time 검사는 고정 dependency와 기록을 검증해야 하며(MUST), production 산출물은 실행에 필요한 runtime과 사용자가 접근 가능한 license notice만 포함하고 모델 asset은 포함해서는 안 된다(MUST NOT).

#### Scenario: 고정 runtime 검증
- **WHEN** dependency provenance 검사를 실행한다
- **THEN** Spine 4.0 runtime version·hash와 원문 LICENSE가 기록된 값과 일치한다

#### Scenario: production 고지
- **WHEN** production build를 생성한다
- **THEN** Spine 3.6과 4.0 runtime 각각의 원문 LICENSE와 출처를 확인할 수 있는 third-party notice가 포함된다
- **AND** Garupa 또는 다른 게임의 skeleton, atlas와 PNG는 포함되지 않는다

### Requirement: 안정적인 versioned runtime 오류 계약

Runtime registry와 facade는 아래 영문 code만 알려진 versioned runtime 오류로 사용해야 하며(MUST), 알 수 없는 실패는 `RUNTIME_PROFILE_LOAD_FAILED`로 정규화해야 한다(MUST).

```text
RUNTIME_PROFILE_UNSUPPORTED
RUNTIME_PROFILE_MISMATCH
RUNTIME_PROFILE_LOAD_FAILED
RUNTIME_PROFILE_API_INVALID
RUNTIME_PROFILE_PARSE_FAILED
```

#### Scenario: 알려진 runtime 실패
- **WHEN** profile 선택, load, API shape 또는 skeleton parse가 실패한다
- **THEN** facade는 위 집합의 해당 code, 실제 skeleton version과 요청 profile을 포함한 구조화된 진단을 반환하고 부분 session을 노출하지 않는다
