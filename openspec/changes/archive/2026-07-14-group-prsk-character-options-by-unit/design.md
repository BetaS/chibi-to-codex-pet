## Context

PRSK remote catalog의 leaf는 `groupPrskRemoteCharacterModels`에서 canonical character group으로 정규화되고, 현재 캐릭터 option은 locale label 기준으로 정렬된 flat `SearchableComboboxOption[]`가 된다. 공용 `SearchableCombobox`는 option label·value 검색과 flat listbox keyboard interaction을 제공하므로, PRSK에만 유닛 구분을 추가하려면 canonical 분류와 공용 renderer의 optional group 표현을 분리해야 한다.

## Goals / Non-Goals

**Goals:**

- PRSK known roster를 공식 유닛·캐릭터 순서로 투영하고 VIRTUAL SINGER를 독립 유닛으로 제공한다.
- Mob·Staff·custom·미분류 identity를 삭제하지 않고 마지막 `other` 섹션에 보존한다.
- 유닛 제목을 선택 불가능한 accessible group heading으로 렌더링하고 검색·keyboard·pointer commit을 실제 option에만 적용한다.
- PRSK가 아닌 provider와 Pet animation mapping의 기존 flat combobox UX를 유지한다.

**Non-Goals:**

- provider catalog 원본, canonical character/model ID 또는 model request URL을 변경하지 않는다.
- 유닛별 Virtual Singer costume을 각 스토리 유닛에 중복 배치하지 않는다.
- STRR·Garupa 등 다른 provider에 PRSK unit taxonomy를 적용하지 않는다.

## Decisions

### Canonical token 기반 unit projection

`PrskCanonicalCharacterToken`별 stable unit key와 roster ordinal을 정적 read-only map으로 정의한다. `leo-need`, `more-more-jump`, `vivid-bad-squad`, `wonderlands-showtime`, `nightcord`, `virtual-singer`, `other` 순서를 별도 상수로 고정하고, `miku`, `rin`, `len`, `luka`, `meiko`, `kaito`는 모두 `virtual-singer`에 둔다. Provider의 ordinal prefix와 `touya` alias는 기존 canonical token 정규화를 재사용한다.

표시 label이나 catalog 순서로 유닛을 추측하는 대안은 locale·provider 변화에 취약하므로 사용하지 않는다. Known token이 아닌 identity와 numbered Mob·Staff family는 `other`로 보존하고 기존 label/key comparator로 deterministic fallback 순서를 만든다.

### Stable group identity와 locale label 분리

`PrskRemoteCharacterGroup`에 stable unit key와 locale별 unit label을 포함한 section metadata를 추가한다. Locale 변경은 label과 검색 text만 갱신하며 selected character key, model ID, preview와 request generation은 유지한다. 브랜드 표기는 locale별 공식 명칭을 사용하고 canonical key는 번역하지 않는다.

### 공용 combobox의 optional group metadata

`SearchableComboboxOption`에 optional `{ key, label }` group metadata를 추가한다. Metadata가 있는 인접 option은 listbox 내부 `role="group"`와 heading으로 렌더링하고, heading은 option ID·active index·click handler를 갖지 않는다. Metadata가 없는 기존 option은 현재 flat markup과 behavior를 유지한다.

Group heading을 disabled `role="option"`으로 만드는 대안은 option count와 arrow-key index를 오염시키므로 사용하지 않는다. 검색은 option label·value뿐 아니라 group key·label도 대상으로 하며, filter 뒤 option이 남은 group만 렌더링한다.

### 정렬과 선택 무결성

Known character group은 unit ordinal과 roster ordinal로 정렬하고, `other`는 Mob·Staff 우선순위 뒤 label·key fallback으로 정렬한다. Model 배열, default Pet name, preset identity와 request target은 기존 값을 유지한다. 검색과 section rendering은 canonical option 배열을 변경하거나 network request를 만들지 않는다.

## Risks / Trade-offs

- [Risk] Provider가 새 canonical character token을 추가하면 자동으로 공식 유닛에 들어가지 않는다. → unknown token을 `other`에 보존하고 roster map 회귀 테스트로 명시적 분류 업데이트를 요구한다.
- [Risk] Nested ARIA group markup이 option 탐색이나 active descendant를 깨뜨릴 수 있다. → active index는 filtered flat option 배열을 유지하고 component test와 Chromium E2E로 keyboard·pointer·검색을 검증한다.
- [Risk] locale별 유닛 표기가 변경될 수 있다. → stable key와 label을 분리하고 label map만 교체 가능하게 유지한다.
