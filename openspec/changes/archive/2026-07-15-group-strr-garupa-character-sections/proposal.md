## Why

PRSK 캐릭터 selector는 공식 소속별 비선택 section을 제공하지만 STRR와 Garupa는 긴 캐릭터 목록을 flat하게 표시해 원하는 캐릭터를 찾기 어렵다. 두 provider도 frozen catalog에서 검증 가능한 소속 identity를 사용해 같은 탐색 UX를 제공하고, 신규 catalog 항목이 알려진 group으로 임의 분류되는 drift를 막아야 한다.

## What Changes

- STRR 캐릭터를 exact canonical character ID roster에 따라 세이쇼·린메이칸·프론티어·시크펠트·세이란·기타 section으로 표시한다.
- Garupa character metadata의 optional `bandId`를 검증·보존하고, 고유 캐릭터를 Poppin'Party부터 MyGO!!!!!까지 공식 band section 순서로 표시한다.
- Garupa의 단일 `Mob` group과 미매핑 모델은 마지막 `기타` section에 유지한다.
- 두 provider 모두 section heading을 선택 불가능한 combobox group으로 렌더링하고, section key·공식 label·검색 alias로 option을 검색할 수 있게 한다.
- Section projection은 캐릭터·모델/에디션 identity, preset, request target과 catalog request 수를 변경하지 않는다.
- 알려지지 않은 STRR ID와 Garupa band ID는 추측하지 않고 `기타` section에서 계속 선택할 수 있게 한다.

## Capabilities

### New Capabilities

없음.

### Modified Capabilities

- `catalog-character-model-selection`: PRSK뿐 아니라 STRR와 Garupa도 provider가 검증한 공식 소속별 캐릭터 section을 제공하도록 공통 selector 계약을 확장한다.

## Impact

- `src/features/livesd/strr/`의 exact roster section projection과 integration test
- `src/features/livesd/garupa/remote/characterCatalog.ts`의 `bandId` 보존, Garupa section projection과 panel test
- 공용 `SearchableCombobox`의 기존 non-selectable group metadata 사용
- `catalog-character-model-selection` OpenSpec 요구사항
- Runtime dependency, provider URL, asset byte와 preset schema에는 영향 없음
