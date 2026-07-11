# PRSK 원격 리소스 소스 명세

## Purpose

Provided 또는 custom PRSK provider에서 character catalog와 LiveSD model을 browser로 직접 불러온다. 이 capability는 사용자 trigger, catalog 형식, model URL, request 보안·개인정보·자원 제한과 lifecycle을 담당한다.

## Requirements

### Requirement: 명시적 원격 소스 선택
원격 catalog source는 `provided`와 `custom`이며 resource selector의 초기값은 `provided`여야 한다(MUST). Catalog request는 사용자가 `불러오기`를 실행할 때 시작하고(MUST), model request는 현재 catalog의 검증된 dropdown option을 commit할 때 시작해야 한다(MUST). 페이지 진입과 검색 interaction은 selected source의 idle 또는 현재 request state를 유지해야 한다(MUST).

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

#### Scenario: 명시적 캐릭터 선택
- **WHEN** catalog가 준비된 뒤 사용자가 현재 catalog의 캐릭터 option을 commit한다
- **THEN** 시스템은 선택된 캐릭터의 direct PRSK model 로드를 시작한다

#### Scenario: 캐릭터 검색 상호작용
- **WHEN** 사용자가 캐릭터 query를 입력·삭제하거나 keyboard로 option을 highlight하지만 commit하지 않는다
- **THEN** 시스템은 catalog 또는 model 요청을 시작·취소하지 않고 request generation과 현재 선택을 유지한다

### Requirement: custom catalog와 viewer deployment snapshot 계약
`PrskRemoteCatalogSource`가 지원하는 catalog 입력은 custom provider의 정규화 asset base URL `B`와 같은 origin·base path의 `B/catalog.json`, 또는 provided source의 `https://prsk-chibi-viewer.vercel.app/` entry HTML이다(MUST). Viewer HTML에서 정확히 하나의 safe same-origin hashed main JS를 찾고, bundle을 text로 읽어 strict embedded chibi option record를 공통 `PrskRemoteCharacterOption`으로 정규화해야 한다(MUST). Catalog resolution은 선택된 입력 하나를 사용하며 오류가 발생하면 stable catalog error를 반환해야 한다(MUST).

#### Scenario: custom catalog manifest
- **WHEN** `B/catalog.json`이 `version: 1`과 `characters` 배열을 포함한 유효한 manifest를 반환한다
- **THEN** 시스템은 각 `{ id, label }`을 검증해 custom provider dropdown option으로 사용한다

#### Scenario: 지원하지 않는 manifest version
- **WHEN** custom catalog의 `version`이 숫자 `1`이 아니다
- **THEN** 시스템은 지원하지 않는 catalog version 오류를 반환하고 dropdown을 활성화하지 않는다

#### Scenario: safe hashed main JS 발견
- **WHEN** viewer entry HTML에 `src="/static/js/main.8ca0b7b5.js"`처럼 pathname이 `^/static/js/main\.[0-9a-f]{8}\.js$`인 same-origin script가 정확히 하나 있다
- **THEN** 시스템은 해당 URL을 viewer entry 기준으로 해석하고 그 bundle만 catalog snapshot source로 요청한다

#### Scenario: unsafe 또는 모호한 main JS
- **WHEN** main script candidate가 없거나 두 개 이상이거나, 다른 origin·username·password·query·fragment 또는 unhashed path를 사용한다
- **THEN** 시스템은 스크립트를 요청·실행하지 않고 부재·복수 candidate에는 `REMOTE_CATALOG_INVALID`, origin·query·fragment 위반에는 `REMOTE_CATALOG_ORIGIN_INVALID`를 반환한다

#### Scenario: strict embedded chibi option record
- **WHEN** hashed JS text에 공백·추가 key가 없는 raw 또는 quote-escaped `{ "value": "sd_*", "label": "sd_*" }` record가 있다
- **THEN** 시스템은 안전한 최대 128자 `sd_` ID이고 `label === value`인 record만 dedupe해 캐릭터 option으로 검증한다

#### Scenario: Viewer JavaScript text 처리
- **WHEN** viewer hashed JS를 성공적으로 다운로드한다
- **THEN** 시스템은 bundle을 strict text scanner의 data input으로 처리한다
- **AND** `eval`, `Function`, dynamic import, script·iframe 주입과 Blob URL 실행 경로가 없어야 한다

#### Scenario: viewer snapshot 구조 변경
- **WHEN** hashed JS text에 usable strict `sd_` record가 없거나 label·ID grammar이 다르다
- **THEN** 시스템은 `REMOTE_CATALOG_INVALID` 또는 `REMOTE_CATALOG_EMPTY`를 반환하고 현재 source를 error 상태로 유지한다

#### Scenario: Character option DTO 범위
- **WHEN** viewer bundle이 캐릭터 option 외에 animation 이름 배열을 포함한다
- **THEN** catalog DTO와 UI option은 검증된 character ID, label과 provenance field로 구성된다

#### Scenario: Custom base URL 편집
- **WHEN** 사용자가 `custom` source에서 asset base URL을 변경한다
- **THEN** 시스템은 custom catalog state를 새 generation으로 전환하고 변경된 base URL의 `catalog.json`을 다음 불러오기 대상으로 표시한다

### Requirement: Snapshot provenance와 model 가용성
UI와 문서는 provided character 목록을 불러온 viewer deployment snapshot으로 표시하고(MUST), direct asset server의 model 가용성은 character 선택 시 request 결과로 확인해야 한다(MUST). 선택한 model request가 실패하면 HTTP status를 포함한 stable model 오류를 표시해야 한다(MUST).

#### Scenario: Deployment snapshot 고지
- **WHEN** provided source를 표시하거나 목록을 불러온다
- **THEN** 시스템은 viewer 배포 시점의 snapshot이며 direct asset 가용성과 일치하지 않을 수 있음을 안내한다

#### Scenario: snapshot과 direct asset 불일치
- **WHEN** viewer snapshot의 검증된 option을 commit했지만 해당 model resource가 direct asset origin에서 HTTP 실패를 반환한다
- **THEN** 시스템은 status를 포함한 `REMOTE_MODEL_HTTP`를 표시하고 활성 session과 dropdown 상태를 유지한다

#### Scenario: 선택한 model만 요청
- **WHEN** viewer snapshot option 목록을 성공적으로 만든다
- **THEN** 시스템은 사용자가 commit한 option의 model만 요청한다

### Requirement: catalog 검증과 검색 가능한 캐릭터 dropdown
시스템은 catalog option ID가 ASCII 영숫자로 시작하고 ASCII 영숫자, `_`, `-`, `.`만 포함하는 최대 128자 단일 segment인지 검증해야 한다(MUST). label은 1~128자 text로만 렌더링하고, 중복 ID를 거부하며, option을 label과 ID 순서로 안정적으로 정렬해야 한다(MUST). dropdown은 accessible combobox여야 하고(MUST), query는 label 또는 ID의 대소문자 무시 substring match로 visible option만 필터링해야 한다(MUST). query는 선택·catalog·generation·network를 변경해서는 안 된다(MUST NOT).

#### Scenario: catalog 로드 전 dropdown
- **WHEN** provided 또는 custom source에서 유효한 catalog가 준비되지 않았다
- **THEN** 캐릭터 dropdown은 disabled 상태로 목록을 먼저 불러오도록 안내한다

#### Scenario: 캐릭터 option 검색
- **WHEN** `sd_01sample_normal`, `sd_01sample_street`, `sd_mob001`이 있고 사용자가 `SAMPLE`을 검색한다
- **THEN** 시스템은 앞의 두 option만 표시하고 underlying option·선택을 유지하며 catalog 또는 model 요청을 보내지 않는다

#### Scenario: 빈 검색어
- **WHEN** 사용자가 캐릭터 query를 모두 지운다
- **THEN** 시스템은 현재 catalog generation의 전체 정렬 option을 복원하고 선택 상태를 변경하지 않는다

#### Scenario: 결과 없음과 자유 입력
- **WHEN** query와 일치하는 option이 없거나 option에 없는 text를 입력한다
- **THEN** 시스템은 `검색 결과 없음`을 표시하고 text를 선택값으로 commit하거나 model을 요청하지 않는다

#### Scenario: 빈 catalog
- **WHEN** strict `sd_` option을 검증한 뒤 사용 가능한 캐릭터가 없다
- **THEN** 시스템은 `REMOTE_CATALOG_EMPTY`를 표시하고 dropdown을 비활성화한다

#### Scenario: catalog에 없는 option 선택
- **WHEN** DOM 조작 또는 stale 상태가 현재 catalog에 없는 ID를 model loader에 전달한다
- **THEN** 시스템은 network 요청 전에 selection error로 거부한다

#### Scenario: catalog 재로드 성공
- **WHEN** 새 generation이 이전과 다른 유효한 option으로 성공한다
- **THEN** 시스템은 option 전체를 원자적으로 교체하고 query와 새 목록에 없는 선택을 비운다

### Requirement: PRSK 호환 direct model URL 계약
`PrskRemoteResourceSource`는 catalog의 asset base URL `B`와 현재 dropdown에서 commit·재검증된 ID `C`로 `B/base_model/sekai_skeleton.skel`, `B/C/sekai_atlas.atlas`과 atlas가 참조하는 PNG만 요청해야 한다(MUST). Provided source의 `B`는 `https://assets.pjsek.ai/file/pjsekai-assets/startapp/area_sd`이며 model byte는 이 direct asset origin에서 읽어야 한다(MUST).

#### Scenario: viewer snapshot의 direct asset model
- **WHEN** viewer snapshot에서 `sd_01ichika_normal`을 commit한다
- **THEN** 시스템은 `assets.pjsek.ai` asset base의 공통 skeleton과 해당 character atlas·PNG만 직접 요청한다

#### Scenario: nested PNG page
- **WHEN** atlas가 `textures/sekai_atlas.png`를 참조한다
- **THEN** 시스템은 `B/C/textures/sekai_atlas.png`를 요청하고 정규화된 경로를 page key로 사용한다

### Requirement: 원격 URL 보안 경계
시스템은 production에서 username·password·query·fragment가 없는 HTTPS asset base만 허용해야 하고(MUST), localhost 계열과 판별 가능한 loopback·private·link-local IP literal을 거부해야 한다(MUST). Development는 localhost, `127.0.0.1`, `[::1]`의 HTTP를 허용해야 한다(MUST). Viewer catalog origin은 provided source에 고정하고 hashed JS는 viewer와 same-origin이어야 하며(MUST), 모든 요청은 `redirect: 'error'`를 사용해야 한다(MUST).

#### Scenario: 승인되지 않은 viewer bundle origin
- **WHEN** viewer HTML이 다른 origin의 hashed 또는 unhashed JS를 지시한다
- **THEN** 시스템은 해당 JS를 요청하지 않고 `REMOTE_CATALOG_ORIGIN_INVALID`를 반환한다

#### Scenario: atlas page path escape
- **WHEN** atlas page가 `../`, absolute URL 또는 다른 origin으로 `B/C/` 밖을 가리킨다
- **THEN** 시스템은 해당 page를 요청하지 않고 unsafe path error를 반환한다

#### Scenario: redirect response
- **WHEN** HTML, JS, custom catalog, skeleton, atlas 또는 PNG 요청이 redirect를 반환한다
- **THEN** 시스템은 redirect를 따라가지 않고 구분된 redirect error로 중단한다

### Requirement: 원격 요청 개인정보 보호
모든 원격 catalog 및 model 요청은 `mode: 'cors'`, `credentials: 'omit'`, `referrerPolicy: 'no-referrer'`, `redirect: 'error'`와 현재 `AbortSignal`을 사용해야 한다(MUST). 시스템은 응답을 앱 backend로 proxy·upload하지 않아야 하고(MUST NOT), 요청 전에 viewer/catalog과 asset origin을 모두 표시해야 한다(MUST).

#### Scenario: viewer catalog fetch policy
- **WHEN** viewer snapshot 목록을 불러온다
- **THEN** HTML과 JS 요청은 credentials·referrer 없이 redirect를 거부하고 같은 catalog signal을 사용한다

#### Scenario: client direct request
- **WHEN** viewer snapshot catalog와 선택 model을 성공적으로 불러온다
- **THEN** HTML·JS와 asset 바이트는 각각 표시된 제3자 origin에서 브라우저 메모리로 직접 전달되고 앱 서버에는 전송되지 않는다

### Requirement: 원격 자원 제한
시스템은 catalog와 model 작업에 각각 20초 timeout을 적용해야 한다(MUST). custom JSON은 fatal UTF-8 1MiB, viewer HTML과 hashed JS는 각각 fatal UTF-8이며 두 응답 합계 1MiB, 정규화 character option은 1,000개로 제한해야 한다(MUST). skeleton은 8MiB, atlas는 fatal UTF-8 1MiB, PNG는 32개·합계 64MiB와 valid signature로 제한해야 한다(MUST).

#### Scenario: viewer HTML size rejection
- **WHEN** viewer HTML의 `Content-Length` 또는 stream 누적 크기가 catalog 1MiB 제한을 초과한다
- **THEN** 시스템은 main JS를 요청하기 전에 size error로 catalog 작업을 중단한다

#### Scenario: viewer JS size rejection
- **WHEN** HTML byte 수와 hashed JS의 `Content-Length` 또는 stream 누적 크기 합계가 1MiB를 초과한다
- **THEN** 시스템은 body 전체를 파싱하지 않고 size error로 catalog 작업을 중단한다

#### Scenario: viewer option count limit
- **WHEN** dedupe한 strict `sd_` character가 1,000개를 초과한다
- **THEN** 시스템은 item limit error를 반환하고 dropdown을 활성화하지 않는다

#### Scenario: model stream limit
- **WHEN** `Content-Length`가 없지만 자원 stream 누적 크기가 skeleton·atlas·PNG 제한을 초과한다
- **THEN** 시스템은 reader와 나머지 model 요청을 취소하고 size error를 반환한다

#### Scenario: catalog timeout
- **WHEN** viewer HTML과 hashed JS를 포함한 catalog 작업이 20초 안에 완료되지 않는다
- **THEN** 시스템은 진행 중 body reader와 요청을 취소하고 timeout error를 반환한다

### Requirement: 원격 입력 정규화
`PrskRemoteCatalogSource`는 provider label, asset base URL, viewer/catalog과 asset request origin, 정렬된 read-only character option을 포함한 `PrskRemoteCatalog`를 반환해야 한다(MUST). `PrskRemoteResourceSource`는 원본 skeleton `ArrayBuffer`, source origin과 runtime-independent `LiveSDAtlasBundle`을 반환해야 한다(MUST). Catalog DTO는 character와 provenance metadata로, model DTO는 runtime-independent model input으로 제한해야 한다(MUST).

#### Scenario: viewer snapshot normalization success
- **WHEN** viewer HTML, hashed JS URL, strict chibi record, URL·자원·option 검증이 모두 성공한다
- **THEN** 시스템은 viewer와 asset origin을 포함하고 검증된 `sd_` option만 가진 정렬된 `PrskRemoteCatalog`를 반환한다

#### Scenario: 공통 LiveSD adapter 사용
- **WHEN** direct asset model 입력으로 preview를 생성한다
- **THEN** 시스템은 공통 version 검사, NUL padding, WebGL 구성과 skeleton 기반 animation 탐색을 사용한다

#### Scenario: animation 목록 비소유
- **WHEN** catalog source와 model source가 결과 DTO를 반환한다
- **THEN** DTO에는 viewer snapshot의 animation 목록이 없고 `LiveSD36Adapter` 파싱 결과가 animation dropdown의 유일한 option source가 된다

### Requirement: 원격 요청 수명 주기
시스템은 catalog와 model 요청에 독립 request generation과 `AbortController`를 사용해야 한다(MUST). 새 catalog 로드, provider 변경, mode 전환 또는 unmount는 HTML과 hashed JS를 포함한 이전 catalog·model 작업을 취소해야 한다(MUST). query·highlight는 generation을 발급하거나 진행 중 요청을 취소해서는 안 된다(MUST NOT).

#### Scenario: HTML 완료 후 bundle 요청 취소
- **WHEN** viewer HTML에서 hashed JS URL을 찾은 뒤 bundle이 진행 중일 때 새 catalog load를 시작한다
- **THEN** 시스템은 이전 catalog signal로 bundle reader를 취소하고 새 generation의 HTML·bundle 결과만 반영한다

#### Scenario: 연속 character selection
- **WHEN** 첫 model 요청이 진행 중일 때 다른 option을 commit한다
- **THEN** 시스템은 첫 model 요청만 취소하고 현재 catalog와 최신 model generation을 유지한다

#### Scenario: Model request failure
- **WHEN** 활성 preview가 있는 상태에서 direct model 입력, skeleton 파싱 또는 첫 frame이 실패한다
- **THEN** 시스템은 기존 preview·animation·두 dropdown의 option·query·selection을 유지하고 새 error만 표시한다

### Requirement: 구분 가능한 remote source error
시스템은 provider URL, custom catalog schema·version, viewer entry·record 구조, empty·item limit, selection, HTTP, redirect, CORS/network, timeout, unsafe path, resource limit와 content failure를 stable error code와 현재 locale의 message로 반환해야 한다(MUST). CORS와 일반 network failure는 `REMOTE_NETWORK_OR_CORS`로 함께 표현해야 한다(MUST).

#### Scenario: viewer entry structure error
- **WHEN** HTML에서 safe unique hashed main JS를 확정할 수 없다
- **THEN** 시스템은 `REMOTE_CATALOG_INVALID` 또는 `REMOTE_CATALOG_ORIGIN_INVALID`와 viewer 배포 구조를 확인하라는 message를 표시한다

#### Scenario: viewer snapshot structure error
- **WHEN** JS text에서 usable strict character option record를 만들 수 없다
- **THEN** 시스템은 `REMOTE_CATALOG_INVALID` 또는 `REMOTE_CATALOG_EMPTY`와 snapshot adapter 구조가 변경되었음을 알리는 message를 표시한다

#### Scenario: Catalog source failure
- **WHEN** viewer catalog 요청이 HTTP, CORS, structure 또는 content error로 실패한다
- **THEN** 시스템은 선택한 provided catalog를 error 상태로 유지한다
- **AND** 다음 request는 사용자가 provided 또는 custom source에서 `불러오기`를 다시 실행할 때 시작한다

#### Scenario: user-replaced request
- **WHEN** 새 요청, provider 변경 또는 mode 전환으로 이전 요청이 abort된다
- **THEN** 시스템은 abort를 사용자 error로 표시하지 않고 stale generation의 상태 변경을 무시한다
