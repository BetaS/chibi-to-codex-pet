## Why

현재 브라우저 UI는 한국어 문구와 접근성 이름이 코드에 직접 고정되어 있어 한국어를 사용하지 않는 사용자가 가져오기, LiveSD 미리보기, 상태 매핑과 package 생성 흐름을 이해하기 어렵다. 브라우저 언어를 존중하는 기본 locale과 명시적인 전환 UI를 제공해 한국어·영어·일본어·중국어 사용자가 같은 기능과 오류 해결 정보를 사용할 수 있게 해야 한다.

## What Changes

- 웹 UI의 지원 locale을 한국어(`ko`), 영어(`en`), 일본어(`ja`), 중국어 간체(`zh-CN`)로 정의한다.
- 최초 locale은 저장된 사용자 선택이 있으면 이를 우선하고, 없으면 `navigator.languages`와 `navigator.language`의 우선순위에서 처음 지원되는 언어를 선택한다. 어떤 언어도 지원되지 않으면 영어를 사용한다.
- 앱 상단에 한국·미국·일본·중국 국기 모양의 locale 선택 버튼을 제공하고, 선택 상태·tooltip·screen reader 이름과 keyboard 조작을 지원한다.
- 사용자가 선택한 locale을 browser storage에 보존하고 즉시 전체 UI와 `document.documentElement.lang`에 반영한다.
- 앱 shell, 게임·resource 선택, local/remote 가져오기, LiveSD 미리보기, animation 탐색, Codex Pet 상태 매핑·패키징·설치 미리보기, 진행 상태와 오류 안내를 네 locale의 번역 catalog로 이동한다.
- 안정적인 오류 code, 기술 식별자, animation 이름, 파일 경로, URL, recipe와 package bytes는 번역하지 않고 사용자 설명만 현재 locale로 표시한다.
- locale 전환이 활성 session, 선택 파일, catalog, animation mapping, metadata, build 상태 또는 network 요청을 초기화하지 않게 한다.

## Capabilities

### New Capabilities

- `web-ui-localization`: 지원 locale, browser 감지와 영어 fallback, 저장된 사용자 선택, 상단 국기 selector, 번역 catalog 완전성, 접근성 및 상태 보존 계약을 정의한다.

### Modified Capabilities

- `web-app-foundation`: 한국어로 고정된 앱 shell을 현재 locale에 맞는 접근 가능한 shell로 변경한다.
- `livesd-36-preview`: preview control, 진행 상태와 오류 설명을 현재 locale로 표시하도록 변경한다.
- `prsk-character-archive-import`: archive 오류 code는 유지하면서 browser UI의 해결 안내를 현재 locale로 표시하도록 변경한다.
- `codex-pet-animation-mapping`: 9개 상태의 사용자 표시명과 목적 설명을 현재 locale로 표시하도록 변경한다.
- `codex-pet-package-export`: package 설정, 진행·오류, download와 installed preview UI를 현재 locale로 표시하도록 변경한다.

## Impact

- 주요 대상: `src`의 locale provider·catalog·format helper, `App.tsx`, `features/gameSources`, `features/livesd/prsk`, 공용 combobox·오류 UI, `features/codex-pet`의 builder와 installed preview 및 대응 테스트.
- browser storage key와 `document.documentElement.lang`이 추가되지만 server API, network provider, recipe schema, ZIP/pet manifest, stable error code 및 CLI 출력 계약은 변경하지 않는다.
- React i18n 외부 dependency는 추가하지 않고 현재 TypeScript build와 CLI renderer bundle에 동일한 catalog를 포함한다.
