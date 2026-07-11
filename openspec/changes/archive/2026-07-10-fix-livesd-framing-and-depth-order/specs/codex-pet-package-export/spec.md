## ADDED Requirements

### Requirement: v2 atlas 가시 점유율과 안전 여백
독립 package validator는 alpha 값이 2 이상인 pixel로 모든 사용 cell의 가시 bounds를 계산해야 한다(MUST). rows 0–10의 모든 사용 cell은 네 외곽으로부터 최소 4px의 투명 안전 여백을 가져야 하며(MUST), 57개 표준 cell의 cell-local bounds 합집합은 `max(width / 192, height / 208)` 점유율이 0.70 이상이어야 한다(MUST). 안전 여백 위반은 cell 좌표를 포함한 `PNG_CELL_CLIPPED`, 점유율 미달은 측정값을 포함한 `PNG_OCCUPANCY_TOO_SMALL`으로 package를 거부해야 한다(MUST).

#### Scenario: 충분한 가시 점유율
- **WHEN** validator가 Airi 또는 Miku v2 ZIP의 57개 표준 cell을 독립적으로 디코딩한다
- **THEN** cell-local 가시 bounds 합집합의 가로 또는 세로 최대 점유율은 0.70 이상이다

#### Scenario: 과도하게 축소된 atlas
- **WHEN** 57개 표준 cell의 가시 bounds 합집합 최대 점유율이 0.70보다 작다
- **THEN** validator는 측정된 점유율을 포함한 `PNG_OCCUPANCY_TOO_SMALL`으로 package를 거부한다

#### Scenario: cell 외곽 clipping 위험
- **WHEN** 사용 cell의 alpha 2 이상 pixel이 네 외곽 중 하나의 4px 안전 영역에 닿는다
- **THEN** validator는 row와 column을 포함한 `PNG_CELL_CLIPPED`로 package를 거부한다

#### Scenario: Airi와 Miku 실제 package 품질
- **WHEN** 로컬 `sd_07airi_normal`과 idle이 `z_test_F_negi01`인 `sd_21miku_normal`을 export하고 다운로드한 실제 ZIP을 설치한다
- **THEN** 두 package는 점유율과 안전 여백 검사를 통과하고 웹 installed preview 및 Codex renderer에서 clipping이나 depth-order flicker 없이 렌더링된다

### Requirement: 사용자 배율과 package 결과 일관성
웹은 현재 preview의 `framingScale`을 package sampling 시작 시 snapshot해 PNG pixel에 bake해야 하며(MUST), manifest schema에 배율 필드를 추가해서는 안 된다(MUST NOT). 배율이 변경되면 진행 중인 이전 배율 export를 취소하고 기존 download URL, validation 결과와 installed preview를 폐기해야 하며(MUST), 사용자가 입력한 metadata와 animation mapping은 유지해야 한다(MUST). 지원하는 80%와 100% 결과는 모두 기존 70% 점유율과 4px 안전 여백 검사를 통과해야 한다(MUST).

#### Scenario: 배율 변경 후 이전 결과 무효화
- **WHEN** 검증된 ZIP과 installed preview가 있는 상태에서 사용자가 Pet 크기 슬라이더를 변경한다
- **THEN** 이전 download와 installed preview는 제거되고 metadata와 animation mapping은 유지된 채 새 배율로 다시 생성할 수 있다

#### Scenario: 진행 중 배율 변경
- **WHEN** sampling 또는 packaging 중 사용자가 Pet 크기를 변경한다
- **THEN** 이전 배율 작업은 취소되어 결과를 노출하지 않고 다음 생성은 변경된 배율 snapshot을 사용한다

#### Scenario: manifest 호환성 유지
- **WHEN** 80% 또는 100% package를 만든다
- **THEN** `pet.json`은 기존 v2 필드만 유지하고 선택 배율은 `spritesheet.png`의 raster 크기로만 표현된다

#### Scenario: 경계 배율 실제 설치
- **WHEN** Airi를 80%, idle이 `z_test_F_negi01`인 Miku를 100%로 export해 실제 ZIP을 설치한다
- **THEN** 두 package는 점유율·안전 여백·16방향 look 검사를 통과하고 Airi의 최대축 alpha bbox는 동일 입력 100% 결과 대비 약 0.8배다
