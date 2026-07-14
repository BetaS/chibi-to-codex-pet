## MODIFIED Requirements

### Requirement: 명시적 원격 소스 선택
원격 catalog source는 `provided`와 `custom`이며 resource selector의 초기값은 `provided`여야 한다(MUST). 새 세션에서는 catalog request가 사용자의 character list `불러오기` 실행으로 시작되고(MUST), model request는 현재 catalog에서 정규화한 캐릭터를 commit한 뒤 그 캐릭터의 검증된 model option을 commit할 때 시작해야 한다(MUST). 저장 preset에 검증된 원격 provider와 canonical model ID가 있으면 저장 option 선택이 아니라 별도 `프리셋 불러오기` 실행이 catalog와 model 요청을 순서대로 시작하고 두 selector를 복원해야 한다(MUST). Source 없는 page 진입, 저장 preset option 선택과 두 selector의 검색 interaction은 selected source의 idle 또는 현재 request state를 유지해야 한다(MUST).

#### Scenario: 저장 원격 preset 명시적 요청
- **WHEN** 사용자가 provided 또는 custom source와 canonical model ID가 저장된 preset을 선택한 뒤 `프리셋 불러오기`를 실행한다
- **THEN** 시스템은 저장 provider로 catalog를 요청한 뒤 저장 model ID가 속한 캐릭터와 모델 선택을 복원하고 해당 model을 요청해야 한다
- **AND** 별도의 character list `불러오기` 또는 selector commit을 요구해서는 안 된다

#### Scenario: 저장 원격 preset 선택만 수행
- **WHEN** 사용자가 저장 원격 preset option을 선택했지만 `프리셋 불러오기`를 실행하지 않았다
- **THEN** catalog와 model request는 모두 0건이고 character list `불러오기`는 비활성이어야 한다

#### Scenario: 초기 provided 화면
- **WHEN** 사용자가 앱을 열고 원격 동작을 실행하지 않는다
- **THEN** 시스템은 request가 없는 `provided` idle 상태와 `불러오기` action을 표시한다

#### Scenario: Custom asset base placeholder
- **WHEN** custom URL 입력이 비어 있다
- **THEN** 시스템은 `https://assets.pjsek.ai/file/pjsekai-assets/startapp/area_sd`를 placeholder로만 표시하고 실제 입력값이나 요청 대상으로 사용하지 않는다

#### Scenario: Provided source 선택
- **WHEN** resource selector에서 `provided`를 선택한다
- **THEN** 시스템은 provided source 설명과 `불러오기` action을 표시하고 canonical viewer·catalog URL 또는 asset origin을 별도 UI 행으로 노출하지 않는다

#### Scenario: 명시적 snapshot 불러오기
- **WHEN** 사용자가 provided source에서 `불러오기`를 실행한다
- **THEN** 시스템은 내부에 고정·검증된 viewer origin에서 entry HTML과 검증된 hashed main JS만 요청하고 모델·asset API는 요청하지 않는다

#### Scenario: 명시적 캐릭터와 모델 선택
- **WHEN** catalog가 준비된 뒤 사용자가 현재 catalog의 캐릭터 option을 commit한다
- **THEN** 시스템은 해당 캐릭터의 model option만 두 번째 selector에 표시하고 model request를 시작하지 않아야 한다
- **WHEN** 사용자가 현재 캐릭터의 model option을 commit한다
- **THEN** 시스템은 선택된 canonical model ID의 direct PRSK model 로드를 시작해야 한다

#### Scenario: 캐릭터와 모델 검색 상호작용
- **WHEN** 사용자가 두 selector의 query를 입력·삭제하거나 keyboard로 option을 highlight하지만 commit하지 않는다
- **THEN** 시스템은 catalog 또는 model 요청을 시작·취소하지 않고 request generation과 현재 선택을 유지한다

### Requirement: 원격 요청 개인정보 보호
모든 원격 catalog 및 model 요청은 `mode: 'cors'`, `credentials: 'omit'`, `referrerPolicy: 'no-referrer'`, `redirect: 'error'`와 현재 `AbortSignal`을 사용해야 한다(MUST). 시스템은 응답을 앱 backend로 proxy·upload하지 않아야 한다(MUST NOT). Custom source는 사용자가 요청 대상을 제어할 수 있도록 asset base URL input을 표시해야 하고(MUST), provided source는 canonical viewer·catalog URL과 asset origin을 별도 UI 행으로 직접 노출하지 않으면서 외부 서버에 연결된다는 고지를 표시해야 한다(MUST).

#### Scenario: viewer catalog fetch policy
- **WHEN** viewer snapshot 목록을 불러온다
- **THEN** HTML과 JS 요청은 credentials·referrer 없이 redirect를 거부하고 같은 catalog signal을 사용한다

#### Scenario: client direct request
- **WHEN** viewer snapshot catalog와 선택 model을 성공적으로 불러온다
- **THEN** HTML·JS와 asset 바이트는 각각 검증된 제3자 origin에서 브라우저 메모리로 직접 전달되고 앱 서버에는 전송되지 않는다

#### Scenario: Provided URL 비노출
- **WHEN** 사용자가 provided source를 표시하거나 catalog를 불러온다
- **THEN** UI는 외부 서버 연결 고지를 유지하면서 canonical viewer·catalog URL과 asset origin text를 렌더링하지 않아야 한다

#### Scenario: Custom URL 입력 유지
- **WHEN** 사용자가 custom source를 선택한다
- **THEN** UI는 사용자가 catalog와 model request base를 입력·검토할 수 있는 asset base URL input을 표시해야 한다
