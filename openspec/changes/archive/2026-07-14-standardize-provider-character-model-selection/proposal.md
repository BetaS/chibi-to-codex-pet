## Why

카탈로그형 provider가 한 캐릭터의 여러 LiveSD 모델을 제공할 때 flat 모델 목록을 곧바로 캐릭터 목록으로 노출하면 같은 캐릭터가 반복되고, 어떤 모델을 고르는지와 생성될 Pet 이름의 관계도 불명확해진다. STRR와 Garupa가 이미 사용하는 캐릭터 우선 흐름을 provider 공통 계약으로 승격해 PRSK의 누락을 보완하고 이후 추가되는 provider의 UX 편차를 방지해야 한다.

## What Changes

- 캐릭터별 모델을 제공하는 모든 카탈로그형 provider가 `캐릭터 → 모델/에디션` 순서로 선택하도록 전역 계약을 추가한다.
- 캐릭터 commit은 하위 모델 목록만 결정하고, 모델/에디션 commit만 실제 모델 요청과 preview 생성을 시작하도록 규정한다.
- 새 source의 기본 Pet 이름을 현재 locale의 `모델/에디션 이름 - 캐릭터 이름`으로 만들고, 명시적으로 불러온 저장 preset의 metadata가 이 기본값보다 우선하도록 규정한다.
- PRSK의 flat `sd_*` catalog option을 동적으로 캐릭터 그룹과 모델 option으로 해석하고, 캐릭터와 모델 combobox를 분리한다.
- PRSK preset 복원, catalog 재로드, 연속 선택과 locale 전환에서도 canonical model ID와 기존 request lifecycle을 보존한다.
- STRR와 Garupa의 기존 두 단계 선택 및 기본 이름 동작을 공통 계약의 준수 사례로 회귀 검증한다.
- Provider별 acquisition·backup·실자산 smoke를 ignored local 경계로 분리하고, 추적 source·package·CI에는 권리 제한 응답과 model payload가 들어오지 않도록 전역 repository harness를 추가한다.

## Capabilities

### New Capabilities

- `catalog-character-model-selection`: 모든 카탈로그형 provider의 캐릭터 우선 선택, 모델 요청 trigger, 기본 Pet 이름과 preset 우선순위를 정의한다.
- `provider-repository-boundary`: 모든 provider의 권리물 비포함, local 운영 도구·실자산 smoke 격리와 repository merge gate를 정의한다.

### Modified Capabilities

- `prsk-remote-resource-source`: flat PRSK 모델 option을 캐릭터별로 탐색하고 두 번째 모델 commit에서만 direct model을 요청하도록 변경한다.

## Impact

- `src/features/livesd/prsk/remote/`의 catalog option 해석 타입·utility와 검증 테스트
- `src/features/livesd/prsk/PrskIntegration.tsx`의 remote selection state, request trigger, preset 복원과 builder source metadata
- PRSK 관련 다국어 message와 React/Playwright 회귀 테스트
- STRR·Garupa의 기존 provider 선택 및 기본 이름 회귀 테스트
- OpenSpec capability map과 관련 main spec 동기화
- Karth·PRSK·STRR·Garupa local 도구와 Playwright suite 경계, package script, CI 및 repository boundary verifier
