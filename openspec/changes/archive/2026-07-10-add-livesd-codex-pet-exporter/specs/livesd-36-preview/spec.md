## ADDED Requirements

### Requirement: 활성 source의 export handoff
앱은 첫 WebGL frame까지 성공해 ready가 된 preview의 runtime 독립 `LiveSDAtlasBundle`과 원본 스켈레톤 `ArrayBuffer`를 active export source로 함께 보존해야 한다(MUST). 새 source의 preview 활성화가 성공할 때 session과 export source를 원자적으로 교체해야 하며(MUST), loading 또는 실패한 source를 exporter에 전달해서는 안 된다(MUST NOT).

#### Scenario: 첫 ready source
- **WHEN** local 또는 remote source가 첫 frame까지 렌더링해 ready가 된다
- **THEN** 상태 매핑과 exporter는 같은 source의 atlas bundle, skeleton bytes와 animation 목록을 받는다

#### Scenario: source 교체 성공
- **WHEN** 기존 ready source가 있는 상태에서 새 source preview가 ready가 된다
- **THEN** 앱은 기존 session과 export source를 함께 새 source로 교체하고 새 animation 추천을 계산한다

#### Scenario: source 교체 실패
- **WHEN** 새 source의 importer, runtime parse 또는 첫 frame render가 실패한다
- **THEN** 실패한 source는 exporter에 노출되지 않고 기존 ready session과 export source는 유지된다

#### Scenario: ready 이후 render 실패
- **WHEN** 활성 preview session이 후속 frame에서 실패해 dispose된다
- **THEN** 앱은 해당 session과 연결된 export source를 제거하고 package 생성을 비활성화한다

#### Scenario: UI unmount
- **WHEN** 앱이 unmount된다
- **THEN** 활성 session, export source와 진행 중 export를 정리한다
