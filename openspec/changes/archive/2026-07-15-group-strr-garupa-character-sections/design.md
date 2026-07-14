## Context

공용 `SearchableCombobox`는 option의 `group` metadata를 연속된 비선택 heading으로 렌더링하고 group key·label·search term 검색과 keyboard heading skip을 이미 지원한다. PRSK는 provider adapter가 공식 unit과 roster 순서를 option에 투영해 이 기능을 사용하지만 STRR와 Garupa character option은 locale label로만 전역 정렬된다.

STRR frozen catalog는 character ID와 locale 이름·edition만 제공하고 학교 field는 포함하지 않는다. 검증된 snapshot의 canonical ID roster는 세이쇼 `101–109`, 린메이칸 `201–205`, 프론티어 `301–305`, 시크펠트 `401–410`, 세이란 `501–503`, 협업 캐릭터 `901–907`로 고정되어 있다. Garupa frozen `characters.all.5.json`은 고유 캐릭터에 optional `bandId`를 제공하지만 현재 parser가 이를 결과에서 버린다.

Section을 추가하면서도 runtime request, catalog body, canonical source identity와 preset schema는 그대로 유지해야 한다. Provider 응답 또는 asset byte를 source에 복제하지 않고 분류에 필요한 최소 official mapping만 코드로 관리한다.

## Goals / Non-Goals

**Goals:**

- STRR와 Garupa character selector를 PRSK와 같은 비선택 section UX로 표시한다.
- Frozen provider metadata와 exact adapter roster만 사용해 소속을 결정한다.
- 공식 section 순서와 roster 순서를 locale과 무관한 stable key/order로 유지한다.
- 현재 locale section label과 alias 검색을 지원하면서 선택·preview·request를 보존한다.
- 알 수 없는 identity를 마지막 `기타` section에서 계속 선택할 수 있게 한다.
- Garupa의 단일 Mob group과 미매핑 group을 같은 마지막 section에 유지하되 selectable option은 분리한다.

**Non-Goals:**

- STRR mirror `catalog.json` schema 또는 provider repository를 수정하지 않는다.
- Garupa band catalog를 추가 request하거나 snapshot 응답을 source file로 저장하지 않는다.
- Model/edition dropdown에 section을 추가하지 않는다.
- PRSK의 기존 unit mapping과 combobox 렌더러를 변경하지 않는다.

## Decisions

### STRR는 exact canonical roster table을 사용한다

STRR adapter에 stable section key별 exact character ID 배열을 둔다. 배열 순서는 provider snapshot의 공식 roster 순서이고, ID가 어느 배열에도 없으면 `other`에 배치한다. ID 첫 자리나 numeric range만으로 새 ID를 자동 분류하지 않는다.

Prefix 규칙은 간결하지만 향후 협업·추가 학교 ID를 잘못 분류할 수 있다. Catalog label에서 학교를 추론하는 방식도 locale과 이름 변경에 취약하다. Exact table은 frozen catalog와 함께 검토 가능하고 unknown identity를 fail-open selection으로 보존한다.

### Garupa는 검증된 `bandId`를 catalog entry에 보존한다

Character parser는 optional `bandId`가 `null`/부재이거나 bounded positive integer인지 검증하고 resolved entry에 `number | null`로 보존한다. 고유 캐릭터만 known band ID mapping을 적용하고, Mob·미매핑 또는 unknown band ID는 `other`에 둔다. Ambiguous entry는 임의 후보의 band를 선택하지 않고 `bandId: null`을 유지한다.

Character ID 범위나 이름으로 band를 추론하는 대안보다 provider의 구조화 metadata가 안정적이다. Band 이름을 얻기 위한 별도 catalog request는 명시적 request gate와 repository boundary를 넓히므로 하지 않는다.

### Provider별 pure section projection이 공용 group metadata를 만든다

STRR projection은 `StrrCharacter` 목록과 locale을 받아 section order·roster order로 정렬된 `SearchableComboboxOption`을 만든다. Garupa projection은 panel의 character group마다 `characterKind`, `bandId`, `characterId`를 사용해 section metadata와 sort order를 계산한다. 두 projection 모두 group object와 결과를 freeze하고 group key·공식 label·검색 alias를 제공한다.

공용 combobox는 이미 heading interaction과 filtered group rendering을 보장하므로 provider integration은 `group` metadata만 전달한다. Section heading은 option value가 없으며 캐릭터 commit callback으로 들어갈 수 없다.

### 공식 표시 순서와 fallback을 고정한다

STRR section 순서는 세이쇼, 린메이칸, 프론티어, 시크펠트, 세이란, 기타다. Garupa section 순서는 Poppin'Party, Afterglow, Pastel＊Palettes, Roselia, Hello, Happy World!, Morfonica, RAISE A SUILEN, MyGO!!!!!, 기타다. Known roster는 공식 배열/character ID 순서, 기타는 기존 stable fallback 순서를 사용한다.

Locale 전환은 section label과 character label만 재계산하고 group key, option value와 current selection을 유지한다. Brand name은 공식 표기를 유지하고 `기타`와 STRR 학교명은 app locale별 label을 제공한다.

## Risks / Trade-offs

- [Frozen catalog가 바뀌어 새 STRR character ID가 추가됨] → Exact mapping에 없으면 `기타`에 안전하게 노출하고 snapshot revision 변경 시 roster table과 test를 함께 검토한다.
- [Garupa에 unknown band ID가 나타남] → 캐릭터를 삭제하거나 기존 band로 추측하지 않고 `기타`에 보존한다.
- [Static 공식 label이 변경됨] → Stable key와 identity는 유지하고 locale label table만 갱신할 수 있게 분리한다.
- [Section metadata 때문에 option 순서가 바뀜] → Known roster는 공식 순서를 명시적으로 test하고 model/edition identity와 request count 회귀 test를 유지한다.

## Migration Plan

1. Garupa parser에 optional `bandId`를 추가하고 schema·ambiguity test를 갱신한다.
2. STRR와 Garupa pure section projection 및 locale/order test를 추가한다.
3. 두 integration이 projection의 `group` metadata를 전달하도록 바꾸고 accessible heading·선택 보존을 검증한다.
4. 관련 unit/integration test, provider harness, typecheck와 OpenSpec strict validation을 실행한다.

저장 preset과 runtime data migration은 없다. Rollback은 provider option에서 `group` projection을 제거하고 Garupa의 추가 `bandId` field를 되돌리면 된다.

## Open Questions

없음.
