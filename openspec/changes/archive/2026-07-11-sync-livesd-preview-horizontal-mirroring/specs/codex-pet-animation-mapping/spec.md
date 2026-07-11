## ADDED Requirements

### Requirement: Mapping mirror의 실시간 LiveSD preview

웹 UI는 전체 수평 반전과 활성 Codex Pet 상태의 `mirrorX`를 export와 동일한 XOR 규칙으로 합성해 현재 LiveSD preview session에 적용해야 한다(MUST). 상태 shortcut, mapping select focus·변경과 상태별 mirror checkbox 변경은 해당 상태의 animation과 합성 반전을 함께 preview해야 하며(MUST), 전체 반전 checkbox 변경은 현재 활성 상태를 유지한 채 합성 방향을 즉시 갱신해야 한다(MUST). 직접 animation combobox는 상태 선택을 해제하되 전체 반전만 preview에 유지해야 한다(MUST).

#### Scenario: 기본 PRSK 오른쪽 이동 상태
- **WHEN** 전체 반전이 꺼져 있고 기본 `running-right.mirrorX`가 켜진 상태에서 오른쪽 이동 shortcut을 누른다
- **THEN** 기존 LiveSD session은 오른쪽 이동 animation을 재생하고 수평 반전된다
- **AND** mapping과 package 결과는 변경되지 않는다

#### Scenario: 전체와 상태 반전 XOR
- **WHEN** 활성 상태의 `mirrorX`와 전체 반전이 모두 켜져 있다
- **THEN** LiveSD preview의 최종 수평 반전은 꺼진다
- **AND** 둘 중 하나만 켜져 있으면 최종 수평 반전은 켜진다

#### Scenario: 상태별 mirror checkbox 변경
- **WHEN** 사용자가 오른쪽 또는 왼쪽 이동 row의 mirror checkbox를 변경한다
- **THEN** 해당 row가 현재 상태 preview로 선택된다
- **AND** 새 XOR 결과와 현재 mapping animation이 같은 session에 즉시 적용된다

#### Scenario: 직접 animation 선택
- **WHEN** 상태 반전 preview 뒤 direct animation combobox에서 animation을 선택한다
- **THEN** 상태 shortcut 선택은 해제된다
- **AND** preview는 상태별 mirror를 제외하고 현재 전체 반전만 적용한다

#### Scenario: source와 locale lifecycle
- **WHEN** locale만 바뀐다
- **THEN** 전체·상태별 반전과 현재 preview 방향은 보존된다
- **WHEN** 다른 source가 성공적으로 ready가 된다
- **THEN** 이전 상태 선택과 preview 반전은 새 source 기본값으로 초기화된다
