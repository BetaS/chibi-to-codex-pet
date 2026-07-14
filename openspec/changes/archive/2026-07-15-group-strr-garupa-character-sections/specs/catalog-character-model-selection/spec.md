## ADDED Requirements

### Requirement: STRR와 Garupa 캐릭터의 공식 소속 section

STRR와 Garupa character selector는 provider adapter가 검증한 stable 소속 identity에 따라 catalog에 존재하는 캐릭터 option을 공식 순서의 비선택 section으로 표시해야 한다(MUST). STRR는 frozen catalog의 exact canonical roster를 세이쇼 음악학교, 린메이칸 여학교, 프론티어 예술학교, 시크펠트 음악학원, 세이란 종합예술원, 기타 순서로 표시해야 한다(MUST). Garupa는 고유 캐릭터의 검증된 `bandId`를 사용해 Poppin'Party, Afterglow, Pastel＊Palettes, Roselia, Hello, Happy World!, Morfonica, RAISE A SUILEN, MyGO!!!!!, 기타 순서로 표시해야 한다(MUST). Known character는 각 소속의 공식 roster 순서를 따라야 하며(MUST), unknown STRR ID, unknown Garupa band ID, Garupa Mob과 미매핑 identity는 마지막 기타 section에서 계속 검색·선택할 수 있어야 한다(MUST). Section heading은 option highlight·commit 또는 request 대상이 되어서는 안 되고(MUST NOT), section projection을 위해 추가 provider request를 보내서는 안 된다(MUST NOT).

#### Scenario: STRR 공식 학교 section
- **WHEN** STRR catalog에 다섯 학교의 known canonical character와 roster에 없는 유효한 character가 순서 없이 존재한다
- **THEN** selector는 세이쇼, 린메이칸, 프론티어, 시크펠트, 세이란, 기타 section 순서로 해당 option을 표시해야 한다
- **AND** known character는 각 학교의 공식 roster 순서로, unknown character는 기타 section에서 원본 canonical ID로 선택 가능해야 한다

#### Scenario: Garupa 공식 band section
- **WHEN** Garupa catalog에 known `bandId`를 가진 고유 캐릭터가 순서 없이 존재한다
- **THEN** selector는 Poppin'Party부터 MyGO!!!!!까지 공식 band 순서로 section을 표시하고 각 band의 캐릭터를 공식 roster 순서로 표시해야 한다
- **AND** character·bundle identity와 model request target은 section 추가 전과 같아야 한다

#### Scenario: Garupa 기타 section
- **WHEN** catalog에 단일 Mob group, 미매핑 model group 또는 unknown `bandId`의 고유 캐릭터가 있다
- **THEN** selector는 해당 option을 마지막 기타 section에서 모두 보존해야 한다
- **AND** Mob과 미매핑 option을 서로 합치거나 unknown character를 known band로 추측해서는 안 된다

#### Scenario: section 검색과 heading interaction
- **WHEN** 사용자가 STRR/Garupa character label, canonical key, section key, 현재 locale의 section label 또는 지원 alias로 검색·탐색한다
- **THEN** 일치하는 selectable option과 해당 section heading만 표시해야 한다
- **AND** heading은 pointer·arrow key highlight와 commit 대상에서 제외되고 실제 character option만 선택 가능해야 한다
- **AND** 검색과 heading rendering은 selection, preview, preset과 network generation을 변경해서는 안 된다

#### Scenario: locale 전환과 추가 request 금지
- **WHEN** 캐릭터와 leaf가 선택된 상태에서 app locale을 변경하거나 section option을 다시 계산한다
- **THEN** section·character visible label은 새 locale로 갱신되고 stable section key와 canonical character·leaf selection은 유지되어야 한다
- **AND** section projection만으로 catalog, model 또는 별도 소속 metadata request를 시작해서는 안 된다
