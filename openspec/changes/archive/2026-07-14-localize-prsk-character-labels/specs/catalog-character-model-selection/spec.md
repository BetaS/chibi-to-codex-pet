## ADDED Requirements

### Requirement: locale별 공식 캐릭터 label
카탈로그형 provider는 현재 app locale에서 공식적으로 사용하는 캐릭터 이름을 known canonical character identity의 visible label로 제공해야 한다(MUST). Locale별 label projection은 canonical character·leaf identity와 catalog data를 변경해서는 안 되며(MUST NOT), locale 전환은 selector의 visible label과 검색 대상만 다시 계산하고 현재 캐릭터·leaf 선택, preview와 request generation을 유지해야 한다(MUST). 공식 locale label을 알 수 없는 유효한 identity는 provider가 검증한 label 또는 canonical ID 기반 fallback으로 보존해야 하고(MUST), 다른 캐릭터의 이름을 추측해서는 안 된다(MUST NOT).

#### Scenario: 지원 locale의 공식 캐릭터 이름
- **WHEN** known canonical character를 `ko`, `en`, `ja`, `zh-CN` 중 하나의 locale에서 표시한다
- **THEN** 캐릭터 selector와 새 source의 기본 Pet 이름은 해당 지역 공식 이름을 사용해야 한다
- **AND** 내부 선택값과 preset source identity는 같은 canonical character·leaf ID를 유지해야 한다

#### Scenario: locale 전환 중 선택 보존
- **WHEN** 사용자가 캐릭터와 leaf를 선택한 상태에서 app locale을 변경한다
- **THEN** 캐릭터 visible label과 그 label의 검색 결과는 새 locale로 즉시 갱신되어야 한다
- **AND** 캐릭터·leaf 선택, active preview와 request generation은 유지되어야 한다
- **AND** 이미 ready인 source의 Pet 이름을 다시 계산하거나 덮어써서는 안 된다

#### Scenario: 공식 이름이 없는 identity
- **WHEN** catalog에 공식 locale map에 없는 mob, custom 또는 신규 canonical character identity가 있다
- **THEN** 해당 identity는 검증된 provider label 또는 canonical ID 기반 fallback으로 계속 검색·선택할 수 있어야 한다
- **AND** 알려진 다른 캐릭터의 공식 이름을 할당해서는 안 된다

#### Scenario: PRSK 번호형 mob과 staff 그룹
- **WHEN** PRSK catalog에 `sd_mob<digits>` 또는 `sd_staff<digits>` leaf가 하나 이상 있다
- **THEN** 캐릭터 selector는 해당 leaf를 각각 stable `Mob`과 `Staff` 그룹 하나로 묶어야 한다
- **AND** 모델 selector는 선택한 family에 속한 leaf만 번호 또는 검증된 provider label로 표시해야 한다
- **AND** canonical model ID, preset source identity와 request target은 변경해서는 안 된다
- **AND** 해당 exact pattern과 일치하지 않는 singleton identity를 `Mob` 또는 `Staff`로 추측해서는 안 된다

#### Scenario: 실제 Akito ordinal token
- **WHEN** PRSK catalog가 `sd_11akito_normal` 또는 같은 `11akito` character token의 leaf를 제공한다
- **THEN** 캐릭터 selector와 새 source의 기본 Pet 이름은 현재 locale의 Akito 공식 이름을 사용해야 한다
- **AND** visible label에 raw `akito` token을 노출해서는 안 된다

### Requirement: selector popup viewport 가시성
카탈로그형 provider와 Pet animation mapping에서 사용하는 searchable selector popup은 clipping ancestor 밖에 렌더링되어야 하고(MUST), input의 현재 viewport 위치에 따라 위 또는 아래의 가용 공간에 배치되어야 한다(MUST). Popup은 선택한 방향의 viewport 공간을 넘지 않는 높이로 내부 스크롤을 제공해야 하며(MUST), popup 이동이 canonical option, highlight, keyboard commit과 ARIA 관계를 변경해서는 안 된다(MUST NOT).

#### Scenario: viewport 하단의 selector
- **WHEN** 사용자가 viewport 하단 또는 overflow-hidden panel 하단의 searchable selector를 연다
- **THEN** popup은 input 위쪽으로 배치되고 ancestor 경계에 잘리지 않아야 한다
- **AND** 모든 option은 popup 내부 스크롤로 탐색·선택할 수 있어야 한다

#### Scenario: 열린 popup 중 문서 스크롤
- **WHEN** popup이 열린 상태에서 viewport 크기 또는 ancestor scroll 위치가 바뀐다
- **THEN** popup은 현재 input rect에 맞춰 위치와 가용 높이를 다시 계산해야 한다
- **AND** 현재 query, highlight와 selection을 유지해야 한다
