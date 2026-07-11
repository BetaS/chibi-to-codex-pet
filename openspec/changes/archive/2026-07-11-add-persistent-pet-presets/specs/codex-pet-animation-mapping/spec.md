## MODIFIED Requirements

### Requirement: 사용자 매핑 확인과 수정
웹 UI는 ready source의 9개 상태와 현재 추천 animation을 모두 표시하고(MUST), 각 상태를 현재 스켈레톤의 실제 animation 중 하나로 검색해 변경할 수 있는 accessible combobox를 제공해야 한다(MUST). 상태 label과 목적 설명, 검색 label·placeholder·빈 결과 문구는 현재 locale로 표시해야 한다(MUST). combobox는 현재 session의 실제 animation만 원래 순서로 제공하고(MUST), 대소문자를 구분하지 않는 local substring 검색을 지원해야 한다(MUST). query 입력, option highlight 또는 빈 검색 결과만으로 mapping을 변경해서는 안 되며(MUST NOT), 실제 option을 확정할 때만 해당 상태를 변경해야 한다(MUST). PRSK source에서는 전체 캐릭터 수평 반전과 `running-right`, `running-left` 각각의 추가 수평 반전을 표시하고 수정할 수 있어야 한다(MUST). source가 교체되면 이전 source에만 존재하는 선택, 검색 query 또는 방향 설정을 유지해서는 안 되며(MUST NOT), 새 목록과 source 기본 facing으로 추천을 다시 계산해야 한다(MUST).

#### Scenario: 상태 매핑 표시
- **WHEN** PRSK LiveSD preview가 ready가 된다
- **THEN** UI는 현재 locale의 9개 상태 label과 목적 설명, 추천 animation, 전체 수평 반전과 좌·우 이동의 개별 수평 반전 여부를 표시해야 한다
- **AND** 각 상태 combobox는 현재 source의 실제 animation만 검색할 수 있어야 한다

#### Scenario: locale 변경
- **WHEN** 사용자가 mapping을 수정한 뒤 locale을 변경한다
- **THEN** 상태 label과 목적 설명, 검색 UI 문구만 새 locale로 변경되어야 한다
- **AND** 상태 ID, animation, mirror, 현재 query와 preview 재생은 유지되어야 한다

#### Scenario: 검색 중 mapping 보존
- **WHEN** 사용자가 상태 combobox에 substring query를 입력하거나 keyboard로 option을 highlight한다
- **THEN** listbox는 일치하는 실제 animation만 원래 순서로 표시해야 한다
- **AND** 사용자가 실제 option을 확정하기 전까지 mapping과 preview animation은 변경되지 않아야 한다

#### Scenario: 유효한 override
- **WHEN** 사용자가 상태 combobox에서 다른 실제 animation을 확정한다
- **THEN** 해당 상태만 새 값으로 갱신되고 다른 상태의 선택과 방향 설정은 유지되어야 한다
- **AND** 현재 Spine preview session은 새로 선택한 실제 animation을 즉시 재생해야 한다

#### Scenario: source 교체
- **WHEN** 다른 스켈레톤의 preview가 성공적으로 활성화된다
- **THEN** 시스템은 새 animation 목록과 source 기본 facing만 사용해 전체 추천과 방향 설정을 다시 계산해야 한다
- **AND** 이전 source의 상태별 검색 query를 비워야 한다

#### Scenario: preset 적용 후 검색 reset
- **WHEN** 사용자가 다른 저장 preset 또는 `새 세션`을 선택한다
- **THEN** 시스템은 검증된 mapping을 적용하고 모든 상태 combobox query를 비워야 한다

#### Scenario: sd_21miku_normal negi override
- **WHEN** `sd_21miku_normal`을 package로 생성하기 전에 사용자가 idle을 `z_test_F_negi01`로, `jumping` 상태를 `w_happy_surprise01_f`로 선택한다
- **THEN** exporter는 해당 두 override와 현재 전체·좌·우 반전 설정을 보존하고 나머지 상태 매핑은 Airi 검증과 동일하게 유지해야 한다

### Requirement: 상태별 실시간 Spine preview
웹 UI는 상태 매핑을 확인할 때 생성된 sprite 또는 정적 thumbnail 대신 현재 활성 Spine preview session에서 그 상태의 실제 source animation을 재생해야 한다(MUST). 상태 animation combobox가 focus되면 현재 매핑을 재생하고(MUST), 유효한 새 animation option을 확정하면 새 값을 즉시 재생해야 한다(MUST). 검색 query 입력, option highlight와 결과 없음은 preview를 바꾸어서는 안 된다(MUST NOT). 이 동작은 명시적 option 확정 외의 mapping이나 package를 추가로 변경해서는 안 된다(MUST NOT).

#### Scenario: 현재 상태 매핑 확인
- **WHEN** 사용자가 상태 row의 animation combobox에 focus한다
- **THEN** 현재 활성 Spine preview session은 그 row에 매핑된 source animation을 재생해야 한다
- **AND** 다른 상태의 mapping은 변경되지 않아야 한다

#### Scenario: 상태 animation 변경 직후 확인
- **WHEN** 사용자가 상태 row에서 다른 유효 animation option을 확정한다
- **THEN** UI는 mapping을 갱신하고 같은 Spine preview session에서 선택한 animation을 즉시 재생해야 한다
- **AND** 별도의 preview renderer 또는 spritesheet를 생성하지 않아야 한다

#### Scenario: 검색만 수행
- **WHEN** 사용자가 현재 상태 combobox에서 query를 입력하고 option을 확정하지 않는다
- **THEN** 현재 Spine preview animation과 package mapping은 그대로 유지되어야 한다
