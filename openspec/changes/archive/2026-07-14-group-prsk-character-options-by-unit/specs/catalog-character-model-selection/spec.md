## ADDED Requirements

### Requirement: PRSK 캐릭터의 공식 유닛 section
PRSK 캐릭터 selector는 catalog에 존재하는 known canonical character를 `Leo/need`, `MORE MORE JUMP!`, `Vivid BAD SQUAD`, `Wonderlands×Showtime`, `25시, 나이트 코드에서.`, `VIRTUAL SINGER`, `기타` 순서의 비선택 section으로 표시해야 한다(MUST). Known character는 각 유닛의 공식 roster 순서로 표시해야 하고(MUST), locale별 section label은 stable unit key와 canonical character·model identity를 변경해서는 안 된다(MUST NOT). 유효한 Mob·Staff·custom·미분류 identity는 마지막 `기타` section에 보존해야 하며(MUST), section heading은 option highlight·commit 또는 network request 대상이 되어서는 안 된다(MUST NOT).

#### Scenario: 공식 유닛과 VIRTUAL SINGER 순서
- **WHEN** catalog에 다섯 스토리 유닛과 Miku·Rin·Len·Luka·MEIKO·KAITO character leaf가 순서 없이 포함된다
- **THEN** selector는 다섯 스토리 유닛을 공식 순서로 표시한 뒤 독립 `VIRTUAL SINGER` section을 표시해야 한다
- **AND** 각 section 안의 known character를 공식 roster 순서로 표시해야 한다
- **AND** Virtual Singer character를 스토리 유닛에 중복 표시해서는 안 된다

#### Scenario: 기타 identity 보존
- **WHEN** catalog에 numbered Mob·Staff family와 known roster에 없는 valid singleton 또는 custom identity가 있다
- **THEN** selector는 해당 identity를 마지막 `기타` section에서 계속 검색·선택할 수 있어야 한다
- **AND** identity를 알려진 유닛으로 추측하거나 canonical model ID를 변경해서는 안 된다

#### Scenario: section 검색과 결과 축소
- **WHEN** 사용자가 character label·canonical key·unit key 또는 현재 locale의 unit label로 검색한다
- **THEN** 일치하는 selectable option과 그 option이 속한 section heading만 표시해야 한다
- **AND** 검색과 heading rendering은 character·model 선택, preview와 request generation을 변경해서는 안 된다

#### Scenario: section heading interaction
- **WHEN** 사용자가 PRSK character listbox를 pointer 또는 arrow key로 탐색한다
- **THEN** section heading은 highlight·active descendant·commit 대상에서 제외되어야 한다
- **AND** 실제 character option만 선택 가능해야 한다
- **AND** PRSK group metadata를 제공하지 않는 다른 provider와 Pet animation mapping은 기존 flat option behavior를 유지해야 한다

#### Scenario: locale 전환 중 unit 보존
- **WHEN** 캐릭터와 model이 선택된 상태에서 app locale을 변경한다
- **THEN** unit section과 character visible label은 새 locale 표기로 갱신되어야 한다
- **AND** stable unit key, canonical character·model 선택, preview와 request generation은 유지되어야 한다
