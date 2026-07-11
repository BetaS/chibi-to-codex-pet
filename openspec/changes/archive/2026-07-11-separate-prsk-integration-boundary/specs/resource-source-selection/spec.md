## ADDED Requirements

### Requirement: 기본 제공 resource manifest 우선 선택
프로세카 integration은 `provided`, `upload`, `custom` resource source를 제공해야 하며(SHALL), 페이지 진입 시 기본값은 기본 제공 resource manifest를 사용하는 `provided`여야 한다(MUST). 초기 provided 설정은 `prsk-chibi-viewer` manifest와 검증된 direct asset base를 가리켜야 한다(MUST).

#### Scenario: 프로세카 초기 resource 상태
- **WHEN** 사용자가 앱에 처음 진입하고 `프로세카` 탭이 선택된다
- **THEN** resource source는 `provided`가 선택되어야 한다
- **AND** UI는 기본 제공 `prsk-chibi-viewer` manifest와 요청 대상 origin을 표시해야 한다
- **AND** local file picker 또는 custom URL을 기본 필수 입력으로 요구해서는 안 된다

#### Scenario: 게임 탭과 resource 기본값
- **WHEN** 프로세카 integration이 새로 mount된다
- **THEN** resource selector는 PRSK의 canonical provided entry를 사용해야 한다
- **AND** 표시명 문자열이나 이전 게임 상태로 provider를 추론해서는 안 된다

### Requirement: 선택적인 resource 업로드
사용자는 기본 provided source 대신 `upload`를 선택해 local shared skeleton과 character ZIP을 사용할 수 있어야 한다(MUST). Upload source의 파일은 기존 browser-only importer 계약을 따라야 하며(MUST), 외부 provider로 전송되어서는 안 된다(MUST NOT).

#### Scenario: upload source 선택
- **WHEN** 사용자가 `upload`를 선택한다
- **THEN** UI는 shared `.skel`과 character ZIP 입력 및 local 불러오기 action을 표시해야 한다
- **AND** provided/custom catalog나 model request를 시작해서는 안 된다

#### Scenario: production upload 입력 누락
- **WHEN** production에서 사용자가 `upload`를 선택했지만 필수 local 파일을 준비하지 않았다
- **THEN** local 불러오기 action은 실행할 수 없어야 한다
- **AND** 시스템은 provided source로 암묵적으로 fallback해서는 안 된다

### Requirement: 선택적인 custom resource provider
사용자는 `custom` source를 선택해 검증된 asset base URL의 `catalog.json` provider를 사용할 수 있어야 한다(MUST). Custom source 선택은 이전 provided catalog, character 선택과 진행 중 요청을 무효화해야 하며(MUST), URL 입력만으로 요청을 시작해서는 안 된다(MUST NOT).

#### Scenario: custom provider 선택
- **WHEN** 사용자가 `custom`을 선택하고 asset base URL을 입력한다
- **THEN** UI는 정규화 가능한 요청 origin을 표시해야 한다
- **AND** 사용자가 `불러오기`를 실행하기 전까지 catalog를 요청해서는 안 된다

#### Scenario: provided로 복귀
- **WHEN** 사용자가 custom source에서 provided source로 전환한다
- **THEN** custom catalog와 character 선택을 무효화해야 한다
- **AND** canonical `prsk-chibi-viewer` 설정을 선택 상태로 복원하되 자동 요청해서는 안 된다

### Requirement: 단일 불러오기 동작
Provided와 custom resource UI는 현재 선택된 provider의 catalog를 요청하는 primary action을 `불러오기` 하나만 제공해야 한다(MUST). `prsk-chibi-viewer 사용`과 같은 별도 preset 적용 버튼을 제공해서는 안 된다(MUST NOT).

#### Scenario: 기본 provided 불러오기
- **WHEN** 초기 provided 상태에서 사용자가 `불러오기`를 한 번 누른다
- **THEN** 시스템은 canonical `prsk-chibi-viewer` provider를 resolve하고 catalog HTML과 검증된 bundle을 요청해야 한다
- **AND** 동일 action을 완료하기 위해 별도 provider 사용 버튼을 요구해서는 안 된다

#### Scenario: custom 불러오기
- **WHEN** 유효한 custom asset base가 선택된 상태에서 사용자가 `불러오기`를 누른다
- **THEN** 시스템은 해당 base의 `catalog.json`만 요청해야 한다

#### Scenario: 불러오는 중 중복 실행
- **WHEN** catalog 요청이 진행 중이다
- **THEN** `불러오기` action은 중복 request generation을 만들 수 없도록 비활성화되어야 한다
- **AND** loading 상태를 programmatic text로 알려야 한다

### Requirement: 페이지 진입 시 resource 무자동갱신
페이지 최초 진입, React mount/remount 또는 game integration mount만으로 catalog fetch, model fetch, local development asset import, preview 생성이나 build를 시작해서는 안 된다(MUST NOT). Resource 작업은 사용자가 현재 source의 `불러오기` 또는 local preview action을 명시적으로 실행한 뒤에만 시작해야 한다(MUST).

#### Scenario: 최초 페이지 진입
- **WHEN** 앱이 최초 mount된다
- **THEN** provided source가 선택된 idle UI를 표시해야 한다
- **AND** catalog, model, development asset 또는 기타 외부 resource 요청 수는 0이어야 한다
- **AND** WebGL preview session을 생성해서는 안 된다

#### Scenario: StrictMode remount
- **WHEN** development React StrictMode가 component lifecycle을 다시 실행한다
- **THEN** catalog, model 또는 local development preview를 자동으로 중복 실행해서는 안 된다

#### Scenario: 페이지 재진입 또는 hard refresh
- **WHEN** 사용자가 페이지를 다시 열거나 browser hard refresh 후 앱이 mount된다
- **THEN** 시스템은 provided idle 상태에서 시작해야 한다
- **AND** 이전 catalog를 자동 갱신하거나 이전 character model을 자동 복원·요청해서는 안 된다

#### Scenario: 명시적 불러오기 이후
- **WHEN** 사용자가 idle provided 상태에서 `불러오기`를 실행한다
- **THEN** 그 action에 대해서만 catalog request generation을 한 번 시작해야 한다

### Requirement: 기존 개인정보 및 fallback 경계 보존
Resource selector 변경은 provider 응답, 사용자 파일 bytes, URL 또는 선택 character를 persistent storage에 저장해서는 안 된다(MUST NOT). Provided/custom 오류 또는 upload 오류가 다른 source를 자동 선택하거나 요청하게 해서는 안 된다(MUST NOT).

#### Scenario: 새로고침 후 저장 데이터 비사용
- **WHEN** 이전 세션에서 catalog 또는 model을 불러온 뒤 페이지를 새로고침한다
- **THEN** 앱은 persistent catalog, model bytes 또는 사용자 URL을 읽어 복원해서는 안 된다

#### Scenario: source 실패 격리
- **WHEN** 현재 선택된 source의 불러오기가 실패한다
- **THEN** 오류는 현재 source에 표시되어야 한다
- **AND** provided, custom 또는 upload 중 다른 source로 자동 fallback해서는 안 된다
