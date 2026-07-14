## Context

Garupa character catalog는 `characters.all.5.json`의 `characterType`, locale 이름과 costume의 `sdAssetBundleName`을 frozen snapshot의 buildData 목록에 조인한다. 현재 parser는 단일 후보의 ID와 이름만 결과에 보존하므로 non-`unique` character도 ID별 group이 되고, 여러 Mob 후보가 공유하는 bundle은 character 종류까지 잃은 채 `unmapped` group으로 들어간다.

UI는 catalog entry의 `characterId`만으로 group key를 만들기 때문에 parser에서 Mob 분류를 보존하지 않으면 locale 이름 정규식이나 ID 범위 같은 불안정한 추측이 필요하다. Model request와 preset은 `sdAssetBundleName`을 identity로 사용하므로 group projection만 바꾸고 이 identity는 유지해야 한다.

## Goals / Non-Goals

**Goals:**

- Provider metadata만 사용해 고유 캐릭터, Mob, 미매핑 entry를 명시적으로 분류한다.
- 모든 Mob bundle을 첫 combobox의 단일 `Mob` group 아래에 표시한다.
- Mob 후보가 여러 명이라 이름을 결정할 수 없어도 후보가 모두 non-`unique`라면 안전하게 Mob 종류는 보존한다.
- Model 선택, request, reload 복원과 기본 Pet 이름이 원본 entry identity를 유지한다.
- 고유 캐릭터 충돌과 metadata 부재는 Mob으로 오분류하지 않는다.

**Non-Goals:**

- Provider의 개별 Mob 이름이나 character ID를 합성·교정하지 않는다.
- Garupa snapshot, asset byte, materialization URL 또는 preset schema를 변경하지 않는다.
- PRSK·STRR 등 다른 provider의 grouping policy를 변경하지 않는다.

## Decisions

### Catalog entry에 안정적인 `characterKind`를 추가한다

Parser 결과에 `characterKind: 'unique' | 'mob' | 'unmapped'`를 필수로 둔다. `characterType === 'unique'`인 유효 후보가 하나로 선택되면 `unique`, 후보들이 모두 non-`unique`면 `mob`, 그 밖의 충돌 또는 부재는 `unmapped`로 분류한다.

원본 `characterType` 문자열을 UI에서 직접 해석하는 방식은 여러 후보가 공유하는 bundle에 하나의 문자열을 선택해야 하고 provider 값이 UI까지 누출된다. 이름의 `Mob`/`モブ` 패턴이나 ID 범위를 사용하는 방식은 locale과 catalog revision에 따라 drift하므로 사용하지 않는다.

### Identity resolution과 종류 분류를 분리한다

단일 후보를 정할 수 있을 때만 `characterId`와 locale 이름을 보존하는 현재 원칙은 유지한다. 여러 non-`unique` 후보가 같은 bundle을 공유하면 `characterId`와 이름은 `null`, resolution은 `ambiguous`로 두되 `characterKind`만 `mob`으로 확정한다. 여러 `unique` 후보가 충돌하면 종류도 `unmapped`로 둔다.

이렇게 하면 임의 Mob 이름을 고르지 않으면서도 사용자가 찾는 상위 category는 정확하게 제공할 수 있다.

### UI projection은 stable group key로 합친다

Garupa panel은 `unique` entry를 `character:<id>`, 모든 `mob` entry를 `mob`, 나머지를 `unmapped` key로 묶는다. 고유 캐릭터는 locale 이름순, `Mob`은 그 뒤, `기타 모델`은 마지막에 표시한다. Catalog count는 `unmapped`를 제외한 실제 선택 group 수를 센다.

Reload 복원도 동일한 entry-to-group key 함수를 사용해 선택한 Mob bundle이 catalog 재조회 뒤 `mob` group에 남도록 한다. Model option의 label/value와 controller request는 계속 원본 `bundleName`을 사용한다. Entry에 확정된 locale 이름이 있으면 기존 기본 Pet 이름을 유지하고, 모호한 Mob이면 bundle ID만 사용한다.

### Locale label은 제품 message로 관리한다

단일 group label은 `garupa.mobCharacters` message key로 네 locale에 제공한다. Provider가 내려준 개별 이름과 달리 이 label은 제품 taxonomy이므로 catalog payload에 의존하지 않는다.

## Risks / Trade-offs

- [Provider가 새 non-`unique` type을 Mob 외 의미로 추가할 수 있음] → Frozen manifest의 현재 metadata 계약에서는 non-`unique`를 Mob category로 취급하고 parser fixture로 고정한다. Revision을 바꿀 때 catalog contract 검토가 필요하다.
- [공유 Mob은 개별 기본 이름을 표시할 수 없음] → 이름을 추측하지 않고 원본 bundle ID를 Pet 기본 이름으로 사용한다.
- [`characterKind` 추가로 fixture가 일괄 갱신됨] → 필수 discriminant로 두어 새 catalog producer가 분류를 누락하면 typecheck에서 실패하게 한다.

## Migration Plan

1. Parser가 모든 entry에 `characterKind`를 생성하고 remote unit test로 분류 경계를 고정한다.
2. Panel grouping과 locale message를 전환하고 단일 Mob option, bundle 보존과 unmapped 분리를 integration test로 검증한다.
3. Typecheck와 Garupa 관련 test를 통과시킨다.

Runtime 저장 데이터와 preset schema migration은 없다. Rollback은 `characterKind`와 Mob projection을 제거하면 되며 provider asset 또는 사용자 데이터 변경은 발생하지 않는다.

## Open Questions

없음.
