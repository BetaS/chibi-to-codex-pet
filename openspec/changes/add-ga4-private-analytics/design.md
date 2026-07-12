## Context

현재 앱은 GitHub Pages에 정적 배포되고 Pet ZIP도 browser `Blob` URL에서 직접 내려받으므로 서버 요청만으로 방문과 다운로드 관심도를 알 수 없다. 운영자는 공개 숫자나 자체 저장소 없이 GA4에서 지표를 개인적으로 확인하려고 한다. 분석 기능은 앱 bootstrap과 동적으로 표시되는 다운로드 링크를 가로지르지만 package 생성·검증 계약에는 영향을 주지 않아야 한다.

## Goals / Non-Goals

**Goals:**

- build-time 설정이 있는 배포에서 GA4 기본 페이지 측정을 한 번 초기화한다.
- 검증된 Pet ZIP 다운로드 링크의 사용자 클릭을 `pet_zip_download` 이벤트로 기록한다.
- 측정 설정 누락, 잘못된 ID 또는 Google script 차단이 앱과 다운로드를 방해하지 않게 한다.
- Pet 이름·설명, source URL·파일명·캐릭터 ID 같은 사용자·source 파생값을 분석 이벤트에 포함하지 않는다.
- 운영자가 GitHub Pages 배포용 measurement ID를 설정하고 GA4 dashboard에서만 결과를 확인할 수 있게 문서화한다.

**Non-Goals:**

- 방문·다운로드 숫자의 사이트 공개 표시
- 자체 API, 데이터베이스 또는 server-side analytics 구축
- 실제 OS 파일 저장 완료 보장이나 `npx` 설치 측정
- 광고 기능, 사용자 식별, session replay 또는 세부 Pet 구성 분석
- 이 변경에서 별도의 동의 UI 또는 법률 정책을 결정하는 작업

## Decisions

### Build-time opt-in으로 Google tag 초기화

`src/analytics/ga4.ts`가 `VITE_GA_MEASUREMENT_ID`를 받아 `G-` 형식의 ID만 허용하고, 유효한 값이 있을 때만 `gtag.js`를 비동기로 삽입한다. `src/main.tsx`는 React mount 전에 초기화를 한 번 호출하며 `gtag('config', measurementId)`의 기본 동작으로 최초 `page_view`를 보낸다.

Measurement ID는 공개 client 식별자다. GitHub Pages workflow는 현재 운영 ID를 기본값으로 전달하고, GitHub Actions repository variable `GA_MEASUREMENT_ID`가 있으면 이를 `VITE_GA_MEASUREMENT_ID`로 우선 전달한다. 별도 npm analytics wrapper보다 공식 Google tag의 작은 adapter를 사용해 runtime 의존성과 bundle 변경을 줄인다.

대안으로 `index.html`에 snippet을 직접 넣을 수 있지만 환경변수 검증, 비활성화 테스트와 event API를 한 module에서 관리하기 어렵다. Google Tag Manager는 현재 두 지표에 비해 설정 범위가 크므로 사용하지 않는다.

### 다운로드 링크 클릭을 명시적 이벤트로 측정

다운로드 대상은 file URL이 아니라 동적으로 만든 `blob:` URL이므로 GA4 enhanced measurement의 확장자 기반 자동 감지에 의존하지 않는다. 다운로드 링크의 `onClick`에서 `pet_zip_download`를 한 번 enqueue하고 기존 anchor 기본 동작은 취소하지 않는다. Package 생성 성공만으로는 이벤트를 보내지 않는다.

이벤트에는 상수 기반 event name만 사용하고 Pet metadata, source 식별자와 URL을 넣지 않는다. 브라우저는 실제 파일 저장 완료를 제공하지 않으므로 이 지표의 의미는 "검증된 ZIP 다운로드 링크 클릭"이다.

### 분석을 비차단 best-effort 의존성으로 격리

분석 module은 `window.gtag`가 없으면 event 전송을 조용히 생략한다. Google script가 차단되더라도 data layer enqueue와 anchor download는 예외 없이 진행한다. Builder의 기본 service에 download tracker를 주입해 component test가 외부 script 없이 이벤트 호출 횟수를 검증할 수 있게 한다.

### 공개 reporting surface를 만들지 않음

앱은 GA Data API, 공개 counter endpoint와 통계 UI를 포함하지 않는다. 지표 조회 권한과 보고서는 GA4 property 안에만 유지한다.

## Risks / Trade-offs

- [광고 차단기나 네트워크 정책이 Google tag를 막아 과소 집계할 수 있음] → 분석을 참고 지표로 정의하고 제품 동작과 분리한다.
- [클릭 뒤 사용자가 저장을 취소해도 다운로드로 집계됨] → 이벤트와 문서에서 "다운로드 클릭" 의미를 유지한다.
- [measurement ID가 없으면 배포 후 데이터가 생기지 않음] → `.env.example`, README와 GitHub Actions 설정을 문서화하고 초기화 단위 테스트를 둔다.
- [client event는 자동화나 조작에 의해 부풀려질 수 있음] → 과금·보안 기준이 아닌 제품 관심도 분석에만 사용한다.
- [GA4 기본 수집이 browser·device와 client ID 데이터를 처리함] → 수집 필드를 최소화하고 운영자가 배포 지역에 필요한 개인정보 고지·동의 요건을 별도로 검토하도록 문서화한다.

## Migration Plan

1. GA4 property와 web data stream의 `G-...` measurement ID를 확인한다.
2. GitHub Pages workflow의 기본 ID 또는 Actions variable `GA_MEASUREMENT_ID`를 설정한다.
3. 배포 후 GA4 Realtime/DebugView에서 최초 방문과 `pet_zip_download`를 확인한다.
4. 문제가 있으면 workflow의 measurement ID 설정을 제거하고 다시 배포해 분석 초기화를 비활성화한다. 앱 기능과 저장 데이터 migration은 없다.

## Open Questions

없음.
