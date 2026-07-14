## Why

누적 main spec의 공통 Spine runtime routing과 preview framing 문구가 현재 PRSK·BanG Dream 구현의 실제 소유 경계 및 57-pose canonical projection과 어긋나 있다. 릴리스 준비 전에 코드가 보장하는 계약을 명세에 정확히 반영하고 Garupa 공개 오류 경계의 안전한 context 보존 누락을 해소한다.

## What Changes

- PRSK는 고정 Spine 3.6 adapter, BanG Dream은 고정 Spine 4.0 adapter를 각 integration이 소유하는 현재 구조를 runtime 계약으로 명시한다.
- source별 adapter가 자신의 기준 runtime으로 호환성을 판정하고 best-effort parse를 선택할 수 있게 하며, 전역 cross-version fallback 금지 계약을 제거한다.
- preview와 export가 상태 매핑 이후 같은 57개 표준 pose 합집합의 canonical projection을 사용하도록 framing 계약을 통일한다.
- Garupa 공개 오류 adapter가 실제 importer·renderer·runtime 오류 객체의 안전한 구조화 context를 보존하도록 구현과 회귀 테스트를 보강한다.
- Garupa 활성화 요구사항에서 일회성 `feature branch` 표현을 제거하고 dev·production build에 적용되는 영속적인 제품 계약으로 정리한다.

## Capabilities

### New Capabilities

없음.

### Modified Capabilities

- `spine-versioned-runtime`: 전역 header router 대신 게임 integration이 기준 runtime adapter를 소유하는 계약으로 변경한다.
- `codex-pet-package-export`: LiveSD preview와 export의 자동 fit을 같은 57-pose canonical projection으로 통일한다.
- `garupa-integration-boundary`: 실제 오류 객체의 안전한 context 보존과 branch-neutral registry activation을 명확히 한다.
- `game-source-selection`: Garupa activation evidence와 available 상태를 특정 feature branch가 아닌 검증된 build 기준으로 표현한다.

## Impact

- OpenSpec main spec과 delta spec
- `src/features/livesd/garupa/errors.ts` 및 관련 단위 테스트
- runtime 구현 자체와 사용자 선택 흐름은 변경하지 않는다.
