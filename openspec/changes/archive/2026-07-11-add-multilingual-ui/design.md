## Context

현재 browser UI의 사용자 문구는 `App.tsx`, `PrskIntegration.tsx`, `CodexPetBuilder.tsx`, `CodexPetInstalledPreview.tsx`, game source registry와 공용 UI에 한국어 string으로 분산되어 있다. 진행 상태와 오류도 이미 번역된 문장을 React state에 저장하므로, locale만 바꾸는 방식으로는 진행 중 화면을 즉시 전환할 수 없다. 반면 animation 이름, error code, URL, 파일 경로, recipe와 Pet manifest는 언어와 무관한 안정적 계약이므로 번역 대상과 분리해야 한다.

지원 대상은 browser UI의 한국어, 영어, 일본어와 중국어 간체다. CLI는 browser locale이나 상단 selector를 사용하지 않으므로 이번 변경의 번역 범위가 아니다. 외부 i18n dependency를 추가하지 않고 현재 React·TypeScript 및 headless CLI renderer bundle에서 같은 source를 빌드할 수 있어야 한다.

## Goals / Non-Goals

**Goals:**

- browser 또는 저장된 선택으로 결정되는 `ko | en | ja | zh-CN` locale 모델을 제공한다.
- 미지원 browser 언어를 영어로 안정적으로 fallback한다.
- 상단 국기 아이콘 selector를 접근 가능하게 제공하고 선택을 저장한다.
- 현재 browser UI의 사용자 문구, 접근성 이름과 오류 해결 안내를 네 locale에서 완결한다.
- locale 변경만으로 active preview, 입력, mapping, metadata, export와 request 상태가 초기화되지 않게 한다.
- 새 UI 문구가 한 locale에만 추가되는 회귀를 type/unit/E2E 검사로 차단한다.

**Non-Goals:**

- CLI stdout/stderr 번역 또는 CLI locale option 추가
- animation 이름, game source ID, error code, URL, 파일 경로, recipe·manifest schema 번역
- 중국어 번체 전용 catalog 또는 지역별 날짜·통화 형식
- server-side rendering, remote translation service 또는 사용자 작성 metadata 자동 번역
- browser 언어 또는 선택 locale을 provider request에 전달하는 동작

## Decisions

### 1. locale은 네 canonical 값으로 정규화하고 저장값을 우선한다

`AppLocale`은 `ko | en | ja | zh-CN`만 허용한다. 초기화 순서는 다음과 같다.

1. `localStorage`의 versioned locale key가 유효하면 사용한다.
2. `navigator.languages`의 순서와 중복되지 않은 `navigator.language`을 차례로 검사한다.
3. BCP 47 primary subtag가 `ko`, `en`, `ja`, `zh`이면 대응 canonical locale로 정규화한다.
4. 지원되는 값이 없으면 `en`을 사용한다.

따라서 `en-US`, `ja-JP`, `ko-KR`, `zh-Hant-TW`도 각각 하나의 제공 catalog로 연결된다. 중국어는 이번 범위에서 모두 간체 catalog로 연결한다. storage 접근 실패나 손상된 값은 치명적 오류가 아니라 browser 감지로 fallback한다.

저장 없이 매 mount마다 browser 설정만 읽는 대안은 사용자가 상단 selector로 바꾼 선택이 새로고침 때 사라지므로 채택하지 않는다.

### 2. 작은 typed catalog와 React context를 자체 구현한다

`src/i18n/`이 locale 정의, 감지·저장 helper, 네 translation catalog, interpolation과 `I18nProvider`/`useI18n`을 소유한다. 영어 catalog의 key shape를 canonical contract로 두고 나머지 catalog가 TypeScript `satisfies`로 같은 key를 모두 제공하게 한다. translator는 key와 named parameter만 받아 React component에서 임의 locale 조건문을 만들지 않게 한다.

현재 bundle 크기와 요구 기능에는 plural rule, rich-text parsing 또는 remote catalog가 필요하지 않다. 범용 i18n library를 추가하는 대안은 dependency와 runtime surface에 비해 이점이 작아 채택하지 않는다.

### 3. locale 변경은 provider context만 갱신하고 feature tree를 remount하지 않는다

`I18nProvider`는 App composition root 위에 한 번 mount하며 locale을 React context로 공급한다. locale 값을 component `key`나 source identity에 포함하지 않는다. selector action은 locale state, storage와 `document.documentElement.lang`만 갱신한다.

진행 상태는 이미 번역된 문장이 아니라 안정적인 status key와 interpolation data로, 오류는 stable code와 구조화 가능한 detail로 state에 보존하고 render 시점에 현재 locale로 번역한다. 이 방식은 locale 변경 전에 시작한 import/export의 상태와 오류도 즉시 새 언어로 바꾼다.

전체 App을 locale별 `key`로 다시 mount하는 대안은 구현은 단순하지만 active WebGL session, 사용자 파일과 network generation을 폐기하므로 채택하지 않는다.

### 4. 국기는 시각 cue이며 언어 이름이 접근성 의미를 소유한다

header의 selector는 네 `button`을 가진 labeled group으로 구현한다. 각 button은 `🇰🇷`, `🇺🇸`, `🇯🇵`, `🇨🇳`을 시각 아이콘으로 표시하되 emoji는 `aria-hidden`으로 두고, native language name을 `aria-label`과 tooltip으로 제공한다. 현재 항목은 `aria-pressed="true"`와 시각 선택 상태를 가진다. native button keyboard 동작을 유지한다.

국기만 accessible name으로 사용하는 방식은 screen reader에서 의미가 불안정하고, custom listbox는 네 고정 항목에 불필요한 keyboard 구현을 요구하므로 채택하지 않는다.

### 5. 기술 계약과 사용자 문구를 분리한다

다음 값은 번역하지 않는다.

- `prsk | strr | garupa`, Codex Pet state ID와 row index
- animation 이름, source/character ID, 파일 이름과 path
- stable error code, runtime version, URL/origin
- recipe, manifest, ZIP entry와 install command

game label, state label·description, control label, placeholder, 상태·오류 설명만 catalog key로 조회한다. 알려진 오류는 stable code별 localized 설명을 사용한다. code별 번역이 없는 예상 밖 오류는 raw 한국어 exception을 노출하지 않고 현재 locale의 일반 오류와 stable code를 표시한다.

### 6. catalog 완전성과 locale 전환 무부작용을 자동 검증한다

단위 테스트는 locale 정규화·우선순위·storage 실패, 네 catalog key 동등성, interpolation과 error code 번역을 검증한다. component test는 국기 selector의 accessible state, `document.lang`, 전체 UI 전환과 App feature state 보존을 검증한다. Playwright는 browser locale fixture와 미지원 locale 영어 fallback, 수동 전환 후 active PRSK preview/build 상태 및 무추가 network를 검증한다.

## Risks / Trade-offs

- [번역 key 누락으로 일부 한국어가 다른 locale에 남음] → catalog shape compile 검사, browser-visible literal scan과 네 locale component/E2E fixture를 함께 둔다.
- [locale 변경이 저장된 한국어 status를 바꾸지 못함] → status/error state를 semantic key·code와 data로 저장하고 render 시 번역한다.
- [국기와 언어가 문화적으로 일대일 대응하지 않음] → 사용자가 요구한 국기는 시각 cue로만 사용하고 native language name이 accessible 의미를 소유하게 한다.
- [중국어 번체 browser가 간체를 받음] → 모든 `zh-*`를 명시적으로 `zh-CN`에 연결하고 번체 catalog는 후속 capability로 남긴다.
- [localStorage가 차단됨] → 메모리 locale 전환은 계속 동작하고 다음 mount에서 browser 감지로 안전하게 돌아간다.
- [오류 원문의 dynamic detail이 번역 과정에서 사라짐] → code와 안전한 path/version 같은 기술 token을 별도 parameter로 보존하고 raw exception/stack은 계속 숨긴다.
- [locale context 갱신이 WebGL 또는 export를 재시작함] → locale을 source key와 effect dependency에서 제외하고 session/request invocation count 회귀 테스트를 둔다.

## Migration Plan

1. locale model, detector, storage helper, typed catalog와 provider를 추가한다.
2. App header와 game tabs에 selector 및 localized shell을 적용한다.
3. PRSK 가져오기·preview와 공용 combobox/error notice를 semantic key 기반으로 전환한다.
4. Codex Pet state copy, builder, export status와 installed preview를 전환한다.
5. 네 locale unit/component/E2E와 production bundle 검증을 통과시킨 뒤 CLI renderer를 재빌드한다.

storage key는 새 versioned key이므로 데이터 migration이 없다. 문제가 생기면 selector/provider 연결을 제거하면 기존 한국어 catalog를 기본값으로 사용할 수 있고 source/package 형식 rollback은 필요하지 않다.

## Open Questions

- 중국어 번체와 locale별 product naming은 후속 번역 검토에서 별도 catalog로 확장한다. 이번 변경의 canonical 중국어는 간체다.
