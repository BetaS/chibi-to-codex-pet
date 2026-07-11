## ADDED Requirements

### Requirement: 지원 locale과 browser 감지
browser UI는 canonical locale `ko`, `en`, `ja`, `zh-CN`을 지원해야 한다(MUST). 저장된 유효한 사용자 선택이 없으면 `navigator.languages`의 순서와 `navigator.language`에서 처음 지원되는 BCP 47 primary language를 사용해야 하며(MUST), 지원 항목이 하나도 없거나 browser 정보에 접근할 수 없으면 영어를 선택해야 한다(MUST).

#### Scenario: 지원되는 browser 지역 locale
- **WHEN** 저장된 선택이 없고 browser 언어 우선순위의 첫 지원 항목이 `ja-JP`, `ko-KR`, `en-GB` 또는 `zh-Hant-TW`다
- **THEN** 시스템은 각각 `ja`, `ko`, `en`, `zh-CN` catalog를 선택해야 한다

#### Scenario: 여러 browser 언어의 우선순위
- **WHEN** `navigator.languages`가 `['fr-FR', 'ja-JP', 'en-US']` 순서다
- **THEN** 시스템은 첫 번째 지원 항목인 `ja`를 선택해야 한다

#### Scenario: 알 수 없는 browser 언어
- **WHEN** 저장된 선택이 없고 browser 언어가 모두 지원되지 않는다
- **THEN** 앱의 최초 locale은 `en`이어야 한다
- **AND** 한국어를 암묵적인 fallback으로 사용해서는 안 된다

### Requirement: 사용자 locale 선택과 저장
상단 selector에서 사용자가 선택한 canonical locale은 즉시 적용되고 versioned same-origin browser storage에 저장되어야 한다(MUST). 다음 mount에서는 유효한 저장값이 browser 언어보다 우선해야 한다(MUST). 저장값이 손상되었거나 storage 접근이 실패해도 앱 mount와 현재 session은 계속 동작해야 한다(MUST).

#### Scenario: 저장된 선택 우선
- **WHEN** browser 언어는 일본어지만 저장된 사용자 선택이 `en`이다
- **THEN** 앱은 최초 render부터 영어를 사용해야 한다

#### Scenario: 손상된 저장값
- **WHEN** storage에 지원하지 않는 locale 값이 있다
- **THEN** 시스템은 값을 무시하고 browser 언어 감지 규칙을 사용해야 한다

#### Scenario: storage 쓰기 실패
- **WHEN** 사용자가 locale을 선택했지만 storage 쓰기가 보안 설정으로 실패한다
- **THEN** 현재 page의 locale은 선택값으로 변경되어야 한다
- **AND** preview나 build 작업은 중단되지 않아야 한다

### Requirement: 상단 국기 locale selector
앱 header는 한국어, 영어, 일본어, 중국어 선택을 각각 `🇰🇷`, `🇺🇸`, `🇯🇵`, `🇨🇳` 국기 아이콘으로 제공해야 한다(MUST). 각 항목은 native language name의 accessible name과 tooltip, 현재 선택을 나타내는 programmatic state, native keyboard activation을 제공해야 하며(MUST), 국기 glyph만 접근성 이름으로 사용해서는 안 된다(MUST NOT).

#### Scenario: selector 최초 상태
- **WHEN** 영어 locale로 앱을 연다
- **THEN** 미국 국기 항목은 선택 상태이고 네 항목 모두 고유한 언어 이름으로 조회할 수 있어야 한다

#### Scenario: keyboard locale 전환
- **WHEN** 사용자가 일본 국기 button에 keyboard focus를 두고 활성화한다
- **THEN** 전체 browser UI는 일본어로 변경되어야 한다
- **AND** 일본어 항목만 현재 선택 상태여야 한다

### Requirement: 전체 browser UI 번역 완전성
앱 shell, 게임 탭, resource selector, local/remote 가져오기, catalog·animation combobox, LiveSD preview, Codex Pet mapping·package·installed preview, footer의 visible text, form label, placeholder, tooltip, empty/loading/progress/error 문구와 ARIA 이름은 현재 locale의 catalog에서 렌더링되어야 한다(MUST). 네 catalog는 동일한 canonical key 집합을 가져야 하며(MUST), 개발자가 한 locale에만 browser-visible key를 추가할 수 없어야 한다(MUST NOT).

#### Scenario: 네 locale의 주요 workflow
- **WHEN** 같은 ready PRSK source를 `ko`, `en`, `ja`, `zh-CN`에서 각각 표시한다
- **THEN** 입력, preview, 9개 상태, 눈 이동량, package 생성과 설치 미리보기의 사용자 문구가 해당 locale로 표시되어야 한다

#### Scenario: 번역 catalog key 완전성
- **WHEN** 단위 테스트 또는 TypeScript가 네 catalog를 검사한다
- **THEN** 모든 locale은 canonical catalog와 같은 key를 가져야 한다

#### Scenario: locale 변경 전 비동기 상태
- **WHEN** catalog loading, model loading, sampling 또는 오류 상태 중 locale을 변경한다
- **THEN** 현재 상태 문구는 새 locale로 즉시 다시 렌더링되어야 한다
- **AND** 이전 locale로 미리 format한 상태 문장이 남아서는 안 된다

### Requirement: 기술 식별자와 안전한 오류 번역
locale 전환은 animation 이름, game/source/character ID, stable error code, runtime version, 파일명·path, URL/origin, recipe, manifest와 install command를 변경해서는 안 된다(MUST NOT). 알려진 browser 오류는 stable code와 현재 locale의 해결 안내를 표시해야 하며(MUST), 알려지지 않은 오류는 raw exception·stack 또는 다른 locale의 원문 대신 현재 locale의 일반 오류로 정규화해야 한다(MUST).

#### Scenario: animation과 error code 보존
- **WHEN** 일본어 UI에서 `SKELETON_PARSE_FAILED`와 animation `w_happy_idle01_f`를 표시한다
- **THEN** code와 animation 이름은 원문 그대로 유지되어야 한다
- **AND** 오류 설명과 주변 control label만 일본어여야 한다

#### Scenario: 알려지지 않은 한국어 exception
- **WHEN** 영어 UI에 내부 한국어 exception이 전달된다
- **THEN** UI는 한국어 원문이나 stack을 노출하지 않고 영어 일반 오류와 stable fallback code를 표시해야 한다

### Requirement: locale 전환의 기능 상태 보존
locale 전환은 active WebGL session, 선택한 resource source·파일·character·animation, catalog query, framing·look scale, 상태 mapping·mirror, Pet metadata, 생성 결과와 진행 중 request/export를 초기화하거나 다시 시작해서는 안 된다(MUST NOT). locale 변경은 새로운 provider request, model import, preview session 생성 또는 package build를 유발해서는 안 된다(MUST NOT).

#### Scenario: ready preview에서 전환
- **WHEN** active PRSK preview와 수정된 mapping이 있는 상태에서 locale을 바꾼다
- **THEN** 같은 session, current animation과 mapping이 유지되고 label만 번역되어야 한다
- **AND** network와 adapter 생성 호출 수는 증가하지 않아야 한다

#### Scenario: package metadata 보존
- **WHEN** Pet 이름과 설명을 입력하고 locale을 변경한다
- **THEN** 사용자가 작성한 두 값과 기존 download 결과는 유지되어야 한다
- **AND** metadata 내용을 자동 번역해서는 안 된다

### Requirement: document 언어와 숫자 접근성
현재 locale은 `document.documentElement.lang`에 canonical BCP 47 값으로 반영되어야 한다(MUST). percentage와 진행 수치는 locale 전환 후에도 동일한 numeric value를 유지하고 visible output과 `aria-valuetext`가 현재 locale의 문맥을 사용해야 한다(MUST).

#### Scenario: document language 갱신
- **WHEN** 사용자가 중국어를 선택한다
- **THEN** root document의 `lang`은 `zh-CN`이어야 한다

#### Scenario: slider 값 보존
- **WHEN** 눈 이동량이 125%인 상태에서 한국어에서 영어로 전환한다
- **THEN** range의 numeric value는 125로 유지되어야 한다
- **AND** visible output과 accessible value는 영어 UI 문맥에서 같은 비율을 나타내야 한다
