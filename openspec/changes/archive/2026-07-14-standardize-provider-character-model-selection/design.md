## Context

STRR는 catalog 자체가 `character → editions` 계층이고 Garupa는 character metadata로 flat bundle을 묶어 두 단계 selector를 만든다. 두 integration 모두 leaf model을 고른 시점에만 load를 시작하고 `모델/에디션 - 캐릭터`를 builder의 `defaultDisplayName`으로 전달한다.

PRSK remote catalog는 network·보안 경계상 검증된 flat `{ id, label }` option만 반환한다. Provided snapshot의 canonical ID는 `sd_21miku_normal`, `sd_21miku_street`처럼 캐릭터 token과 모델 suffix를 포함하지만 현재 UI는 각 leaf를 모두 캐릭터로 노출하고 leaf commit을 즉시 model request로 연결한다. Recipe와 preset의 `characterId`는 이미 이 leaf model ID를 canonical source identity로 사용하므로 저장 형식과 model URL 계약은 유지해야 한다.

## Goals / Non-Goals

**Goals:**

- 새 카탈로그형 provider가 반복해서 따라야 하는 캐릭터 우선 선택과 기본 이름 계약을 provider 독립 capability로 정의한다.
- PRSK flat catalog를 hard-coded 캐릭터 목록 없이 동적 캐릭터 그룹과 leaf model로 투영한다.
- 캐릭터 commit과 모델 commit의 request trigger를 분리하고 기존 abort, generation, stale completion 및 atomic preview handoff를 보존한다.
- Remote preset의 canonical leaf ID를 기존 형식 그대로 복원하면서 UI의 상위 캐릭터 선택도 함께 복원한다.
- Ready source에 `모델 label - 캐릭터 label`을 전달해 preset이 없는 builder의 Pet 이름을 자동으로 채운다.
- Provider 실제 응답·asset과 이를 다루는 도구를 Git, package와 CI에서 분리하고 새 provider에도 자동 적용되는 repository gate를 둔다.

**Non-Goals:**

- PRSK 캐릭터 전체 목록이나 locale별 고유 이름을 production bundle에 고정한다.
- Provider catalog 또는 recipe/preset schema를 변경한다.
- PRSK local ZIP에서 파일명만으로 캐릭터 metadata를 추측한다.
- STRR·Garupa의 provider별 catalog schema, renderer 또는 request 구현을 공통 모듈로 합친다.
- Provider가 제공하지 않은 의상 의미나 번역을 외부 API에서 추가로 조회한다.
- Provider repository·commit·URL·web viewer와 검증 provenance metadata를 제거한다.

## Decisions

### 1. 전역 제품 계약과 provider별 normalization을 분리한다

새 `catalog-character-model-selection` capability는 두 단계 선택, leaf request trigger, 기본 이름과 preset 우선순위만 규정한다. 각 provider는 자신의 신뢰 가능한 metadata와 ID 규칙으로 `character → models` view를 만든다. 이미 구조화된 STRR는 edition을, Garupa는 character metadata와 bundle을 그대로 사용하고 PRSK만 flat catalog adapter를 추가한다.

모든 integration을 하나의 React component나 공통 catalog schema로 즉시 통합하는 대안은 provider별 lifecycle과 runtime 차이를 불필요하게 결합하므로 선택하지 않는다. 대신 공통 spec과 provider 경계 테스트가 이후 provider의 준수 기준이 된다.

### 2. PRSK network DTO와 canonical leaf identity를 유지한다

`PrskRemoteCatalog.characters`와 `PrskRemoteResourceSource`의 `characterId` 이름은 호환성을 위해 유지하되, UI에서는 각 항목을 leaf model로 해석한다. 별도 pure utility가 catalog를 다음 view로 투영한다.

```ts
interface PrskRemoteCharacterGroup {
  key: string
  label: string
  models: readonly PrskRemoteModelChoice[]
}

interface PrskRemoteModelChoice {
  id: string
  label: string
  defaultDisplayName: string
}
```

Provided 형식 `sd_<character-token>_<model-suffix>`는 첫 token을 캐릭터 key, 나머지 suffix 전체를 model key로 사용한다. Character label은 선행 순번을 제거하고 영문·숫자 경계를 띄우는 결정적 humanization으로 만들며, model label은 provider label이 ID와 다르면 그 label을 존중하고 같으면 suffix를 humanize한다. Suffix가 없거나 canonical 형식과 맞지 않는 option은 제거하지 않고 option ID별 singleton character group으로 보존한다. 이 경우 model label은 provider label 또는 원본 ID를 사용한다.

정적 PRSK 이름 map을 포함하는 대안은 snapshot 갱신 때 앱 배포가 필요하고 기존 production artifact의 고정 catalog 비포함 계약과 충돌하므로 사용하지 않는다. Label 공통 부분을 자연어로 추론하는 대안도 custom label의 언어·어순에 따라 불안정하므로 사용하지 않는다.

### 3. UI state는 상위 character key와 canonical model ID를 분리한다

PRSK integration은 `selectedCharacterKey`와 `selectedModelId` 및 각 combobox의 독립 query reset key를 가진다. Character commit은 진행 중 model request를 abort하고 generation을 무효화한 뒤 leaf 선택만 비우며 network를 시작하지 않는다. 기존 active preview가 있다면 새 leaf가 성공하기 전까지 그 source identity와 builder를 유지해 선택 중 상태를 active source로 오인하지 않게 한다.

Model commit은 선택된 group에 실제로 속한 ID만 loader에 전달한다. Load 성공 시 active source, preview와 builder를 원자적으로 교체하고, 실패 또는 stale completion은 기존 active source를 유지한다. Catalog reload는 canonical leaf가 새 catalog에 남아 있으면 character group과 model 선택을 함께 복원하고, 없으면 두 pending 선택을 비운다.

캐릭터 commit 즉시 기존 preview를 dispose하는 STRR의 세부 동작까지 전역화하는 대안은 atomic handoff를 사용하는 Garupa·PRSK와 불필요하게 충돌하므로 최소 공통 계약에 포함하지 않는다.

### 4. Preset은 leaf ID로 복원하고 기본 이름은 source handoff에 싣는다

Preset load는 저장된 `characterId`를 catalog leaf에서 검증하고 해당 group key를 계산한 뒤 두 selector를 복원한다. Recipe와 preset payload는 바뀌지 않는다. 새 source가 성공하면 같은 visible model/character label로 만든 `defaultDisplayName`을 `CodexPetBuilderSource`에 넣는다.

Builder는 기존과 같이 명시적으로 적용된 preset metadata를 source 기본 이름보다 우선한다. Default 이름은 source activation 시점 값이며 locale 전환이나 query 변경으로 이미 입력된 Pet metadata를 다시 쓰지 않는다.

### 5. Pure normalization과 integration behavior를 서로 다른 수준에서 검증한다

Unit test는 canonical grouping, multi-part suffix, singleton fallback, label humanization, stable order와 default 이름을 검증한다. React test는 character commit의 0 model request, model commit의 1 request, preset 복원, catalog reload와 Pet 이름을 검증한다. STRR와 Garupa의 기존 테스트는 전역 계약의 다른 provider 준수 증거로 유지한다. Playwright fixture도 두 selector와 request count를 반영한다.

### 6. Provider 실제 자료는 ignored local 경계로 격리한다

Karth acquisition, STRR 변환, Garupa snapshot·Spine 검증, PRSK 실모델 render/export smoke와 provider recipe 기반 local npx 검증은 `*.local.mjs`, `*.local.py`, `*.local.spec.ts`로 보존하고 Git에서 제외한다. 기본 Playwright config는 local spec을 제외하며 별도 local config만 이를 실행한다. CI에는 최소 synthetic response를 intercept하는 deterministic 테스트만 남긴다.

`verifyRepositoryBoundary.mjs`는 provider 이름에 의존하지 않고 tracked path, model/archive 확장자, captured response snapshot 이름, tracked E2E의 filesystem asset 접근, root package script와 GitHub workflow를 검사한다. Production build가 이 검사를 먼저 실행하므로 이후 provider가 추가되어도 같은 규칙이 merge gate가 된다. Repository·commit·delivery URL과 digest 같은 provenance는 연결·검증 정보이므로 허용하되 실제 response body와 asset byte는 허용하지 않는다.

## Risks / Trade-offs

- [ID token이 실제 캐릭터 경계를 완전히 표현하지 않을 수 있음] → canonical pattern만 묶고 불명확한 항목은 삭제하지 않는 singleton group으로 보존한다.
- [Custom model label이 이미 캐릭터 이름을 포함해 기본 Pet 이름이 반복될 수 있음] → provider label을 임의 절단하지 않고 `label - character` 계약을 일관되게 적용하며 custom provider가 더 적합한 leaf label을 제공할 수 있게 한다.
- [두 단계 선택으로 single-model 캐릭터도 한 번 더 commit해야 함] → 모든 provider에 예측 가능한 request gate를 제공하고 accidental model download를 방지하는 쪽을 우선한다.
- [기존 PRSK UI 테스트가 flat selector에 강하게 결합됨] → 공통 helper를 character/model 단계로 갱신하고 request-count 회귀를 보강한다.
- [Legacy 타입의 `characters`와 `characterId`가 실제 leaf model을 뜻함] → 외부 저장 계약을 깨지 않도록 유지하고 새 UI projection 타입에서 의미를 명확히 구분한다.
- [Local smoke가 fresh clone과 CI에서 실행되지 않음] → synthetic adapter·lifecycle test를 CI에 유지하고 실제 asset 검증은 명시적 `test:e2e:local`로 분리한다.

## Migration Plan

1. OpenSpec에 전역 capability와 PRSK delta를 추가해 strict validation을 통과시킨다.
2. Pure PRSK grouping utility와 unit test를 추가한다.
3. PRSK integration state, selector, preset 복원과 builder 기본 이름을 새 view에 연결한다.
4. 다국어 catalog 및 React/Playwright 테스트를 갱신하고 typecheck, lint, unit, 관련 E2E를 실행한다.
5. 구현 완료 후 delta spec을 main spec과 capability map에 동기화한다. 문제가 발생하면 UI projection과 두 selector 변경만 되돌리며 network DTO, recipe와 preset 데이터에는 migration이 필요하지 않다.
6. Provider local 도구·실자산 smoke를 ignored naming으로 이동하고 repository boundary gate를 production build 앞에 연결한다.

## Open Questions

없음. 구조화되지 않은 PRSK option은 singleton group으로 보존하고, custom label은 provider가 준 원문을 사용하는 것으로 확정한다.
