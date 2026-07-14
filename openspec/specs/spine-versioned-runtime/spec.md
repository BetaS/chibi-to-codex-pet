# Spine runtime integration 명세

## Purpose

PRSK와 BanG Dream integration이 각각 기준 Spine 3.6·4.0 runtime을 소유하면서 API 격리, byte 정책, preview·export 일관성, provenance와 오류 경계를 유지하는 계약을 정의한다.

## Requirements

### Requirement: Integration별 기준 runtime 소유

각 available game integration은 자신의 source importer, preview와 sampler가 사용할 기준 Spine runtime adapter를 명시적으로 소유해야 한다(MUST). PRSK integration은 `LiveSD36Adapter`와 `LiveSD36FrameSampler`의 고정 Spine 3.6 runtime을 사용해야 하고(MUST), 정상 header의 version은 해당 adapter의 `verified | experimental | best_effort` 정책에 따라 같은 runtime으로 파싱할 수 있어야 한다(MUST). BanG Dream integration은 `GarupaSpine40PreviewFactory`와 `GarupaSpine40FrameSampler`의 고정 `spine-4.0` adapter를 사용해야 하며(MUST), Garupa importer는 `4.0.x` version만 해당 adapter에 전달해야 한다(MUST). 공통 계층은 source header를 기준으로 game integration 사이의 runtime을 자동 변경하지 않아야 하며(MUST NOT), global fallback 허용 여부를 강제하지 않고 각 source adapter의 version 정책을 따라야 한다(MUST).

#### Scenario: PRSK의 다른 version best-effort
- **WHEN** PRSK source가 정상적인 `3.7.0` header를 가진다
- **THEN** PRSK integration은 이를 `best_effort`로 기록하고 고정 Spine 3.6 adapter로 parser 실행을 시도한다
- **AND** parser가 성공하면 preview를 허용한다

#### Scenario: BanG Dream Spine 4.0 source
- **WHEN** Garupa source가 정상적인 `4.0.64` header를 가진다
- **THEN** BanG Dream integration은 공식 `spine-4.0` adapter로 preview와 sampling을 수행한다

#### Scenario: BanG Dream의 기준 runtime 밖 version
- **WHEN** Garupa source가 `3.6` 또는 `4.1` header를 가진다
- **THEN** Garupa importer는 `GARUPA_SKELETON_UNSUPPORTED_VERSION`과 실제 version을 반환하고 Spine runtime을 시작하지 않는다

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

Skeleton byte 변형은 각 game integration이 소유한 기준 adapter 내부 정책으로 제한해야 한다(MUST). PRSK의 Spine 3.6 adapter와 sampler는 명세된 trailing NUL 복사본을 parser에 전달해야 하고(MUST), BanG Dream의 Spine 4.0 adapter와 sampler는 원본 byte와 동일한 길이·내용의 view를 `SkeletonBinary`에 전달해야 한다(MUST). Source importer, integration과 공통 builder는 입력 source buffer를 직접 변경해서는 안 된다(MUST NOT).

#### Scenario: 3.6 padding 유지
- **WHEN** PRSK의 Spine 3.6 adapter 또는 sampler가 정상 skeleton을 파싱한다
- **THEN** 원본보다 한 바이트 큰 별도 buffer와 trailing NUL을 parser에 전달하고 원본은 유지한다

#### Scenario: 4.0 원본 byte 전달
- **WHEN** BanG Dream의 Spine 4.0 adapter 또는 sampler가 정상 skeleton을 파싱한다
- **THEN** parser가 받은 byte length와 내용은 source skeleton과 완전히 같고 trailing byte를 추가하지 않는다

### Requirement: Preview와 export의 integration runtime 일관성

각 game integration은 같은 ready source의 preview, canonical bounds calibration과 final frame sampler에 자신의 동일한 기준 runtime을 사용해야 한다(MUST). PRSK preview와 sampler는 고정 Spine 3.6 loader를 사용해야 하고(MUST), BanG Dream preview는 ready session의 `adapterIdentity`를 보존해 sampler의 공식 Spine 4.0 adapter identity와 대조해야 한다(MUST). Ready 이후 다른 game integration 또는 runtime adapter로 source를 재해석해서는 안 된다(MUST NOT).

#### Scenario: PRSK preview와 sampler
- **WHEN** PRSK source가 Spine 3.6 adapter로 첫 frame까지 성공한다
- **THEN** package sampler도 같은 source bytes를 `LiveSD36FrameSampler`와 고정 Spine 3.6 loader로 파싱한다

#### Scenario: BanG Dream adapter identity 유지
- **WHEN** BanG Dream preview가 공식 Spine 4.0 adapter로 ready가 된다
- **THEN** sampler는 ready preview의 `adapterIdentity`와 자신의 adapter identity가 일치할 때만 sampling을 시작한다

#### Scenario: BanG Dream runtime identity 변경
- **WHEN** ready preview와 sampler의 Spine 4.0 adapter identity가 다르다
- **THEN** Garupa sampler는 source를 다른 runtime으로 fallback하지 않고 현재 generation의 rendering 오류로 중단한다

### Requirement: Integration별 runtime API 경계

PRSK와 BanG Dream integration은 skeleton parse, atlas parse, animation state, bounds, draw order와 WebGL rendering의 version별 API 차이를 자신의 adapter와 sampler 안에서 처리해야 한다(MUST). 시스템은 두 integration에 하나의 공통 runtime facade 공유를 요구해서는 안 되며(MUST NOT), 공통 Codex Pet builder에는 동일한 source-independent sampling service 계약을 제공해야 한다(MUST). 공통 builder는 game별 Spine class 또는 enum shape를 분기해서는 안 된다(MUST NOT).

#### Scenario: PRSK preview 생성
- **WHEN** PRSK integration이 준비된 source를 preview한다
- **THEN** integration은 `LiveSD36Adapter`를 직접 사용하고 공통 builder에는 source와 sampling service만 제공한다

#### Scenario: BanG Dream preview 생성
- **WHEN** BanG Dream integration이 준비된 source를 preview한다
- **THEN** integration은 `GarupaSpine40PreviewFactory`를 직접 사용하고 공통 builder에는 Garupa sampler service를 주입한다

#### Scenario: version API 차이
- **WHEN** Spine 3.6과 4.0의 animation apply 또는 world transform API signature가 다르다
- **THEN** 각 integration의 adapter가 차이를 내부에서 처리하고 공통 builder는 runtime version 조건문을 갖지 않는다

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

Spine 4.0 loader와 versioned runtime helper는 아래 영문 code만 알려진 내부 runtime 오류로 사용해야 하며(MUST), 알 수 없는 loader 실패는 `RUNTIME_PROFILE_LOAD_FAILED`로 정규화해야 한다(MUST). Game integration 공개 경계는 자신의 source별 오류 계약에 따라 이 오류를 안전한 진단으로 변환할 수 있어야 한다(MUST).

```text
RUNTIME_PROFILE_UNSUPPORTED
RUNTIME_PROFILE_MISMATCH
RUNTIME_PROFILE_LOAD_FAILED
RUNTIME_PROFILE_API_INVALID
RUNTIME_PROFILE_PARSE_FAILED
```

#### Scenario: 알려진 runtime helper 실패
- **WHEN** Spine 4.0 loader, API shape 또는 versioned helper parse가 실패한다
- **THEN** helper는 위 집합의 해당 code와 안전한 실제 skeleton version·요청 profile context를 제공하고 부분 session을 노출하지 않는다

#### Scenario: game integration 오류 변환
- **WHEN** 내부 runtime 오류가 PRSK 또는 BanG Dream 공개 경계에 도달한다
- **THEN** 해당 integration은 raw exception과 runtime 객체를 노출하지 않고 자신의 stable 오류와 locale message 계약으로 변환한다
