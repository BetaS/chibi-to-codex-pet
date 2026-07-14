# 웹 UI 다국어 명세

## Purpose

브라우저 언어 감지와 사용자 선택에 따라 전체 UI를 한국어·영어·일본어·중국어 간체로 제공하면서 기술 식별자와 실행 상태를 보존하는 계약을 정의한다.

## Requirements

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
상단 selector에서 사용자가 선택한 canonical locale은 즉시 적용되고 same-origin `localStorage`의 `chibi-to-codex-pet.locale.v1` key에 JSON wrapper 없이 canonical locale 문자열 자체로 저장되어야 한다(MUST). 다음 mount에서는 `ko`, `en`, `ja`, `zh-CN` 중 하나인 정확한 저장값이 browser 언어보다 우선해야 한다(MUST). 저장값이 손상되었거나 storage 접근이 실패해도 앱 mount와 현재 session은 계속 동작해야 한다(MUST).

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
앱 shell, 게임 탭, resource selector, local/remote 가져오기, catalog·animation combobox, LiveSD preview, framing border·scale·X/Y offset, preset selector·새 세션·프리셋 불러오기, Codex Pet 상태별 searchable animation mapping·상태 바로가기·package·installed preview·CLI 바로가기 복사, footer의 visible text, form label, placeholder, tooltip, empty/loading/progress/error 문구와 ARIA 이름은 현재 locale의 catalog에서 렌더링되어야 한다(MUST). 네 catalog는 동일한 canonical key 집합을 가져야 하며(MUST), 개발자가 한 locale에만 browser-visible key를 추가할 수 없어야 한다(MUST NOT). 상태 바로가기의 glyph는 locale과 무관한 장식 icon으로 유지하고(MUST), accessible name과 tooltip에는 현재 locale의 상태명을 사용해야 한다(MUST).

Runtime lookup은 현재 locale에 key가 없을 때 같은 key의 영어 값을 최종 fallback으로 사용해야 하며(MUST), named placeholder는 전달된 값만 치환하고 누락된 placeholder token은 진단할 수 있도록 원문 `{name}` 형태로 유지해야 한다(MUST). Catalog 완전성 검사는 정상 build에서 이 fallback에 의존하는 누락 key가 없도록 보장해야 한다(MUST).

#### Scenario: 네 locale의 주요 workflow
- **WHEN** 같은 ready PRSK source를 `ko`, `en`, `ja`, `zh-CN`에서 각각 표시한다
- **THEN** 입력, LiveSD output border, scale·X/Y offset, preset selector, 9개 searchable 상태 mapping과 바로가기, 눈 이동량, package 생성과 installed preview border의 사용자 문구가 해당 locale로 표시되어야 한다

#### Scenario: framing 단위와 접근성
- **WHEN** locale을 바꾸며 framing control을 표시한다
- **THEN** scale은 locale의 백분율 표현을, offset은 locale label과 `px` 단위를 사용하고 각 input의 접근 가능한 이름이 현재 locale에서 제공된다

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

### Requirement: 사용자 행동과 결과 중심의 안내 문구
일반 사용자가 보는 helper description, empty state, loading·progress와 복구 안내는 한두 개의 짧은 문장으로 다음에 할 행동 또는 그 행동으로 얻는 결과를 설명해야 한다(MUST). 이 문구는 request generation, ready source, parser·sampler·pixel validation, 내부 frame 수, exact commit, provider manifest와 `public/assets` 같은 구현 경로를 설명해서는 안 된다(MUST NOT). 단, 사용자가 올바른 입력을 선택하거나 문제를 해결하는 데 필요한 파일 확장자·ZIP 내용·서버 URL·browser 호환성·privacy 영향과 별도 진단 영역의 stable code는 표시할 수 있다(MAY).

PRSK, STRR와 Garupa의 preset selector 아래 설명은 각 locale에서 `재사용할 프리셋을 선택해주세요.`와 같은 의미의 짧은 선택 안내여야 한다(MUST). Preset 설명에서 저장 preset의 명시적 적용 gate와 `새 세션`의 character list gate를 풀어 설명해서는 안 되며(MUST NOT), 실제 활성·비활성 상태와 action label이 그 동작을 전달해야 한다(MUST).

#### Scenario: 저장 preset 선택 안내
- **WHEN** PRSK, STRR 또는 Garupa의 preset selector가 표시된다
- **THEN** 설명은 재사용할 preset 선택을 안내하고 `프리셋 불러오기`와 `새 세션`의 내부 동작 규칙을 서술하지 않아야 한다

#### Scenario: 모델과 Pet 생성 진행 안내
- **WHEN** model preview 또는 Codex Pet 생성이 진행 중이다
- **THEN** 상태 문구는 캐릭터, 미리보기, 애니메이션 또는 설치 파일을 준비 중이라는 사용자 결과를 표시해야 한다
- **AND** request 취소 구현, skeleton parse, sampling frame 수, package pixel validation 같은 내부 단계를 표시해서는 안 된다

#### Scenario: 입력 제약과 복구 안내
- **WHEN** local character ZIP 입력 또는 복구 가능한 loading 오류를 안내한다
- **THEN** 올바른 파일 선택이나 다시 시도 같은 구체적인 다음 행동을 제공해야 한다
- **AND** 입력 판단에 필요한 `.skel`, ZIP 내부 filename 또는 server URL은 숨기지 않아도 된다

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
locale 전환은 active WebGL session, 선택한 resource source·파일·character·animation, catalog query, preset catalog·active preset, 상태별 animation query·바로가기 선택, framing·look scale, 상태 mapping·mirror, Pet metadata, 생성 결과와 진행 중 request/export를 초기화하거나 다시 시작해서는 안 된다(MUST NOT). locale 변경은 새로운 provider request, model import, preview session 생성, preset 적용·저장 또는 package build를 유발해서는 안 된다(MUST NOT).

#### Scenario: ready preview에서 전환
- **WHEN** active PRSK preview와 수정된 mapping, 선택된 상태 바로가기 및 preset이 있는 상태에서 locale을 바꾼다
- **THEN** 같은 session, current animation, 바로가기·preset 선택, mapping과 검색 query가 유지되고 label만 번역되어야 한다
- **AND** network와 adapter 생성 및 preset storage write 호출 수는 증가하지 않아야 한다

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
