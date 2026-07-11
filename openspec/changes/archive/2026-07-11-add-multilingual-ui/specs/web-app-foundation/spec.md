## MODIFIED Requirements

### Requirement: 접근 가능한 한국어 앱 shell
앱은 제품명을 나타내는 단일 최상위 heading, 현재 locale의 상태 설명, 상단 locale selector와 동적 상태를 위한 `aria-live` 영역을 제공해야 한다(MUST). 최초 locale은 browser 감지 또는 저장된 선택으로 결정하고(MUST), 미지원 browser 언어는 영어로 fallback해야 한다(MUST).

#### Scenario: 초기 화면
- **WHEN** 사용자가 앱 root를 지원되는 browser locale로 연다
- **THEN** `LiveSD Pet Builder` heading과 현재 구현 단계의 안내를 해당 locale로 볼 수 있어야 한다

#### Scenario: 미지원 locale 초기 화면
- **WHEN** 저장된 선택 없이 지원되지 않는 browser locale로 앱 root를 연다
- **THEN** shell과 상단 selector는 영어로 표시되어야 한다

#### Scenario: 접근성 상태 영역
- **WHEN** 컴포넌트 테스트가 초기 앱 shell을 조회한다
- **THEN** 현재 locale의 동적 진행·오류 메시지를 표시할 `aria-live` 영역이 존재해야 한다
