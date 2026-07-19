# 비공개 제품 분석 명세

## Purpose

운영자는 앱과 다운로드 동작을 방해하거나 공개 통계를 노출하지 않으면서 설정된 production build의 방문, 주요 UI 상호작용, 캐릭터·모델 선택과 검증된 Codex Pet ZIP 다운로드 클릭을 최소 payload로 측정한다.

## Requirements

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

### Requirement: 주요 UI와 catalog 선택 이벤트

웹 앱은 사용자가 게임 탭을 선택할 때 `game_select`, 추적 대상으로 지정한 주요 버튼을 누를 때 `button_click`, 제공자 catalog의 캐릭터 또는 모델을 선택할 때 각각 `character_select`, `model_select` GA4 event를 전송해야 한다(MUST). 각 event는 번역된 화면 문구가 아니라 안정적인 ID를 사용해야 하며(MUST), 자동 preset 복원이나 단순 화면 render를 사용자 선택으로 기록해서는 안 된다(MUST NOT).

#### Scenario: 게임과 주요 버튼 선택
- **WHEN** 사용자가 지원되는 게임 탭 또는 catalog 불러오기·프리셋·생성·취소·미리보기 같은 추적 대상 control을 누른다
- **THEN** adapter는 각각 `game_id` 또는 고정된 `button_id`를 포함한 선택 event를 한 번 enqueue해야 한다
- **AND** locale 또는 Pet 상태처럼 고정된 세부 선택값이 있으면 안전한 `button_value`로만 전송해야 한다

#### Scenario: 고정 provider 캐릭터와 모델 선택
- **WHEN** 사용자가 앱이 검증한 provider catalog에서 캐릭터 또는 모델을 선택한다
- **THEN** adapter는 `game_id`, `source_type`과 해당 catalog의 안정적인 `character_id` 또는 `model_id`를 포함한 event를 한 번 enqueue해야 한다

#### Scenario: 사용자 지정 provider 선택
- **WHEN** 사용자가 직접 입력한 provider에서 캐릭터 또는 모델을 선택한다
- **THEN** adapter는 사용자 지정 catalog의 raw ID 대신 `custom` 분류값만 전송해야 한다

#### Scenario: Analytics 비활성 환경의 상호작용
- **WHEN** `window.gtag`를 사용할 수 없거나 event enqueue가 실패한 상태에서 사용자가 추적 대상 control을 사용한다
- **THEN** event 전송은 조용히 생략되고 원래 UI 동작은 계속되어야 한다

### Requirement: 최소 분석 payload와 비공개 보고

`pet_zip_download` custom event는 Pet 이름·설명·파일명, source URL·경로·캐릭터 식별자 또는 animation mapping을 포함해서는 안 된다(MUST NOT). 다른 interaction event도 Pet 이름·설명·파일명, 로컬 경로, 사용자가 입력한 URL·label·검색어 또는 animation mapping을 포함해서는 안 되며(MUST NOT), 허용된 고정 UI ID와 검증된 기본·pinned provider catalog ID만 전송해야 한다(MUST). 앱은 방문이나 다운로드 통계를 보여주는 공개 counter, GA credential 또는 reporting API를 production client에 포함해서는 안 된다(MUST NOT). 운영자는 GA4 property의 접근 제어된 dashboard에서만 수집 결과를 확인해야 한다(MUST).

#### Scenario: 다운로드 event payload 검사
- **WHEN** component test가 다운로드 링크 클릭으로 생성된 analytics command를 검사한다
- **THEN** command에는 `pet_zip_download` event name만 있고 Pet metadata와 source 파생값은 없어야 한다

#### Scenario: Interaction event payload 검사
- **WHEN** component test가 게임·버튼·캐릭터·모델 선택으로 생성된 analytics command를 검사한다
- **THEN** command에는 허용된 event ID와 고정 UI 또는 검증된 provider catalog 식별자만 있어야 한다
- **AND** 사용자 입력 문자열과 번역된 label은 없어야 한다

#### Scenario: 공개 앱 화면
- **WHEN** 사용자가 analytics가 설정된 production 앱을 연다
- **THEN** 앱은 방문자 수나 다운로드 수를 표시하지 않고 GA reporting credential을 browser에 노출하지 않아야 한다
