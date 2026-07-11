## MODIFIED Requirements

### Requirement: 상태별 frame 조립
sampler는 상태 계약의 row와 frame 수에 따라 57개 표준 상태 frame을 렌더링하고(MUST), rows 9–10에 각각 8개의 look frame을 추가해 총 73개 사용 cell을 8열×11행 atlas의 정확한 위치에 기록해야 한다(MUST). 표준 상태 cell의 최종 수평 반전은 전체 `globalMirrorX`와 해당 상태의 `mirrorX`를 XOR로 합성해야 하며(MUST), source time 순서를 바꾸어서는 안 된다(MUST NOT). 전체 반전이 활성화되어도 look rows의 16방향 의미는 설치된 Pet의 pointer 방향과 일치해야 한다(MUST).

#### Scenario: 표준 상태별 frame 수
- **WHEN** 유효한 9개 상태 매핑을 export한다
- **THEN** rows 0–8의 사용 cell 수는 6, 8, 8, 4, 5, 8, 6, 6, 6이고 합계는 57이다

#### Scenario: look frame 수
- **WHEN** 검증된 눈 rig으로 v2 look frame을 export한다
- **THEN** rows 9–10은 각각 8개 cell을 모두 사용하고 표준 frame을 포함한 전체 사용 cell 수는 73이다

#### Scenario: 전체와 상태별 반전 합성
- **WHEN** 특정 상태에 대해 `globalMirrorX`와 `mirrorX` 조합을 계산한다
- **THEN** 둘 중 정확히 하나만 활성화된 경우에만 최종 cell을 수평 반전해야 한다
- **AND** 둘 다 활성화되거나 둘 다 비활성화된 경우 최종 cell을 추가 반전하지 않아야 한다

#### Scenario: running 방향 독립 반전
- **WHEN** `running-right`와 `running-left`가 같은 source animation을 사용하지만 서로 다른 `mirrorX` 값을 가진다
- **THEN** sampler는 각 row에 전체 반전과 해당 row의 상태별 반전을 독립적으로 합성해야 한다
- **AND** 두 row 모두 source frame 순서를 유지해야 한다

#### Scenario: 전체 반전 시 look 의미 보존
- **WHEN** `globalMirrorX`가 활성화된 상태로 16개 look frame을 생성한다
- **THEN** sampler는 수평 look vector 또는 대응 slot을 보정해 각 cell이 기존과 같은 pointer 방향을 의미하게 해야 한다
- **AND** 위·아래 방향 및 rows 9–10의 16방향 index 계약을 유지해야 한다

#### Scenario: 표준 row의 미사용 cell
- **WHEN** rows 0–8의 사용 frame 수가 8보다 작다
- **THEN** 나머지 cell 전체는 RGBA 값이 0인 완전 투명 pixel로 남아야 한다

### Requirement: preview와 export의 시선 변환 일치
실시간 Spine preview와 16방향 look frame sampler는 동일한 눈 이동 pixel radius, projection-to-world 및 eye parent world-to-local 변환을 사용해야 한다(MUST). preview는 포인터 중심 기준 벡터와 현재 눈 이동량을 animation pose 적용 후 `eye_scale` bone에 합성해야 하며(MUST), frame 간 offset을 누적해서는 안 된다(MUST NOT). 포인터가 preview를 벗어나면 eye bone을 현재 animation pose의 원위치로 복원해야 한다(MUST).

#### Scenario: 포인터를 따른 실제 Spine 눈 이동
- **WHEN** 사용자가 활성 Spine preview 위에서 포인터를 중심에서 오른쪽 위로 이동한다
- **THEN** preview는 현재 animation을 계속 재생하면서 `eye_scale` bone을 같은 방향으로 이동해야 한다
- **AND** 이동 반경은 현재 눈 이동량 slider와 export look frame 계산을 사용해야 한다

#### Scenario: 포인터 이탈 시 복원
- **WHEN** 포인터가 preview canvas를 벗어나거나 입력이 취소된다
- **THEN** session은 이전 look offset을 제거해야 한다
- **AND** eye bone은 animation이 정의한 현재 pose로 복원되어야 한다

#### Scenario: 연속 frame에서 offset 비누적
- **WHEN** 같은 포인터 target으로 여러 animation frame을 렌더링한다
- **THEN** 각 frame은 이전 look offset을 제거한 animation pose에서 새 offset을 계산해야 한다
- **AND** 시간 경과에 따라 눈 이동량이 증가해서는 안 된다
