## MODIFIED Requirements

### Requirement: 사용자 눈 이동량과 package 결과 일관성
웹은 ready source의 패키징 설정에 현재 locale로 표시되는 접근 가능한 눈 이동량 range를 제공해야 하며(MUST), 범위는 `50%–150%`, 기본값은 `100%`, UI 간격은 `5%`여야 한다(MUST). 생성 시작 시 선택값을 snapshot해 16개 look frame에 적용하고(MUST), remote recipe의 `pet.lookMovementScale`에 기록해 headless renderer가 같은 raster를 재현해야 한다(MUST). 기존 schema version 1 recipe에서 값이 누락되면 `1.00`으로 읽어야 하며(MUST), `pet.json` manifest에는 이 설정을 추가해서는 안 된다(MUST NOT).

#### Scenario: 접근 가능한 눈 이동량 조절
- **WHEN** ready source에서 눈 이동량 slider를 조작한다
- **THEN** slider는 현재 locale의 label과 `aria-valuetext`, visible percentage output을 표시하고 5% 단위로 50%부터 150%까지 변경되어야 한다

#### Scenario: locale 전환 중 값 유지
- **WHEN** 눈 이동량을 125%로 설정한 뒤 locale을 변경한다
- **THEN** slider label과 설명은 새 locale로 바뀌고 numeric value 125%는 유지되어야 한다

#### Scenario: 완료 결과 이후 눈 이동량 변경
- **WHEN** 검증된 ZIP과 installed preview가 있는 상태에서 눈 이동량을 변경한다
- **THEN** 이전 download URL, validation 결과와 installed preview는 폐기되고 metadata와 animation mapping은 유지된다

#### Scenario: 생성 중 설정 고정
- **WHEN** sampling, packaging 또는 validation이 진행 중이다
- **THEN** 눈 이동량 slider와 초기화 action은 비활성화되고 현재 작업은 생성 시작 시 snapshot한 값을 사용한다

#### Scenario: recipe와 manifest 경계
- **WHEN** remote source에서 125% 눈 이동량 package와 설치 명령을 만든다
- **THEN** recipe는 `lookMovementScale: 1.25`를 포함하고 sampler에 같은 값을 전달하지만 생성된 v2 `pet.json`의 필드는 변경되지 않는다
