## MODIFIED Requirements

### Requirement: 전체 browser UI 번역 완전성
앱 shell, 게임 탭, resource selector, local/remote 가져오기, catalog·animation combobox, LiveSD preview, preset selector·새 세션, Codex Pet 상태별 searchable animation mapping·package·installed preview, footer의 visible text, form label, placeholder, tooltip, empty/loading/progress/error 문구와 ARIA 이름은 현재 locale의 catalog에서 렌더링되어야 한다(MUST). 네 catalog는 동일한 canonical key 집합을 가져야 하며(MUST), 개발자가 한 locale에만 browser-visible key를 추가할 수 없어야 한다(MUST NOT).

#### Scenario: 네 locale의 주요 workflow
- **WHEN** 같은 ready PRSK source를 `ko`, `en`, `ja`, `zh-CN`에서 각각 표시한다
- **THEN** 입력, preview, preset selector, 9개 searchable 상태 mapping, 눈 이동량, package 생성과 설치 미리보기의 사용자 문구가 해당 locale로 표시되어야 한다

#### Scenario: 번역 catalog key 완전성
- **WHEN** 단위 테스트 또는 TypeScript가 네 catalog를 검사한다
- **THEN** 모든 locale은 canonical catalog와 같은 key를 가져야 한다

#### Scenario: locale 변경 전 비동기 상태
- **WHEN** catalog loading, model loading, sampling 또는 오류 상태 중 locale을 변경한다
- **THEN** 현재 상태 문구는 새 locale로 즉시 다시 렌더링되어야 한다
- **AND** 이전 locale로 미리 format한 상태 문장이 남아서는 안 된다

### Requirement: locale 전환의 기능 상태 보존
locale 전환은 active WebGL session, 선택한 resource source·파일·character·animation, catalog query, preset catalog·active preset, 상태별 animation query, framing·look scale, 상태 mapping·mirror, Pet metadata, 생성 결과와 진행 중 request/export를 초기화하거나 다시 시작해서는 안 된다(MUST NOT). locale 변경은 새로운 provider request, model import, preview session 생성, preset 적용·저장 또는 package build를 유발해서는 안 된다(MUST NOT).

#### Scenario: ready preview에서 전환
- **WHEN** active PRSK preview와 수정된 mapping 및 선택된 preset이 있는 상태에서 locale을 바꾼다
- **THEN** 같은 session, current animation, preset 선택, mapping과 검색 query가 유지되고 label만 번역되어야 한다
- **AND** network와 adapter 생성 및 preset storage write 호출 수는 증가하지 않아야 한다

#### Scenario: package metadata 보존
- **WHEN** Pet 이름과 설명을 입력하고 locale을 변경한다
- **THEN** 사용자가 작성한 두 값과 기존 download 결과는 유지되어야 한다
- **AND** metadata 내용을 자동 번역해서는 안 된다
