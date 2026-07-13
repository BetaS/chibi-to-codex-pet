## Context

현재 제품은 전역 `SpineVersionedRuntimeRegistry`를 통해 runtime을 고르지 않는다. PRSK integration은 `LiveSD36Adapter`와 `LiveSD36FrameSampler`를 직접 사용하고, BanG Dream integration은 `GarupaSpine40PreviewFactory`, `GarupaSpine40FrameSampler`와 공식 Spine 4.0 adapter를 직접 소유한다. 누적 main spec은 이 구조보다 강한 공통 router·facade와 전역 fallback 금지를 요구하고 있으며, package spec에는 mapping 이후 실제 동작과 다른 단일-pose preview calibration 문구가 남아 있다.

## Goals / Non-Goals

**Goals:**

- 게임 integration별 기준 runtime과 version 수용 정책을 현재 코드에 맞게 명시한다.
- preview와 export의 mapping 이후 자동 fit을 같은 57-pose canonical projection으로 통일한다.
- Garupa 오류의 stable code와 안전한 context를 실제 오류 클래스 shape에서도 보존한다.
- main spec에서 특정 feature branch에 종속된 표현을 제거한다.

**Non-Goals:**

- 전역 runtime registry를 production 경로에 연결하지 않는다.
- PRSK 또는 BanG Dream의 parser, renderer와 runtime dependency를 교체하지 않는다.
- BanG Dream importer의 Spine 4.0 수용 범위를 확대하지 않는다.
- 초기 mapping 전 bootstrap preview의 임시 framing 동작은 package 일치 계약에 포함하지 않는다.

## Decisions

### 게임 integration이 기준 runtime을 소유한다

PRSK는 고정 Spine 3.6 runtime을 기준으로 정상 header의 다른 version도 `best_effort`로 파싱한다. BanG Dream은 고정 Spine 4.0 runtime을 기준으로 `4.0.x`만 수용하고 그 밖의 version은 Garupa importer 오류로 거부한다. 공통 계층은 header를 보고 두 integration 사이를 자동 routing하지 않으며, best-effort 또는 거부 정책은 source adapter가 결정한다.

### 공통 계약은 runtime facade가 아니라 builder service 경계에 둔다

PRSK와 BanG Dream preview·sampler는 각자 version API 차이를 내부에서 처리한다. 공통 Codex Pet builder에는 기존 sampling service 계약을 주입하므로 하나의 runtime facade나 version별 조건문을 추가하지 않는다.

### Mapping 완료 뒤 preview와 export가 같은 57-pose projection을 사용한다

Package 생성에 사용되는 framing control은 57개 표준 pose의 같은 sample time, raw bounds 합집합과 canonical projection을 preview와 sampler에 적용한다. Mapping 전 bootstrap preview는 source 확인을 위한 임시 상태이며 package raster 일치 판정의 기준이 아니다.

### 실제 오류 shape를 안전한 allowlist로 정규화한다

Garupa 진단 adapter는 원격 오류의 `details`, renderer·runtime 오류의 `context`, importer 오류의 직접 scalar field를 병합한 뒤 기존 allowlist만 노출한다. `path`, raw exception, stack과 ZIP payload는 계속 제거한다. 테스트는 synthetic `details` 객체뿐 아니라 실제 오류 클래스를 사용한다.

## Risks / Trade-offs

- [Risk] `spine-versioned-runtime` capability 이름이 전역 router로 오해될 수 있다. → Purpose와 requirement를 integration별 runtime 소유권 중심으로 수정한다.
- [Risk] PRSK best-effort parse는 모든 version의 성공을 보장하지 않는다. → 정상 header를 허용하되 parser 성공 여부가 preview 결과를 결정한다고 명시한다.
- [Risk] 여러 오류 context source를 병합하면 비공개 값이 유입될 수 있다. → 고정 safe key와 128자 scalar 제한을 병합 이후에도 동일하게 적용한다.
