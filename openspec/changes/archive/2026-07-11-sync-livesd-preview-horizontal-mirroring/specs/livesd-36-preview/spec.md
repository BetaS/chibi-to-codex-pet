## ADDED Requirements

### Requirement: Runtime 수평 반전 preview

`LiveSDPreviewSession`은 현재 animation pose, alpha-calibrated bounds, framing scale과 canvas 크기를 유지하면서 전체 렌더를 bounds 중심 기준으로 수평 반전할 수 있어야 한다(MUST). 반전은 projection에서 수행하고(MUST), skeleton bone·attachment geometry·draw order를 변경해서는 안 된다(MUST NOT). 반전 변경은 새 session, animation restart, alpha recalibration 또는 network request 없이 현재 pose에 즉시 다시 그려져야 한다(MUST).

#### Scenario: 반전 활성화와 해제
- **WHEN** ready session에서 수평 반전을 활성화한 뒤 해제한다
- **THEN** projection은 각각 같은 중심의 negative width와 원래 positive width를 사용한다
- **AND** animation, framing scale과 session identity는 유지된다

#### Scenario: 비대칭 캐릭터 실제 pixel
- **WHEN** 한쪽 장식이 있는 PRSK 캐릭터를 같은 pose에서 반전한다
- **THEN** 장식의 pixel centroid는 canvas 중심 반대편으로 이동한다
- **AND** 캐릭터의 alpha bounds 크기와 수직 위치는 유지된다

#### Scenario: 반전 중 animation calibration
- **WHEN** 반전된 session에서 다른 animation을 선택한다
- **THEN** 시스템은 canonical 무반전 coarse projection에서 실제 alpha bounds를 계산한다
- **AND** 최종 pose만 현재 반전 projection으로 렌더링한다

### Requirement: 반전된 pointer look 의미

수평 반전된 preview에서도 pointer의 화면상 좌우와 눈 이동 방향이 일치해야 한다(MUST). 시스템은 normalized pointer target을 screen space로 보존하고(MUST), eye bone world delta를 계산할 때 반전 상태에서 X축만 역변환해야 한다(MUST). Mirror toggle, animation frame 또는 pointer 이동 사이에 이전 look offset을 누적해서는 안 된다(MUST NOT).

#### Scenario: 반전 상태의 오른쪽 pointer
- **WHEN** 수평 반전된 preview의 오른쪽 가장자리로 pointer를 이동한다
- **THEN** 화면상 눈은 오른쪽으로 이동한다
- **AND** bone에 적용되는 world X delta는 무반전 preview의 오른쪽 pointer와 반대 부호다

#### Scenario: pointer 유지 중 mirror toggle
- **WHEN** 오른쪽 pointer target이 활성 상태에서 mirror를 연속으로 켜고 끈다
- **THEN** 각 draw는 현재 animation pose에서 이전 offset을 제거하고 새 방향 offset을 한 번만 적용한다
