## 1. Locale 기반과 catalog 계약

- [x] 1.1 `AppLocale`, BCP 47 정규화, browser 우선순위·영어 fallback과 versioned storage read/write helper를 구현하고 단위 테스트를 추가한다
- [x] 1.2 영어 canonical key shape와 한국어·일본어·중국어 간체 catalog, named interpolation 및 네 catalog 완전성 검사를 구현한다
- [x] 1.3 `I18nProvider`와 `useI18n`을 추가해 locale 변경, storage 실패와 `document.documentElement.lang` 동기화를 테스트한다
- [x] 1.4 native language accessible name과 `🇰🇷`·`🇺🇸`·`🇯🇵`·`🇨🇳` 아이콘, 현재 선택 상태를 가진 상단 `LocaleSelector`를 구현하고 keyboard/component test를 추가한다

## 2. App shell과 game source 번역

- [x] 2.1 App composition root에 provider와 selector를 연결하고 header, intro, footer와 game tablist의 visible·ARIA 문구를 네 locale catalog로 전환한다
- [x] 2.2 game source registry의 안정적인 ID·지원 상태와 locale별 표시명을 분리하고 준비중 tab 동작이 locale 전환에서 유지되는지 테스트한다
- [x] 2.3 저장 locale, browser `ko`·`en`·`ja`·`zh-*` 감지와 미지원 언어 영어 fallback을 App component test로 검증한다

## 3. PRSK 가져오기와 LiveSD preview 번역

- [x] 3.1 resource selector, upload/custom form, catalog·character·animation combobox, preview toolbar·empty/meta와 footer 문구를 네 locale로 전환한다
- [x] 3.2 catalog/model/import/ready 상태를 미리 번역한 문장 대신 semantic status key와 data로 저장해 진행 중 locale 변경을 즉시 반영한다
- [x] 3.3 archive·remote·runtime·adapter stable error code를 현재 locale의 해결 안내로 변환하고 path/version 같은 기술 token과 unknown-error 비노출을 테스트한다
- [x] 3.4 locale 변경이 selected source/files/character/query, active WebGL session, animation, framing/look scale와 request generation을 보존하는 component test를 추가한다

## 4. Codex Pet mapping과 package UI 번역

- [x] 4.1 9개 상태의 안정적인 ID·row 계약과 locale별 label·description을 분리하고 mapping·mirror control을 네 locale로 전환한다
- [x] 4.2 Builder metadata, 눈 이동량, export phase/progress/error, action, download와 install command 안내를 semantic key 기반 네 locale로 전환한다
- [x] 4.3 installed preview의 heading, 상태 selector, pointer 안내와 ARIA 문구를 네 locale로 전환한다
- [x] 4.4 locale 변경 중 mapping, mirror, 사용자 metadata, slider numeric 값, build/result object URL과 installed preview가 보존되는 component test를 추가한다

## 5. 통합 검증과 배포 산출물

- [x] 5.1 Playwright에 미지원 browser locale의 영어 fallback, 네 국기 selector와 ready PRSK preview에서 locale 전환 무네트워크·무재생성 시나리오를 추가한다
- [x] 5.2 browser-visible 한국어 literal과 catalog 누락을 검사하고 `typecheck`, `lint`, 전체 unit/component 및 Playwright 테스트를 통과시킨다
- [x] 5.3 CLI renderer를 재빌드하고 production build·artifact·package 검증 및 `openspec validate add-multilingual-ui`를 통과시킨다
