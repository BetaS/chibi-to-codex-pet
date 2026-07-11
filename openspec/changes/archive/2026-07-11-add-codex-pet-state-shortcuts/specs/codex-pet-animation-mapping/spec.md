## MODIFIED Requirements

### Requirement: 상태별 실시간 Spine preview
웹 UI는 상태 매핑을 확인할 때 생성된 sprite 또는 정적 thumbnail 대신 현재 활성 Spine preview session에서 그 상태의 실제 source animation을 재생해야 한다(MUST). Preview toolbar는 9개 표준 상태를 계약 순서로 나타내는 명시적인 아이콘 바로가기 group을 제공해야 하며(MUST), 각 바로가기는 현재 mapping의 animation을 같은 활성 Spine session에서 재생해야 한다(MUST). 상태 select가 focus되면 현재 매핑을 재생하고(MUST), 유효한 새 animation을 선택하면 새 값을 즉시 재생해야 한다(MUST). 직접 animation combobox도 계속 사용할 수 있어야 하며(MUST), 이 모든 preview 동작은 mapping, mirror, package, export 또는 network 상태를 추가로 변경해서는 안 된다(MUST NOT).

#### Scenario: 현재 상태 매핑 확인
- **WHEN** 사용자가 상태 row의 animation select에 focus한다
- **THEN** 현재 활성 Spine preview session은 그 row에 매핑된 source animation을 재생해야 한다
- **AND** 해당 상태 바로가기만 현재 선택 상태로 표시되어야 한다
- **AND** 다른 상태의 mapping은 변경되지 않아야 한다

#### Scenario: 상태 animation 변경 직후 확인
- **WHEN** 사용자가 상태 row에서 다른 유효 animation을 선택한다
- **THEN** UI는 mapping을 갱신하고 같은 Spine preview session에서 선택한 animation을 즉시 재생해야 한다
- **AND** 해당 상태 바로가기는 갱신된 animation을 사용해야 한다
- **AND** 별도의 preview renderer 또는 spritesheet를 생성하지 않아야 한다

#### Scenario: 상태 아이콘 바로가기
- **WHEN** ready source에서 사용자가 9개 상태 중 하나의 바로가기 icon을 활성화한다
- **THEN** 시스템은 해당 상태의 현재 mapping animation을 기존 session에서 재생해야 한다
- **AND** 활성화한 button만 `aria-pressed` 선택 상태를 가져야 한다
- **AND** mapping, mirror, metadata와 기존 package 결과를 변경해서는 안 된다

#### Scenario: 직접 animation 선택과 공존
- **WHEN** 사용자가 상태 바로가기 재생 뒤 직접 animation combobox에서 다른 실제 animation을 선택한다
- **THEN** 시스템은 직접 선택한 animation을 같은 session에서 재생해야 한다
- **AND** 상태 바로가기의 현재 선택 상태를 해제해야 한다
- **AND** 9개 상태 mapping은 유지되어야 한다

#### Scenario: 준비되지 않은 preview
- **WHEN** active preview 또는 유효한 9개 상태 mapping이 없다
- **THEN** 모든 상태 바로가기 button은 비활성화되어야 한다
- **AND** 활성화 시도로 session, request 또는 build를 시작해서는 안 된다

#### Scenario: source 교체
- **WHEN** 다른 source가 성공적으로 ready가 된다
- **THEN** 이전 상태 선택을 해제하고 새 source의 추천 mapping으로 9개 바로가기를 갱신해야 한다

#### Scenario: 상태 바로가기 무네트워크 재생
- **WHEN** 사용자가 여러 상태 바로가기를 연속으로 활성화한다
- **THEN** 각 동작은 현재 session의 `play()`만 호출해야 한다
- **AND** catalog, model, adapter 또는 export 작업을 새로 시작해서는 안 된다

#### Scenario: 모바일 상태 바로가기 배치
- **WHEN** 폭 36rem 이하의 모바일 viewport에서 preview toolbar를 표시한다
- **THEN** 9개 상태 바로가기는 toolbar content box 안의 3×3 grid로 배치되어야 한다
- **AND** shortcut group, button 또는 toolbar가 viewport 방향으로 가로 overflow해서는 안 된다
- **AND** 다른 preview control과 겹치거나 별도 flex column으로 밀려나서는 안 된다
