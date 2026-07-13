## ADDED Requirements

### Requirement: 설정 기반 GA4 방문 측정
웹 앱은 유효한 `VITE_GA_MEASUREMENT_ID`가 build에 제공된 경우에만 Google tag를 비동기로 초기화하고 최초 document load의 기본 `page_view`를 GA4에 전송해야 한다(MUST). Measurement ID가 없거나 유효하지 않으면 analytics network script를 추가하지 않아야 하며(MUST NOT), 앱은 동일하게 mount되어야 한다(MUST).

#### Scenario: 설정된 production 방문
- **WHEN** `G-` 형식의 measurement ID로 build한 앱을 사용자가 연다
- **THEN** 앱은 해당 ID의 `gtag.js`를 한 번 추가하고 `js`, `config` command를 data layer에 enqueue해야 한다
- **AND** `config` command는 GA4 기본 페이지 측정을 활성화해야 한다

#### Scenario: 설정되지 않은 환경
- **WHEN** measurement ID가 비어 있는 build를 연다
- **THEN** Google analytics script와 command를 만들지 않고 React 앱을 정상적으로 mount해야 한다

#### Scenario: 잘못된 measurement ID
- **WHEN** measurement ID가 허용된 `G-` 형식이 아니다
- **THEN** 외부 analytics script를 요청하거나 잘못된 config command를 보내지 않아야 한다

#### Scenario: Google script 차단
- **WHEN** browser 확장이나 network 정책이 `gtag.js` load를 차단한다
- **THEN** 앱의 화면, package 생성과 download link 동작은 analytics 오류 없이 계속되어야 한다

### Requirement: Pet ZIP 다운로드 클릭 이벤트
웹 앱은 검증된 Codex Pet ZIP 다운로드 링크의 각 사용자 클릭에서 `pet_zip_download` GA4 event를 최대 한 번 전송해야 한다(MUST). Event 전송은 anchor의 기본 Blob download를 취소하거나 기다리게 해서는 안 된다(MUST NOT). Package 생성 성공만으로는 다운로드 event를 전송해서는 안 된다(MUST NOT).

#### Scenario: 검증된 ZIP 다운로드 클릭
- **WHEN** 검증된 package가 준비된 뒤 사용자가 `Codex Pet ZIP 다운로드` 링크를 한 번 누른다
- **THEN** analytics adapter는 `pet_zip_download`를 한 번 enqueue해야 한다
- **AND** browser는 기존 `download` filename과 Blob URL로 다운로드를 계속해야 한다

#### Scenario: 생성 후 다운로드하지 않음
- **WHEN** package 생성과 독립 검증이 성공했지만 사용자가 다운로드 링크를 누르지 않는다
- **THEN** `pet_zip_download` event는 전송되지 않아야 한다

#### Scenario: Analytics 비활성 환경의 다운로드
- **WHEN** measurement ID가 없거나 `window.gtag`를 사용할 수 없는 상태에서 사용자가 다운로드 링크를 누른다
- **THEN** event 전송은 조용히 생략되고 Blob download는 정상적으로 계속되어야 한다

### Requirement: 최소 분석 payload와 비공개 보고
`pet_zip_download` custom event는 Pet 이름·설명·파일명, source URL·경로·캐릭터 식별자 또는 animation mapping을 포함해서는 안 된다(MUST NOT). 앱은 방문이나 다운로드 통계를 보여주는 공개 counter, GA credential 또는 reporting API를 production client에 포함해서는 안 된다(MUST NOT). 운영자는 GA4 property의 접근 제어된 dashboard에서만 수집 결과를 확인해야 한다(MUST).

#### Scenario: 다운로드 event payload 검사
- **WHEN** component test가 다운로드 링크 클릭으로 생성된 analytics command를 검사한다
- **THEN** command에는 `pet_zip_download` event name만 있고 Pet metadata와 source 파생값은 없어야 한다

#### Scenario: 공개 앱 화면
- **WHEN** 사용자가 analytics가 설정된 production 앱을 연다
- **THEN** 앱은 방문자 수나 다운로드 수를 표시하지 않고 GA reporting credential을 browser에 노출하지 않아야 한다
