## ADDED Requirements

### Requirement: 표준 Codex Pet 상태 계약
시스템은 Codex Pet v1의 상태를 `idle`, `running-right`, `running-left`, `waving`, `jumping`, `failed`, `waiting`, `running`, `review` 순서로 정의하고(MUST), 각 상태의 row index, 사용 frame 수와 재생 duration을 단일 runtime 독립 계약으로 제공해야 한다(MUST).

#### Scenario: 상태 계약 조회
- **WHEN** exporter와 installed preview가 상태 계약을 조회한다
- **THEN** 두 구성 요소는 동일한 9개 row 순서, frame 수와 duration을 사용한다

#### Scenario: 미사용 셀 계산
- **WHEN** frame 수가 8보다 작은 상태의 row를 계산한다
- **THEN** 마지막 사용 frame 뒤부터 7번 column까지를 미사용 셀로 식별한다

### Requirement: animation 자동 추천
시스템은 ready 스켈레톤이 제공한 실제 animation 이름만 대상으로 정규화된 이름 token과 상태별 우선순위를 사용해 9개 상태의 초기 매핑을 결정해야 한다(MUST). 직접 의미 이름이 없으면 문서화된 emotion/action fallback을 적용하고(MUST), 후보가 없는 상태도 실제 목록 안의 안전한 fallback animation을 가져야 한다(MUST).

#### Scenario: 직접 이름이 있는 animation
- **WHEN** animation 목록에 상태 이름과 직접 일치하거나 더 높은 우선순위의 action 이름이 있다
- **THEN** 시스템은 일반적인 fallback보다 직접 후보를 추천한다

#### Scenario: 의미 기반 fallback
- **WHEN** `wave`나 `jump`라는 직접 이름은 없지만 `joy`나 `surprise` 후보가 있다
- **THEN** 시스템은 각각 waving과 jumping의 문서화된 fallback 우선순위에 따라 실제 animation을 추천한다

#### Scenario: 후보가 부족함
- **WHEN** 어떤 상태의 token 후보도 animation 목록에 없다
- **THEN** 시스템은 `pose_default`, idle 추천값, 목록의 첫 animation 순으로 실제 존재하는 fallback을 선택한다

#### Scenario: animation 목록이 비어 있음
- **WHEN** animation 목록이 비어 있다
- **THEN** 시스템은 완성된 매핑을 만들지 않고 `ANIMATION_MISSING`으로 export를 차단한다

### Requirement: 좌우 이동 매핑
시스템은 `running-right`와 `running-left`가 같은 source animation을 사용할 수 있게 해야 하며(MUST), 자동 추천된 `running-left`에는 frame 순서를 바꾸지 않는 `mirrorX` 변환을 명시해야 한다(MUST). `_b` suffix의 back-facing animation을 left-facing 의미로 간주해서는 안 된다(MUST NOT).

#### Scenario: 좌우 공통 walk source
- **WHEN** 목록에 front walk animation은 있지만 별도 left walk animation은 없다
- **THEN** 시스템은 양쪽 row에 같은 source 이름을 추천하고 `running-left`에만 `mirrorX`를 설정한다

#### Scenario: left 전용 animation 선택
- **WHEN** 사용자가 `running-left`에 다른 유효 animation을 선택한다
- **THEN** 시스템은 선택값을 보존하고 사용자가 mirror 설정을 명시적으로 변경할 수 있게 한다

### Requirement: 사용자 매핑 확인과 수정
웹 UI는 ready source의 9개 상태와 현재 추천 animation을 모두 표시하고(MUST), 각 상태를 현재 스켈레톤의 실제 animation 중 하나로 변경할 수 있게 해야 한다(MUST). source가 교체되면 이전 source에만 존재하는 선택을 유지해서는 안 되며(MUST NOT), 새 목록으로 추천을 다시 계산해야 한다(MUST).

#### Scenario: 상태 매핑 표시
- **WHEN** LiveSD preview가 ready가 된다
- **THEN** UI는 9개 상태, 한국어 목적 설명, 추천 animation과 좌우 mirror 여부를 표시한다

#### Scenario: 유효한 override
- **WHEN** 사용자가 상태 select에서 다른 실제 animation을 선택한다
- **THEN** 해당 상태만 새 값으로 갱신되고 다른 상태의 선택과 현재 preview 재생은 유지된다

#### Scenario: source 교체
- **WHEN** 다른 스켈레톤의 preview가 성공적으로 활성화된다
- **THEN** 시스템은 새 animation 목록만 사용해 전체 추천을 다시 계산한다

### Requirement: Airi 기본 매핑 회귀 계약
공통 PRSK 스켈레톤과 `sd_07airi_normal`을 사용하는 검증에서는 실제 167개 animation 목록으로 source 의미에 맞는 여성형 후보를 우선 추천해야 한다(MUST).

#### Scenario: sd_07airi_normal 추천
- **WHEN** 실제 Airi source의 animation 목록을 자동 매핑한다
- **THEN** `w_happy_idle01_f`, `w_normal_walk01_f`, `w_cute_joy01_f`, `w_happy_surprise01_f`, `w_happy_sad01_f`, `w_happy_listen01_f`, `w_happy_doubt01_f`, `w_happy_doubt02_f`가 설계된 상태에 매핑되고 left walk만 mirror된다
