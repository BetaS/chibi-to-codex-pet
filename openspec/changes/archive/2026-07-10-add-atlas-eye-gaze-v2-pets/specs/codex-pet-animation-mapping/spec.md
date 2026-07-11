## MODIFIED Requirements

### Requirement: 표준 Codex Pet 상태 계약
시스템은 Codex Pet v2의 표준 상태 rows 0–8을 `idle`, `running-right`, `running-left`, `waving`, `jumping`, `failed`, `waiting`, `running`, `review` 순서로 정의하고(MUST), 각 상태의 row index, 사용 frame 수와 재생 duration을 단일 runtime 독립 계약으로 제공해야 한다(MUST). rows 9–10의 16방향 look frame을 표준 상태 mapping 대상으로 취급해서는 안 된다(MUST NOT).

#### Scenario: 표준 상태 계약 조회
- **WHEN** exporter와 installed preview가 표준 상태 계약을 조회한다
- **THEN** 두 구성 요소는 동일한 rows 0–8의 9개 row 순서, frame 수와 duration을 사용한다

#### Scenario: 표준 row의 미사용 cell 계산
- **WHEN** frame 수가 8보다 작은 rows 0–8의 표준 상태 row를 계산한다
- **THEN** 마지막 사용 frame 뒤부터 7번 column까지를 미사용 cell로 식별한다

#### Scenario: Pet 마우스 오버 표준 상태
- **WHEN** 일반 pointer가 Pet 위로 진입하고 v2 look cursor가 활성화되지 않는다
- **THEN** renderer는 표준 `jumping` row 4를 임시로 재생하고 pointer가 나가면 이전 상태로 복귀한다

#### Scenario: look row 분리
- **WHEN** v2 pointer look이 활성화된다
- **THEN** renderer는 9개 표준 상태 mapping을 변경하지 않고 rows 9–10의 정적 look frame을 우선 표시한다
