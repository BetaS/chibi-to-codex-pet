## MODIFIED Requirements

### Requirement: Codex 좌표 기반 package preview
웹은 validator가 ZIP에서 다시 읽은 atlas를 Codex와 같은 8열×11행 background 좌표로 렌더링하고(MUST), installed preview의 정확한 `192×208` sprite 영역에 visible border box와 cell size label을 표시해야 한다(MUST). preview는 9개 표준 상태 선택과 상태별 frame 순환, 16방향 pointer look 선택을 제공해야 한다(MUST). 현재 state, frame index와 look direction index는 자동 테스트가 관찰할 수 있어야 한다(MUST).

#### Scenario: installed preview border box
- **WHEN** 검증된 package preview가 표시된다
- **THEN** 현재 atlas cell은 `192×208` 고정 border box 안에서 렌더링되고 scale 또는 offset으로 crop된 edge를 확인할 수 있다

#### Scenario: 표준 상태 전환
- **WHEN** 사용자가 installed preview에서 다른 표준 상태를 선택한다
- **THEN** renderer는 해당 row의 첫 frame으로 전환하고 상태 계약의 duration으로 frame을 순환한다

#### Scenario: pointer look 우선순위
- **WHEN** pointer가 dead zone 밖의 preview stage에 있다
- **THEN** renderer는 현재 표준 상태 frame보다 계산된 rows 9–10의 look frame을 우선 표시한다

#### Scenario: pointer look 종료
- **WHEN** pointer가 dead zone으로 이동하거나 preview stage를 나간다
- **THEN** renderer는 look frame을 제거하고 현재 선택·hover 표준 상태로 복귀한다

#### Scenario: frame 변화
- **WHEN** 둘 이상의 서로 다른 frame을 가진 상태를 재생한다
- **THEN** browser screenshot 또는 pixel sample은 시간 경과 뒤 렌더링된 표준 상태 cell의 변화를 관찰한다

### Requirement: v2 atlas 가시 점유율과 custom framing 경계
독립 package validator는 alpha 값이 2 이상인 pixel로 모든 사용 cell의 가시 bounds를 계산해야 한다(MUST). 기본 framing 검증에서는 rows 0–10의 모든 사용 cell이 네 외곽으로부터 최소 4px의 투명 안전 여백을 가져야 한다(MUST). 사용자 custom framing으로 생성한 package는 명시적인 validator option이 있을 때 edge 접촉과 crop을 허용해야 하지만(MUST), 모든 사용 cell의 empty 검사, 57개 표준 cell 합집합의 `max(width / 192, height / 208) >= 0.70`, atlas geometry, manifest와 미사용 cell alpha 검사를 계속 적용해야 한다(MUST). strict 안전 여백 위반은 cell 좌표를 포함한 `PNG_CELL_CLIPPED`, 점유율 미달은 측정값을 포함한 `PNG_OCCUPANCY_TOO_SMALL`으로 package를 거부해야 한다(MUST).

#### Scenario: 기본 framing의 안전 여백
- **WHEN** scale 100%, offset `0,0` package의 used cell alpha가 4px 안전 영역에 닿는다
- **THEN** validator는 row와 column을 포함한 `PNG_CELL_CLIPPED`로 package를 거부한다

#### Scenario: custom framing edge crop 허용
- **WHEN** scale 125% 또는 0이 아닌 offset의 package를 custom framing option으로 검증하고 used cell alpha가 edge에 닿는다
- **THEN** validator는 edge 접촉만으로 package를 거부하지 않고 나머지 geometry, empty, occupancy와 unused cell 검사를 수행한다

#### Scenario: custom framing의 빈 cell 거부
- **WHEN** 큰 offset으로 custom-framed used cell 하나가 완전히 투명해진다
- **THEN** validator는 custom framing option과 관계없이 해당 cell을 `PNG_CELL_EMPTY`로 거부한다

#### Scenario: 과도하게 축소된 atlas
- **WHEN** 57개 표준 cell의 가시 bounds 합집합 최대 점유율이 0.70보다 작다
- **THEN** validator는 측정된 점유율을 포함한 `PNG_OCCUPANCY_TOO_SMALL`으로 package를 거부한다

### Requirement: 사용자 framing과 package 결과 일관성
웹은 현재 preview의 `framingScale`과 X/Y offset을 package sampling 시작 시 snapshot해 PNG pixel에 bake해야 하며(MUST), manifest schema에 framing 필드를 추가해서는 안 된다(MUST NOT). framing 값이 변경되면 진행 중인 이전 export를 취소하고 기존 download URL, validation 결과와 installed preview를 폐기해야 하며(MUST), 사용자가 입력한 metadata와 animation mapping은 유지해야 한다(MUST). 기본 framing은 strict 70% 점유율과 4px 안전 여백을 통과해야 하고(MUST), custom framing은 의도한 edge crop을 허용하면서 empty·점유율·geometry 검사를 통과해야 한다(MUST).

#### Scenario: framing 변경 후 이전 결과 무효화
- **WHEN** 검증된 ZIP과 installed preview가 있는 상태에서 사용자가 scale 또는 X/Y offset을 변경한다
- **THEN** 이전 download와 installed preview는 제거되고 metadata와 animation mapping은 유지된 채 새 framing으로 다시 생성할 수 있다

#### Scenario: 진행 중 framing 변경
- **WHEN** sampling 또는 packaging 중 사용자가 scale 또는 offset을 변경한다
- **THEN** 이전 framing 작업은 취소되어 결과를 노출하지 않고 다음 생성은 변경된 framing snapshot을 사용한다

#### Scenario: manifest 호환성 유지
- **WHEN** custom framing package를 만든다
- **THEN** `pet.json`은 기존 v2 필드만 유지하고 선택 scale과 offset은 `spritesheet.png`의 raster 결과로만 표현된다

#### Scenario: preview와 package 일치
- **WHEN** 150%, X `12px`, Y `8px` framing으로 package를 생성한다
- **THEN** LiveSD border box에서 보인 크기·위치·crop과 installed preview의 raster 결과가 반올림 오차 안에서 일치한다
