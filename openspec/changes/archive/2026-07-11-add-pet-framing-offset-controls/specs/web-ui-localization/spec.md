## MODIFIED Requirements

### Requirement: 전체 browser UI 번역 완전성
앱 shell, 게임 탭, resource selector, local/remote 가져오기, catalog·animation combobox, LiveSD preview, framing border·scale·X/Y offset, Codex Pet mapping·package·installed preview, footer의 visible text, form label, placeholder, tooltip, empty/loading/progress/error 문구와 ARIA 이름은 현재 locale의 catalog에서 렌더링되어야 한다(MUST). 네 catalog는 동일한 canonical key 집합을 가져야 하며(MUST), 개발자가 한 locale에만 browser-visible key를 추가할 수 없어야 한다(MUST NOT).

#### Scenario: 네 locale의 주요 workflow
- **WHEN** 같은 ready PRSK source를 `ko`, `en`, `ja`, `zh-CN`에서 각각 표시한다
- **THEN** 입력, LiveSD output border, scale·X/Y offset, 9개 상태, 눈 이동량, package 생성과 installed preview border의 사용자 문구가 해당 locale로 표시된다

#### Scenario: framing 단위와 접근성
- **WHEN** locale을 바꾸며 framing control을 표시한다
- **THEN** scale은 locale의 백분율 표현을, offset은 locale label과 `px` 단위를 사용하고 각 input의 접근 가능한 이름이 현재 locale에서 제공된다

#### Scenario: 번역 catalog key 완전성
- **WHEN** 단위 테스트 또는 TypeScript가 네 catalog를 검사한다
- **THEN** 모든 locale은 canonical catalog와 같은 key를 가진다

#### Scenario: locale 변경 전 비동기 상태
- **WHEN** catalog loading, model loading, sampling 또는 오류 상태 중 locale을 변경한다
- **THEN** 현재 상태 문구는 새 locale로 즉시 다시 렌더링된다
- **AND** 이전 locale로 미리 format한 상태 문장이 남아서는 안 된다
