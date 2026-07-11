> **Supersession note (2026-07-10):** 1–7은 최초 `api.pjsek.ai` catalog adapter를 포함해 완료했던 baseline 기록이다. 현재 acceptance는 8의 `prsk-chibi-viewer` deployment snapshot adapter가 API-specific 계약을 대체하며, 이전 체크박스는 역사적 작업 완료를 나타낼 뿐 현재 snapshot 계약의 완료를 의미하지 않는다.

## 1. provider와 catalog 계약 기반

- [x] 1.1 `PrskRemoteCharacterOption`, `PrskRemoteCatalog`, provider 설정, model 입력, 원격 제한 상수와 안정적 오류 코드를 정의한다
- [x] 1.2 production HTTPS·자격 증명·query·fragment·로컬 및 private IP literal 규칙과 development localhost 예외를 적용하는 asset base URL validator를 구현한다
- [x] 1.3 custom provider의 같은-origin `catalog.json` URL과 pjsek.ai preset의 고정 asset·catalog origin 및 parent 설정을 구현한다
- [x] 1.4 preset 이후 base URL을 편집하면 custom provider로 전환하고 이전 catalog·선택 상태를 무효화하는 provider resolver를 구현한다
- [x] 1.5 최대 128자의 ID·label, 중복 거부, stable sort 및 최대 1,000개 제한을 적용하는 공통 catalog option normalizer를 구현한다

## 2. 원격 catalog adapter

- [x] 2.1 `version: 1`과 `characters` 배열을 검증해 option으로 변환하는 custom `catalog.json` parser를 구현한다
- [x] 2.2 pjsek.ai asset API의 `{ total, limit, skip, data }` schema를 파싱해 즉시 하위 directory만 option으로 만들고 file·nested descendant·`base_model`을 제외하는 adapter를 구현한다
- [x] 2.3 pjsek.ai `$limit`·`$skip`·정렬 query pagination을 구현하고 누적 제한·비전진 page·불일치 total을 거부한다
- [x] 2.4 catalog 1MiB fatal UTF-8 JSON 제한과 20초 timeout을 적용해 `PrskRemoteCatalogSource` 결과를 반환한다
- [x] 2.5 option은 최신 성공 asset 응답에서만 파생하고 static·bundled·이전 응답 fallback을 금지하며 빈 catalog, schema·version·pagination·항목 제한 및 HTTP·CORS/네트워크 오류를 구분해 정규화한다

## 3. 제한된 원격 모델 loader

- [x] 3.1 현재 catalog에 존재하는 선택 ID만 허용하고 PRSK 스켈레톤·atlas URL을 구성한다
- [x] 3.2 atlas 페이지를 캐릭터 root 아래의 같은 asset origin PNG로만 정규화하고 탈출·절대 URL·중복 경로를 거부한다
- [x] 3.3 공통 fetch 옵션(`cors`, credentials 생략, referrer 비전송, redirect 거부, 공유 signal)을 적용하고 HTTP·redirect·CORS/네트워크 오류를 정규화한다
- [x] 3.4 `Content-Length` 선제 검사와 stream 누적 검사를 지원하는 제한된 response reader를 catalog source와 공유한다
- [x] 3.5 스켈레톤 8MiB, fatal UTF-8 atlas 1MiB, PNG 32개·합계 64MiB 및 PNG signature 제한을 구현한다
- [x] 3.6 사용자 signal과 20초 model timeout을 결합하고 timeout·사용자 abort를 구분해 진행 중 body reader를 정리한다
- [x] 3.7 `PrskRemoteResourceSource`가 선택 option의 모델 리소스를 런타임 독립 `PrskRemoteModelInput`으로 반환하도록 구현한다
- [x] 3.8 원격 결과에 애니메이션 목록·object URL·WebGL·runtime 객체가 없고 기존 `LiveSDAtlasBundle` 경로 key 계약과 일치하는지 확인한다

## 4. source mode와 searchable character·animation dropdown UI

- [x] 4.1 `local | remote` source mode를 추가하고 local을 초기값으로 유지하며 development 기본 모델 자동 로드를 local mode에만 한정한다
- [x] 4.2 빈 base URL 입력에 pjsek.ai placeholder를 표시하고 요청 없이 provider 설정만 채우는 `pjsek.ai 사용` preset을 추가한다
- [x] 4.3 remote mode에 대상 catalog·asset origin, 외부 요청·비제휴·권리 책임 고지와 명시적 `목록 불러오기` 동작을 추가한다
- [x] 4.4 catalog loading·empty·error 상태와 label이 연결된 searchable character combobox를 구현하고 canonical option을 현재 catalog generation과 1:1로 유지한 채 label·ID의 대소문자 무시 substring 검색만 클라이언트에서 수행한다
- [x] 4.5 검색 결과의 검증된 option을 명시적으로 선택할 때만 해당 모델을 자동 로드하고 결과 없음·자유 입력·오래된 option ID는 선택이나 요청으로 commit하지 않는다
- [x] 4.6 local과 remote 입력 준비 결과를 공통 preview 생성 단계로 합치고 기존 `LiveSD36Adapter`의 버전 검사, 실제 스켈레톤 애니메이션 파싱과 렌더링 경로를 재사용한다
- [x] 4.7 catalog와 model에 독립적인 request generation·`AbortController`를 적용하고 provider·mode 변경 및 unmount의 취소 규칙을 구현한다
- [x] 4.8 새 remote 모델이 스켈레톤 파싱과 첫 frame까지 성공한 뒤에만 기존 세션, 미리보기와 animation dropdown을 함께 교체하고 query를 초기화하며 실패 시 현재 세션과 두 dropdown의 query·filtered result·선택을 유지한다
- [x] 4.9 catalog·선택·model 오류를 한국어 상태와 안정적 코드로 UI에 연결하고 abort는 사용자 오류로 표시하지 않는다
- [x] 4.10 ready 세션의 실제 animation 이름만 searchable animation combobox에 표시하고 이름의 대소문자 무시 substring 검색, `pose_default` 또는 첫 option 기본 재생과 무네트워크 `session.play()` 전환을 구현한다
- [x] 4.11 검색 text는 option 선택 전까지 animation 값으로 commit하지 않고 모델 교체 후 이전 option의 programmatic 재생 요청은 `ANIMATION_UNKNOWN`으로 거부해 현재 재생을 유지한다
- [x] 4.12 provider·base URL·catalog invalidation, ready session 교체와 source mode 전환 시 대응하는 검색 query를 초기화하고 검색 자체는 선택·request generation·네트워크 상태를 변경하지 않게 한다

## 5. catalog와 model 단위 테스트

- [x] 5.1 custom manifest version·schema·ID·label·중복·정렬·빈 목록·1,000개 경계를 테스트한다
- [x] 5.2 pjsek.ai 응답에 directory·file·nested descendant·`base_model`이 섞인 fixture로 정확한 immediate character option, pagination 누적, 비전진 page와 schema 오류를 테스트한다
- [x] 5.3 placeholder와 preset은 요청하지 않고 pjsek.ai 목록 실행만 고정 API·parent query를 사용하는지 테스트한다
- [x] 5.4 유효 URL 정규화, production 금지 URL, development localhost 예외, custom 같은-origin catalog와 preset origin 경계를 테스트한다
- [x] 5.5 현재 catalog 선택 검증, 고정 스켈레톤·atlas URL, 중첩 PNG, 경로 탈출·절대 URL·다른 origin·중복 페이지를 테스트한다
- [x] 5.6 모든 catalog·model fetch가 credentials·referrer 없이 redirect를 거부하고 해당 작업 signal을 사용하는지 테스트한다
- [x] 5.7 `Content-Length`와 chunk stream 각각에서 catalog·스켈레톤·atlas·PNG 크기 및 페이지 수 경계를 테스트한다
- [x] 5.8 fatal UTF-8 JSON·atlas, PNG signature, HTTP status, redirect, `REMOTE_NETWORK_OR_CORS`, timeout과 사용자 abort 오류를 테스트한다
- [x] 5.9 성공한 catalog와 model 결과가 최신 응답의 정렬된 option, 원본 스켈레톤 및 정규화된 `LiveSDAtlasBundle`을 보존하고 별도 애니메이션 목록을 포함하지 않는지 테스트한다
- [x] 5.10 공통 dropdown filter가 label·value의 대소문자 무시 substring, stable order, 빈 query 전체 복원과 결과 없음에 대해 canonical option을 변경하지 않는지 단위 테스트한다

## 6. UI와 브라우저 회귀 테스트

- [x] 6.1 초기 local mode, development 기본 모델, production local 필수 입력과 local ZIP 무외부요청 회귀 테스트를 유지한다
- [x] 6.2 placeholder 및 pjsek.ai preset이 `목록 불러오기` 전에는 어떤 원격 요청도 만들지 않는 컴포넌트 테스트를 추가한다
- [x] 6.3 catalog 성공·빈 목록·오류 상태와 character combobox의 대소문자 무시 검색, 빈 query 복원, 결과 없음·자유 입력 거부, 검색 중 무네트워크 및 재로드 시 query·option·선택 초기화를 컴포넌트 테스트로 검증한다
- [x] 6.4 연속 catalog load, 연속 committed dropdown 선택, provider 편집과 mode 전환만 이전 generation을 취소하고 query·highlight 변경은 generation·abort를 만들지 않는지 테스트한다
- [x] 6.5 원격 model 준비·파싱·첫 frame 실패 시 기존 세션과 두 dropdown의 query·filtered result·선택을 유지하고 성공 시 session·option 교체와 query 초기화가 한 번만 일어나는지 테스트한다
- [x] 6.6 Playwright request interception으로 custom catalog와 pjsek.ai 형식 catalog 각각의 dropdown 구성 및 선택 모델 미리보기를 검증한다
- [x] 6.7 서로 다른 animation 목록을 가진 원격 스켈레톤 fixture로 animation combobox 검색·빈 query·결과 없음·자유 입력 거부, 실제 파싱 option·기본값·전환 및 검색·전환 중 무네트워크를 검증한다
- [x] 6.8 브라우저 테스트와 CI가 실제 pjsek.ai를 요청하지 않으며 production build에 PRSK 자산·생성 catalog·고정 캐릭터·애니메이션 목록·사용자 URL이 포함되지 않는지 검증한다
- [x] 6.9 두 combobox의 label, ARIA expanded/active option, keyboard 탐색·선택과 loading·empty·no-result·error 안내를 컴포넌트 및 Chromium 테스트로 검증한다

## 7. 문서와 최종 검증

- [x] 7.1 `DECISIONS.md`에 local 기본, 명시적 catalog·model 요청, 최신 asset 응답 기반 searchable character dropdown, 실제 스켈레톤 기반 searchable animation dropdown, local-only 검색과 암묵적 fallback 금지 결정을 append-only로 기록한다
- [x] 7.2 README의 Browser First, production 입력, provider catalog, 두 searchable dropdown, 개인정보·외부 요청 및 원격 서버 책임 고지를 갱신한다
- [x] 7.3 `pnpm typecheck`, `pnpm lint`, `pnpm test`, `pnpm test:e2e`, `pnpm build`를 실행하고 기존 local 및 LiveSD 3.6 미리보기 회귀가 없는지 확인한다
- [x] 7.4 `openspec validate add-prsk-remote-resource-source`를 통과시키고 완료된 구현과 delta spec 사이의 차이가 없는지 최종 점검한다

## 8. prsk-chibi-viewer deployment snapshot adapter로 API catalog 대체

- [x] 8.1 `api.pjsek.ai` catalog URL·parent·pagination provider를 제거하고 고정 viewer entry, direct asset base, `prsk-chibi-viewer` provider kind과 request origin 계약을 추가한다
- [x] 8.2 viewer entry HTML과 hashed JS를 공통 fetch policy·catalog timeout/signal로 순차 요청하고 fatal UTF-8 합계 1MiB 제한을 적용한다
- [x] 8.3 inert HTML에서 username·password·query·fragment가 없고 `^/static/js/main\.[0-9a-f]{8}\.js$`를 만족하는 same-origin script candidate를 정확히 하나만 허용한다
- [x] 8.4 hashed JS를 실행·평가하지 않고 raw 또는 quote-escaped exact `{ value, label }` record만 scan한다
- [x] 8.5 안전한 `sd_` ID와 `label === value`, dedupe·최대 1,000개를 검증하고 공통 option normalizer로 정규화하며 숨은 API·proxy·bundled·cached fallback을 두지 않는다
- [x] 8.6 preset·placeholder·origin·disclosure UI를 `prsk-chibi-viewer` snapshot과 direct `assets.pjsek.ai` 계약으로 변경하고 snapshot 진부화·구조 변경·비제휴 가능성을 안내한다
- [x] 8.7 provider resolver, HTML main-script discovery, strict bundle text scanner, option 검증, 누적 크기·fatal UTF-8·timeout·abort·fetch policy와 기존 catalog error를 단위 테스트하고 API pagination fixture를 제거한다
- [x] 8.8 component 테스트에서 preset이 요청하지 않음, origin 표시, dropdown과 query 무네트워크 상태를 검증한다
- [x] 8.9 Playwright fixture에서 viewer HTML, same-origin hashed JS와 direct asset을 모두 intercept하고 예상하지 않은 provider 요청을 차단한다
- [x] 8.10 production build에 viewer snapshot에서 얻은 캐릭터·애니메이션 목록, HTML·JS 응답, 생성 catalog, test URL 또는 사용자 URL이 포함되지 않는지 검증한다
- [x] 8.11 proposal, design, delta spec, README와 `DECISIONS.md`를 실제 viewer deployment snapshot·direct asset 계약으로 동기화한다
- [x] 8.12 `pnpm typecheck`, `pnpm lint`, `pnpm test`, `pnpm test:e2e`, `pnpm build`와 `openspec validate add-prsk-remote-resource-source`를 최종 통과시킨다

> snapshot adapter 적용 직후 typecheck·lint·180개 unit test·production build가 통과했고, 갱신한 E2E 8개와 OpenSpec validation도 통과했다. 이후 동시에 추가된 별도 `codex-pet` 작업의 미사용 상태와 진행 중 테스트는 이 변경의 검증 범위에 포함하지 않는다.
