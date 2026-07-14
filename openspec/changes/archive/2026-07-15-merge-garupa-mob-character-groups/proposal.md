## Why

Garupa catalog의 Mob 항목이 provider character ID별로 첫 번째 캐릭터 선택기에 노출되고, 여러 Mob이 공유하는 bundle은 `기타 모델`로 분리되어 같은 종류의 모델을 찾기 어렵다. Provider metadata가 Mob으로 확정할 수 있는 항목을 하나의 안정적인 선택 그룹으로 합쳐 catalog drift 없이 동일한 UX를 제공해야 한다.

## What Changes

- Garupa character metadata의 `characterType`을 안전한 catalog 분류(`unique`, `mob`, `unmapped`)로 보존한다.
- 하나 이상의 non-`unique` 후보만 연결된 bundle은 개별 Mob 이름이나 후보 수와 관계없이 `Mob`으로 분류한다.
- 첫 번째 searchable combobox에서 모든 Mob entry를 단일 `Mob` option으로 합치고, 두 번째 combobox에는 각 원본 bundle ID를 model option으로 유지한다.
- 여러 고유 캐릭터가 충돌하거나 metadata에 대응하지 않는 bundle은 기존 `기타 모델` group에 유지한다.
- catalog 재조회, model 선택, 기본 Pet 이름과 request identity가 Mob 통합 뒤에도 원본 bundle을 보존하는지 회귀 테스트한다.

## Capabilities

### New Capabilities

없음.

### Modified Capabilities

- `garupa-pinned-snapshot-source`: Provider가 Mob으로 식별한 character/model을 단일 캐릭터 group으로 표시하고 진짜 미매핑 group과 구분하는 요구사항을 추가한다.

## Impact

- `src/features/livesd/garupa/remote/characterCatalog.ts`의 catalog entry 계약과 분류 로직
- `src/features/livesd/garupa/integration/GarupaSourcePanel.tsx`의 character/model group projection, locale label, 선택 복원과 count
- Garupa remote parser 및 source panel unit/integration fixture
- Garupa locale message와 `garupa-pinned-snapshot-source` capability
