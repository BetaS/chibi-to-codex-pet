# Codex Pet look 방향 렌더링 명세

## Purpose

LiveSD 눈 rig에서 Codex Pet v2의 16방향 look frame을 만들고 pointer 방향에 맞는 cell을 선택한다. 같은 입력과 눈 이동량은 browser preview와 package에서 같은 시선 결과를 만든다.

## Requirements

### Requirement: LiveSD 눈 rig 검증
시스템은 look frame을 렌더링하기 전에 스켈레톤의 `eye_scale` bone과 해당 bone에 연결된 표시 가능한 눈 attachment region 두 개 이상을 확인해야 한다(MUST). 검증된 bone과 atlas region만 look rig의 입력으로 사용해야 한다(MUST).

#### Scenario: 검증된 PRSK 눈 rig
- **WHEN** 눈 region 두 개 이상을 가진 PRSK atlas와 공통 스켈레톤을 로드한다
- **THEN** 시스템은 `eye_scale`과 실제 pixel 크기가 1×1보다 큰 눈 region 두 개 이상을 look rig로 확정한다

#### Scenario: look rig 누락
- **WHEN** `eye_scale`가 없거나 표시 가능한 눈 region이 두 개 미만이다
- **THEN** 시스템은 빈 frame이나 중립 frame을 생성하지 않고 `LOOK_RIG_MISSING`으로 export를 차단한다

### Requirement: atlas 기반 16방향 look pose
시스템은 idle에 선택된 원본 animation의 `time=0` pose에 매 방향마다 독립적으로 되돌아가야 하며(MUST), animation apply 후 `eye_scale` bone에 final cell pixel로 정의된 타원형 world 이동을 parent matrix의 역변환으로 적용해야 한다(MUST). 사용자가 선택하는 단일 `lookMovementScale`은 `0.50–1.50`, 기본 `1.00`이어야 하며(MUST), 가로·세로 반경에 동일하게 적용해 방향 타원의 비율을 보존해야 한다(MUST). 전체 sprite를 회전·기울이거나 새 눈 pixel을 그려서는 안 된다(MUST NOT).

#### Scenario: 시계 방향 순서
- **WHEN** 16개 look pose plan을 만든다
- **THEN** row 9에 `000`부터 `157.5`까지, row 10에 `180`부터 `337.5`까지를 22.5도 간격의 시계 방향으로 각각 8개씩 배치한다

#### Scenario: 방향별 눈 이동
- **WHEN** 방향 각도가 `d`인 look pose를 적용한다
- **THEN** 시스템은 canonical projection으로 환산한 가로 `2px * lookMovementScale`·세로 `1.5px * lookMovementScale` 반경의 world 이동을 `sin(d)`·`cos(d)`에 비례해 계산하고 `eye_scale` parent matrix의 역행렬로 local 좌표에 변환한다

#### Scenario: 기본 및 경계 눈 이동량
- **WHEN** 사용자가 눈 이동량을 각각 50%, 100%, 150%로 선택한다
- **THEN** cardinal look의 가로·세로 이동은 기본 100% 결과 대비 각각 0.5배, 1배, 1.5배이며 같은 방향과 타원 비율을 유지한다

#### Scenario: 회전된 head 좌표계
- **WHEN** `eye_scale` parent의 local 축이 화면 축과 다르게 회전되어 있다
- **THEN** 시스템은 요청한 화면 world 방향을 parent 2×2 matrix의 역행렬로 변환해 최종 눈 이동 방향이 시계 방향 계약과 일치하게 한다

#### Scenario: 특이 parent matrix
- **WHEN** parent 2×2 matrix의 determinant가 안전한 역변환 범위보다 작다
- **THEN** 시스템은 잘못된 방향 frame을 생성하지 않고 안정적인 look rig 오류로 export를 차단한다

#### Scenario: 독립적인 출발 pose
- **WHEN** 연속한 두 look frame을 샘플링한다
- **THEN** 두 frame은 이전 방향의 bone 변형을 누적하지 않고 같은 setup pose와 idle `time=0`에서 시작한다

### Requirement: Codex 방향 선택과 dead zone
웹 installed preview는 Pet 중심에서 pointer로의 방향을 `atan2(dx, -dy)`로 계산하고(MUST), 가장 가까운 22.5도의 16방향 frame을 표시해야 한다(MUST). pointer가 중심 1px 이내이거나 stage를 나가면 look frame을 제거해야 한다(MUST).

#### Scenario: 카디널 pointer
- **WHEN** pointer가 Pet 중심의 위, 오른쪽, 아래 또는 왼쪽에 있다
- **THEN** preview는 각각 direction index `0`, `4`, `8`, `12`의 전체 frame을 표시한다

#### Scenario: dead zone 및 pointer leave
- **WHEN** pointer가 Pet 중심 1px 이내로 이동하거나 preview stage를 나간다
- **THEN** preview는 look frame을 제거하고 hover를 포함한 현재 표준 상태 animation으로 복귀한다

### Requirement: look 방향 QA 계약
시스템은 16개 look cell의 가시 pixel, 연속 방향 간 pixel 차이와 카디널 pointer 선택을 검증해야 한다(MUST).

#### Scenario: 전체 look cell
- **WHEN** 검증된 눈 rig으로 만든 v2 package를 검사한다
- **THEN** rows 9–10의 16개 cell은 모두 표시 pixel을 가지고 적어도 두 개 카디널 쌍은 서로 다른 렌더링 pixel을 가진다

#### Scenario: 시각 방향 확인
- **WHEN** 지원 범위의 눈 이동량으로 만든 neutral과 `000`, `090`, `180`, `270` cell을 함께 검토한다
- **THEN** 눈 전체의 위·오른쪽·아래·왼쪽 이동이 얼굴 외곽을 파괴하지 않고 구분된다
