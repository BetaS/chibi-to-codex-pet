## Why

PRSK 캐릭터 selector가 locale label 기준의 단일 목록만 제공해, 전체 roster와 Mob·Staff·custom 항목이 함께 있을 때 원하는 캐릭터의 스토리 유닛을 빠르게 구분하기 어렵다. PRSK의 공식 유닛 순서와 roster를 비선택 섹션으로 표시하면 canonical 선택 workflow를 바꾸지 않고 탐색성을 높일 수 있다.

## What Changes

- PRSK 캐릭터 dropdown을 `Leo/need`, `MORE MORE JUMP!`, `Vivid BAD SQUAD`, `Wonderlands×Showtime`, `25시, 나이트 코드에서.`, `VIRTUAL SINGER`, `기타` 순서의 비선택 섹션으로 구분한다.
- 각 유닛 안의 known character도 공식 roster 순서로 표시하고, Mob·Staff·custom·미분류 identity는 `기타`에 보존한다.
- 섹션 제목은 app locale의 공식 표기를 사용하고 stable unit key와 분리한다.
- 검색 결과가 있는 섹션만 렌더링하며 unit key·제목 검색을 지원한다. 섹션 제목은 pointer·keyboard 선택, highlight, commit과 network request 대상이 아니다.
- 공용 searchable combobox에 선택 가능한 option과 독립된 optional group metadata 표현을 추가하되, PRSK 캐릭터 selector만 이 metadata를 제공해 다른 provider UX를 유지한다.

## Capabilities

### New Capabilities

없음.

### Modified Capabilities

- `catalog-character-model-selection`: PRSK 캐릭터 selector의 공식 유닛 순서, VIRTUAL SINGER 독립 섹션, 기타 fallback과 비선택 group heading 동작을 추가한다.

## Impact

- `src/features/livesd/prsk/remote/characterModelCatalog.ts`의 canonical roster projection과 정렬
- `src/features/livesd/prsk/PrskIntegration.tsx`의 character option metadata
- `src/features/livesd/ui/SearchableCombobox.tsx`와 option filtering의 optional group rendering·검색·접근성
- locale message 또는 locale별 PRSK unit label과 관련 unit/component/E2E tests
