## MODIFIED Requirements

### Requirement: 전체 browser UI 번역 완전성
앱 shell, 게임 탭, resource selector, local/remote 가져오기, catalog·animation combobox, LiveSD preview, Codex Pet mapping·상태 바로가기·package·installed preview, footer의 visible text, form label, placeholder, tooltip, empty/loading/progress/error 문구와 ARIA 이름은 현재 locale의 catalog에서 렌더링되어야 한다(MUST). 네 catalog는 동일한 canonical key 집합을 가져야 하며(MUST), 개발자가 한 locale에만 browser-visible key를 추가할 수 없어야 한다(MUST NOT). 상태 바로가기의 glyph는 locale과 무관한 장식 icon으로 유지하고(MUST), accessible name과 tooltip에는 현재 locale의 상태명을 사용해야 한다(MUST).

#### Scenario: 네 locale의 주요 workflow
- **WHEN** 같은 ready PRSK source를 `ko`, `en`, `ja`, `zh-CN`에서 각각 표시한다
- **THEN** 입력, preview, 9개 상태 mapping과 바로가기, 눈 이동량, package 생성과 설치 미리보기의 사용자 문구가 해당 locale로 표시되어야 한다

#### Scenario: 번역 catalog key 완전성
- **WHEN** 단위 테스트 또는 TypeScript가 네 catalog를 검사한다
- **THEN** 모든 locale은 canonical catalog와 같은 key를 가져야 한다

#### Scenario: 상태 바로가기 locale 변경
- **WHEN** 선택된 상태 바로가기가 있는 상태에서 locale을 변경한다
- **THEN** 9개 button의 accessible name과 tooltip은 새 locale의 상태명으로 변경되어야 한다
- **AND** icon, 선택 상태, mapping과 현재 재생 animation은 유지되어야 한다

#### Scenario: locale 변경 전 비동기 상태
- **WHEN** catalog loading, model loading, sampling 또는 오류 상태 중 locale을 변경한다
- **THEN** 현재 상태 문구는 새 locale로 즉시 다시 렌더링되어야 한다
- **AND** 이전 locale로 미리 format한 상태 문장이 남아서는 안 된다
