## MODIFIED Requirements

### Requirement: 좌우 이동 매핑
시스템은 `running-right`와 `running-left`가 같은 source animation을 사용할 수 있게 해야 하며(MUST), 두 상태 각각에 frame 순서를 바꾸지 않는 독립적인 `mirrorX` 선택을 제공해야 한다(MUST). PRSK integration의 초기 추천은 `running-right`에만 추가 `mirrorX`를 설정하고 `running-left`에는 설정하지 않아야 한다(MUST). `_b` suffix의 back-facing animation을 left-facing 의미로 간주해서는 안 된다(MUST NOT).

#### Scenario: 좌우 공통 walk source
- **WHEN** 목록에 front walk animation은 있지만 별도 left walk animation은 없다
- **THEN** 시스템은 양쪽 row에 같은 source 이름을 추천해야 한다
- **AND** PRSK source에서는 `running-right`의 상태별 `mirrorX`만 활성화하고 `running-left`의 상태별 `mirrorX`는 비활성화해야 한다

#### Scenario: right와 left 독립 반전
- **WHEN** 사용자가 `running-right` 또는 `running-left`의 수평 반전 설정을 변경한다
- **THEN** 시스템은 선택한 방향의 `mirrorX`만 변경해야 한다
- **AND** 반대 방향의 animation 및 `mirrorX` 선택을 유지해야 한다

#### Scenario: 방향별 전용 animation 선택
- **WHEN** 사용자가 `running-right` 또는 `running-left`에 다른 유효 animation을 선택한다
- **THEN** 시스템은 각 방향의 선택값과 독립적인 `mirrorX` 설정을 보존해야 한다

### Requirement: 사용자 매핑 확인과 수정
웹 UI는 ready source의 9개 상태와 현재 추천 animation을 모두 표시하고(MUST), 각 상태를 현재 스켈레톤의 실제 animation 중 하나로 변경할 수 있게 해야 한다(MUST). PRSK source에서는 전체 캐릭터 수평 반전과 `running-right`, `running-left` 각각의 추가 수평 반전을 표시하고 수정할 수 있어야 한다(MUST). source가 교체되면 이전 source에만 존재하는 선택 또는 방향 설정을 유지해서는 안 되며(MUST NOT), 새 목록과 source 기본 facing으로 추천을 다시 계산해야 한다(MUST).

#### Scenario: 상태 매핑 표시
- **WHEN** PRSK LiveSD preview가 ready가 된다
- **THEN** UI는 9개 상태, 한국어 목적 설명, 추천 animation, 전체 수평 반전과 좌·우 이동의 개별 수평 반전 여부를 표시해야 한다

#### Scenario: 유효한 override
- **WHEN** 사용자가 상태 select에서 다른 실제 animation을 선택한다
- **THEN** 해당 상태만 새 값으로 갱신되고 다른 상태의 선택과 방향 설정은 유지되어야 한다
- **AND** 현재 Spine preview session은 새로 선택한 실제 animation을 즉시 재생해야 한다

#### Scenario: source 교체
- **WHEN** 다른 스켈레톤의 preview가 성공적으로 활성화된다
- **THEN** 시스템은 새 animation 목록과 source 기본 facing만 사용해 전체 추천과 방향 설정을 다시 계산해야 한다

#### Scenario: sd_21miku_normal negi override
- **WHEN** `sd_21miku_normal`을 package로 생성하기 전에 사용자가 idle을 `z_test_F_negi01`로, `jumping` 마우스 오버를 `w_happy_surprise01_f`로 선택한다
- **THEN** exporter는 해당 두 override와 현재 전체·좌·우 반전 설정을 보존하고 나머지 상태 매핑은 Airi 검증과 동일하게 유지해야 한다

### Requirement: 상태별 실시간 Spine preview
웹 UI는 상태 매핑을 확인할 때 생성된 sprite 또는 정적 thumbnail 대신 현재 활성 Spine preview session에서 그 상태의 실제 source animation을 재생해야 한다(MUST). 상태 select가 focus되면 현재 매핑을 재생하고(MUST), 유효한 새 animation을 선택하면 새 값을 즉시 재생해야 한다(MUST). 이 동작은 mapping이나 package를 추가로 변경해서는 안 된다(MUST NOT).

#### Scenario: 현재 상태 매핑 확인
- **WHEN** 사용자가 상태 row의 animation select에 focus한다
- **THEN** 현재 활성 Spine preview session은 그 row에 매핑된 source animation을 재생해야 한다
- **AND** 다른 상태의 mapping은 변경되지 않아야 한다

#### Scenario: 상태 animation 변경 직후 확인
- **WHEN** 사용자가 상태 row에서 다른 유효 animation을 선택한다
- **THEN** UI는 mapping을 갱신하고 같은 Spine preview session에서 선택한 animation을 즉시 재생해야 한다
- **AND** 별도의 preview renderer 또는 spritesheet를 생성하지 않아야 한다
