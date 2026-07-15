## Context

PRSK, STRR와 Garupa는 `CodexPetPresetLoader`와 `useCodexPetPresetSession`을 공유하지만 remote catalog action은 각 integration이 렌더링한다. 현재 저장 프리셋을 대기 선택하면 각 catalog action이 비활성화될 뿐 계속 노출되고, 새 session 진입은 dropdown의 첫 option에만 있어 사용자가 다음 행동을 발견하기 어렵다.

Preset dropdown에서 `null`을 선택하는 기존 경로는 runtime별 active preset 제거, builder reset과 진행 중 provider request 취소를 이미 integration callback까지 전달한다. 새 동작은 이 경로를 재사용하고 저장 schema나 provider lifecycle을 새로 만들지 않아야 한다.

## Goals / Non-Goals

**Goals:**

- 저장 프리셋 복원과 새 session의 catalog 선택 경로를 명확하게 분리한다.
- 저장 프리셋 선택 중에는 공통 `새로 만들기` action으로 새 session 진입을 발견할 수 있게 한다.
- PRSK, STRR와 Garupa가 같은 visibility·reset 계약을 따르도록 테스트한다.

**Non-Goals:**

- Preset storage schema, 저장 개수나 runtime 격리 방식을 변경하지 않는다.
- Local upload file 선택과 명시적 local import를 새 session gate에 포함하지 않는다.
- Preset을 자동으로 적용하거나 remote catalog/model request 시점을 변경하지 않는다.

## Decisions

### 공통 loader가 새 session 진입 action을 소유한다

`CodexPetPresetLoader`는 저장 프리셋이 선택된 경우에만 locale별 `새로 만들기` button을 `프리셋 불러오기` 아래에 렌더링한다. 새 callback이나 session 상태를 추가하는 대신 클릭 시 기존 `onSelectionChange(null)`을 호출한다. Dropdown의 `새 세션` option과 같은 callback을 사용하면 provider별 request 취소, active preset 제거와 builder reset이 한 경로에 유지된다.

별도 `createSession()` API를 hook에 추가하는 대안은 동일 상태 전이를 두 진입점에 중복 표현하므로 채택하지 않는다. `새로 만들기`는 진행 중 preset 복원을 취소할 수 있어야 하므로 `busy` 중에도 dropdown과 마찬가지로 사용할 수 있게 한다.

### Catalog action은 provider integration에서 조건부 렌더링한다

각 provider는 `selectedPresetName === null`일 때만 `data-provider-capability="catalog-load"` action을 DOM과 accessibility tree에 렌더링한다. 새 session에서는 기존 URL 유효성·request phase 같은 provider별 disabled 조건을 그대로 적용한다. 저장 프리셋을 선택한 상태에서는 action 자체를 제거하고, preset load와 `새로 만들기`만 다음 primary 선택으로 남긴다.

Catalog action을 공통 loader로 이동하는 대안은 provider마다 다른 label, URL 입력과 loading lifecycle을 결합하므로 채택하지 않는다. 공통 계약은 shared selection state와 development harness가 검증하고 실제 action은 provider가 계속 소유한다.

### 공통 회귀와 provider별 통합 동작을 함께 검증한다

공통 loader test는 `새로 만들기`의 조건부 표시와 `onSelectionChange(null)` 호출을 검증한다. Runtime 격리 App test와 PRSK·STRR·Garupa 통합 test는 저장 프리셋 중 catalog action이 존재하지 않고, `새로 만들기` 뒤 dropdown이 `새 세션`으로 전환되며 action이 다시 나타나는지 검증한다. Provider development harness는 모든 available provider에 runtime별 저장 preset을 주입해 같은 전환 계약을 반복 검증하고, 저장 preset이 없는 초기 새 session에서도 catalog capability가 계속 존재하고 활성인지 보장한다.

## Risks / Trade-offs

- [저장 프리셋 선택 중 catalog action이 DOM에서 사라져 자동화 selector가 달라짐] → capability harness와 통합 test를 새 visibility 계약에 맞추고, 새 session 초기 상태의 marker는 유지한다.
- [새로 만들기와 dropdown option의 동작이 drift할 수 있음] → 두 control이 같은 `onSelectionChange(null)` callback을 호출하도록 구현하고 한 test에서 동일한 observable 결과를 고정한다.
- [진행 중 preset 복원에서 새로 만들기를 누를 수 있음] → 기존 provider별 null selection handler의 abort·generation invalidation을 그대로 실행해 stale 결과 적용을 막는다.

## Migration Plan

별도 data migration은 없다. UI와 test를 함께 배포하며 문제가 있으면 조건부 렌더링과 공통 button만 되돌릴 수 있고 저장된 preset document는 영향을 받지 않는다.

## Open Questions

없음.
