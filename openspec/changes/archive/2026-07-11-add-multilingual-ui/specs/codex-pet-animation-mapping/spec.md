## MODIFIED Requirements

### Requirement: 사용자 매핑 확인과 수정
웹 UI는 ready source의 9개 상태와 현재 추천 animation을 모두 표시하고(MUST), 각 상태를 현재 스켈레톤의 실제 animation 중 하나로 변경할 수 있게 해야 한다(MUST). 상태 label과 목적 설명은 현재 locale로 표시해야 한다(MUST). PRSK source에서는 전체 캐릭터 수평 반전과 `running-right`, `running-left` 각각의 추가 수평 반전을 표시하고 수정할 수 있어야 한다(MUST). source가 교체되면 이전 source에만 존재하는 선택 또는 방향 설정을 유지해서는 안 되며(MUST NOT), 새 목록과 source 기본 facing으로 추천을 다시 계산해야 한다(MUST).

#### Scenario: 상태 매핑 표시
- **WHEN** PRSK LiveSD preview가 ready가 된다
- **THEN** UI는 현재 locale의 9개 상태 label과 목적 설명, 추천 animation, 전체 수평 반전과 좌·우 이동의 개별 수평 반전 여부를 표시해야 한다

#### Scenario: locale 변경
- **WHEN** 사용자가 mapping을 수정한 뒤 locale을 변경한다
- **THEN** 상태 label과 목적 설명만 새 locale로 변경되어야 한다
- **AND** 상태 ID, animation, mirror와 현재 preview 재생은 유지되어야 한다

#### Scenario: 유효한 override
- **WHEN** 사용자가 상태 select에서 다른 실제 animation을 선택한다
- **THEN** 해당 상태만 새 값으로 갱신되고 다른 상태의 선택과 방향 설정은 유지되어야 한다
- **AND** 현재 Spine preview session은 새로 선택한 실제 animation을 즉시 재생해야 한다

#### Scenario: source 교체
- **WHEN** 다른 스켈레톤의 preview가 성공적으로 활성화된다
- **THEN** 시스템은 새 animation 목록과 source 기본 facing만 사용해 전체 추천과 방향 설정을 다시 계산해야 한다

#### Scenario: sd_21miku_normal negi override
- **WHEN** `sd_21miku_normal`을 package로 생성하기 전에 사용자가 idle을 `z_test_F_negi01`로, `jumping` 상태를 `w_happy_surprise01_f`로 선택한다
- **THEN** exporter는 해당 두 override와 현재 전체·좌·우 반전 설정을 보존하고 나머지 상태 매핑은 Airi 검증과 동일하게 유지해야 한다
