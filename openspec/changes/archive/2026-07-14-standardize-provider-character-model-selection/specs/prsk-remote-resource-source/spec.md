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
- **THEN** 시스템은 canonical viewer entry와 `assets.pjsek.ai` asset base를 선택 상태로 표시하고 `불러오기` action을 기다린다

#### Scenario: 명시적 snapshot 불러오기
- **WHEN** 사용자가 provided source에서 `불러오기`를 실행한다
- **THEN** 시스템은 표시한 viewer origin에서 entry HTML과 검증된 hashed main JS만 요청하고 모델·asset API는 요청하지 않는다

#### Scenario: 명시적 캐릭터와 모델 선택
- **WHEN** catalog가 준비된 뒤 사용자가 현재 catalog의 캐릭터 option을 commit한다
- **THEN** 시스템은 해당 캐릭터의 model option만 두 번째 selector에 표시하고 model request를 시작하지 않아야 한다
- **WHEN** 사용자가 현재 캐릭터의 model option을 commit한다
- **THEN** 시스템은 선택된 canonical model ID의 direct PRSK model 로드를 시작해야 한다

#### Scenario: 캐릭터와 모델 검색 상호작용
- **WHEN** 사용자가 두 selector의 query를 입력·삭제하거나 keyboard로 option을 highlight하지만 commit하지 않는다
- **THEN** 시스템은 catalog 또는 model 요청을 시작·취소하지 않고 request generation과 현재 선택을 유지한다

### Requirement: Snapshot provenance와 model 가용성
UI와 문서는 provided character 목록을 불러온 viewer deployment snapshot으로 표시하고(MUST), direct asset server의 model 가용성은 model option commit 시 request 결과로 확인해야 한다(MUST). 선택한 model request가 실패하면 HTTP status를 포함한 stable model 오류를 표시해야 한다(MUST).

#### Scenario: Deployment snapshot 고지
- **WHEN** provided source를 표시하거나 목록을 불러온다
- **THEN** 시스템은 viewer 배포 시점의 snapshot이며 direct asset 가용성과 일치하지 않을 수 있음을 안내한다

#### Scenario: snapshot과 direct asset 불일치
- **WHEN** viewer snapshot의 검증된 model option을 commit했지만 해당 model resource가 direct asset origin에서 HTTP 실패를 반환한다
- **THEN** 시스템은 status를 포함한 `REMOTE_MODEL_HTTP`를 표시하고 활성 session과 두 dropdown 상태를 유지한다

#### Scenario: 선택한 model만 요청
- **WHEN** viewer snapshot option 목록을 성공적으로 만든다
- **THEN** 시스템은 사용자가 commit한 model option의 model만 요청한다

### Requirement: catalog 검증과 검색 가능한 캐릭터·모델 dropdown
시스템은 catalog leaf ID가 ASCII 영숫자로 시작하고 ASCII 영숫자, `_`, `-`, `.`만 포함하는 최대 128자 단일 segment인지 검증해야 한다(MUST). Label은 Unicode code point 기준 1~128자 text로만 렌더링하고, 중복 ID를 거부해야 한다(MUST). Flat leaf option은 locale-sensitive comparator 없이 raw label 오름차순, raw ID 오름차순, 원본 index 오름차순으로 안정적으로 정렬해야 한다(MUST). UI는 검증된 `sd_<character-token>_<model-suffix>` ID의 character token으로 leaf를 동적으로 묶고, suffix가 없거나 형식과 맞지 않는 leaf는 singleton character group으로 보존해야 한다(MUST). 캐릭터와 모델 dropdown은 accessible combobox여야 하고(MUST), 각 query는 visible label 또는 canonical key·ID의 대소문자 무시 substring match로 visible option만 필터링해야 한다(MUST). Query는 선택·catalog·generation·network를 변경해서는 안 된다(MUST NOT).

#### Scenario: catalog 로드 전 dropdown
- **WHEN** provided 또는 custom source에서 유효한 catalog가 준비되지 않았다
- **THEN** 캐릭터 dropdown은 disabled 상태로 목록을 먼저 불러오도록 안내해야 한다
- **AND** 모델 dropdown은 캐릭터를 먼저 선택하도록 안내하는 disabled 상태여야 한다

#### Scenario: 캐릭터별 모델 정규화
- **WHEN** `sd_01sample_normal`, `sd_01sample_street`, `sd_mob001` leaf가 있다
- **THEN** 캐릭터 dropdown은 `sample`과 `mob001`에서 동적으로 만든 두 character option을 표시해야 한다
- **AND** `sample`을 commit한 뒤 model dropdown에는 `normal`과 `street`에서 만든 두 model option만 표시되어야 한다
- **AND** `sd_mob001`은 삭제되지 않고 singleton character group의 model로 선택할 수 있어야 한다

#### Scenario: 캐릭터와 모델 option 검색
- **WHEN** 사용자가 캐릭터 query로 `SAMPLE`을 검색한다
- **THEN** sample character만 표시하고 underlying leaf option·선택을 유지하며 catalog 또는 model 요청을 보내지 않아야 한다
- **WHEN** sample character를 commit하고 model query로 `STREET`을 검색한다
- **THEN** `sd_01sample_street`에 해당하는 model option만 표시하고 commit 전까지 model 요청을 보내지 않아야 한다

#### Scenario: 선택 option으로 popup 자동 스크롤
- **WHEN** 현재 선택한 캐릭터 또는 모델이 긴 정렬 목록의 viewport 밖에 있고 사용자가 해당 combobox를 연다
- **THEN** 시스템은 선택 option을 initial active option으로 표시하고 가장 가까운 listbox scroll 위치로 이동해야 한다
- **AND** popup open과 scroll은 model request를 시작하지 않아야 한다

#### Scenario: 빈 검색어
- **WHEN** 사용자가 캐릭터 또는 모델 query를 모두 지운다
- **THEN** 시스템은 현재 catalog generation과 상위 캐릭터에 해당하는 전체 정렬 option을 복원하고 선택 상태를 변경하지 않아야 한다

#### Scenario: 결과 없음과 자유 입력
- **WHEN** query와 일치하는 option이 없거나 option에 없는 text를 입력한다
- **THEN** 시스템은 `검색 결과 없음`을 표시하고 text를 선택값으로 commit하거나 model을 요청하지 않아야 한다

#### Scenario: 빈 catalog
- **WHEN** strict `sd_` option을 검증한 뒤 사용 가능한 leaf가 없다
- **THEN** 시스템은 `REMOTE_CATALOG_EMPTY`를 표시하고 두 dropdown을 비활성화해야 한다

#### Scenario: 현재 캐릭터에 없는 model 선택
- **WHEN** DOM 조작 또는 stale 상태가 현재 catalog와 선택 캐릭터에 속하지 않는 model ID를 loader에 전달한다
- **THEN** 시스템은 network 요청 전에 selection error로 거부해야 한다

#### Scenario: catalog 재로드 성공
- **WHEN** 새 generation이 이전과 다른 유효한 option으로 성공한다
- **THEN** 시스템은 option 전체를 원자적으로 교체하고 query와 새 목록에 없는 캐릭터·model 선택을 비워야 한다
- **AND** canonical model ID가 남아 있으면 해당 상위 캐릭터와 model 선택을 함께 보존해야 한다

### Requirement: 원격 요청 수명 주기
시스템은 catalog와 model 요청에 독립 request generation과 `AbortController`를 사용해야 한다(MUST). 새 catalog 로드, provider 변경, mode 전환, 캐릭터 변경 또는 unmount는 HTML과 hashed JS를 포함한 무효화된 catalog·model 작업을 취소해야 한다(MUST). 캐릭터·모델 query와 highlight는 generation을 발급하거나 진행 중 요청을 취소해서는 안 된다(MUST NOT).

#### Scenario: HTML 완료 후 bundle 요청 취소
- **WHEN** viewer HTML에서 hashed JS URL을 찾은 뒤 bundle이 진행 중일 때 새 catalog load를 시작한다
- **THEN** 시스템은 이전 catalog signal로 bundle reader를 취소하고 새 generation의 HTML·bundle 결과만 반영한다

#### Scenario: 연속 model 선택
- **WHEN** 첫 model 요청이 진행 중일 때 같은 캐릭터의 다른 model option을 commit한다
- **THEN** 시스템은 첫 model 요청만 취소하고 현재 catalog와 최신 model generation을 유지해야 한다

#### Scenario: Model request failure
- **WHEN** 활성 preview가 있는 상태에서 direct model 입력, skeleton 파싱 또는 첫 frame이 실패한다
- **THEN** 시스템은 기존 preview·animation·두 dropdown의 option·query·selection을 유지하고 새 error만 표시해야 한다
