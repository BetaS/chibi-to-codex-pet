## ADDED Requirements

### Requirement: Garupa 공개 integration 경계

Garupa 전용 manifest, archive importer, source metadata, 오류 adapter, runtime profile 연결과 향후 source UI는 `src/features/livesd/garupa/` 아래에서 소유하고 하나의 공개 entrypoint로 노출해야 한다(MUST). Composition root와 후속 game integration은 이 공개 entrypoint만 사용해야 하며(MUST), 공통 `livesd/model`, `rendering`, runtime facade와 package 계층은 Garupa 내부 module을 import해서는 안 된다(MUST NOT).

#### Scenario: 허용된 dependency 방향
- **WHEN** architecture dependency 검사를 실행한다
- **THEN** `livesd/garupa`는 공통 LiveSD 공개 계약을 import할 수 있고 공통 계층은 `livesd/garupa` 경로를 import하지 않는다

#### Scenario: composition root 연결
- **WHEN** 후속 변경이 Garupa source UI 또는 game integration을 구성한다
- **THEN** composition root는 `livesd/garupa/index.ts` 공개 API만 사용하고 archive·manifest·오류 구현을 deep import하지 않는다

### Requirement: 명시적인 source lifecycle

Garupa source 경계는 canonical ZIP과 승인된 pinned snapshot을 구분해 제공하고 두 경로 모두 명시적인 `불러오기` action에서만 시작해야 한다(MUST). Mount, tab preview, provider manifest import, label 표시와 local file 선택만으로 import·runtime load·network request를 시작해서는 안 된다(MUST NOT). 새 source가 첫 frame까지 성공한 경우에만 active Garupa source와 preview를 원자적으로 교체해야 하며(MUST), 새 import가 실패하면 기존 ready source와 animation·mapping 상태를 유지해야 한다(MUST).

#### Scenario: 초기 idle 상태
- **WHEN** Garupa source container가 mount되고 사용자가 pack을 선택하지 않았다
- **THEN** local pack과 experimental pinned snapshot 안내를 표시하고 import·runtime·외부 request 수는 0이어야 한다

#### Scenario: 명시적 불러오기
- **WHEN** 사용자가 하나의 local canonical ZIP을 선택하고 `불러오기`를 실행한다
- **THEN** integration은 해당 request generation에서만 importer와 runtime preview를 순서대로 시작한다

#### Scenario: 명시적 pinned snapshot 불러오기
- **WHEN** 사용자가 manifest의 repository·commit·권리 상태와 외부 요청 안내를 확인하고 pinned source `불러오기`를 실행한다
- **THEN** integration은 해당 generation에서만 승인 origin의 catalog·asset request와 canonical materialization을 시작한다

#### Scenario: source 교체 실패
- **WHEN** ready Garupa source가 있는 상태에서 새 pack의 import, parse 또는 첫 frame이 실패한다
- **THEN** 기존 source, preview, animation option과 mapping은 유지되고 새 오류만 현재 generation에 표시된다

### Requirement: Provider acquisition adapter와 canonical handoff 분리

Bestdori 직접 URL, 임의 asset mirror, 사용자가 소유한 게임 데이터 또는 Unity AssetBundle에서 canonical ZIP을 만드는 과정은 browser integration 밖의 offline acquisition 책임이어야 한다(MUST). 승인된 `bangdream-live2d` pinned snapshot의 buildData·flattened filename을 해석하는 유일한 예외는 `livesd/garupa/remote` acquisition adapter가 소유해야 하고(MUST), 이 adapter는 검증 뒤 provider-independent canonical handoff만 importer·runtime에 제공해야 한다(MUST). 공통 LiveSD 계층과 rendering은 provider URL, download method, Unity parser와 asset-host별 filename 규칙을 알거나 노출해서는 안 된다(MUST NOT).

#### Scenario: Bestdori에서 만든 canonical pack
- **WHEN** offline 도구가 Bestdori에서 획득한 자산을 canonical ZIP으로 정규화한다
- **THEN** browser integration은 Bestdori provenance와 관계없이 manifest·skeleton·atlas·PNG 계약만으로 pack을 검증한다

#### Scenario: 다른 획득 경로의 pack
- **WHEN** 사용자가 소유한 game data에서 같은 canonical ZIP을 생성한다
- **THEN** browser integration은 provider별 code path 없이 동일 importer와 runtime profile을 사용한다

#### Scenario: 승인 manifest source
- **WHEN** 사용자가 bundled pinned provider를 선택한다
- **THEN** Garupa remote adapter만 exact commit의 snapshot graph를 canonical source로 바꾸고 이후 계층은 provider를 분기하지 않는다

#### Scenario: arbitrary remote URL 입력 방지
- **WHEN** 호출자가 Bestdori, mutable branch 또는 다른 mirror URL을 Garupa source 입력으로 전달한다
- **THEN** 공개 entrypoint는 이를 지원 source로 인정하지 않고 local `File` 또는 bundled pinned provider 선택을 요구한다

### Requirement: 사용자-facing 자산 명칭과 범위

Garupa source의 사용자-facing 명칭은 모든 지원 locale에서 Spine `sdchara` 자산군임을 나타내야 하며(MUST), 실제 라이브 무대용 `characters/livesd` sprite 또는 Live2D 지원으로 오해하게 표시해서는 안 된다(MUST NOT). 오류와 도움말은 `sdchara` Spine pack과 4-frame LIVE sprite의 형식 차이를 설명할 수 있는 stable message key를 사용해야 한다(MUST).

#### Scenario: Garupa source 안내
- **WHEN** 사용자가 Garupa local source 안내를 본다
- **THEN** UI는 `Garupa Spine SD (sdchara)`에 해당하는 locale label과 canonical ZIP 요구사항을 표시한다

#### Scenario: LIVE sprite 오류 안내
- **WHEN** importer가 `GARUPA_LIVE_SPRITE_UNSUPPORTED`를 반환한다
- **THEN** UI는 실제 LIVE sprite가 Spine 형식이 아니며 현재 source에서 사용할 수 없다는 현재 locale의 message를 표시한다

### Requirement: Garupa 오류 소유권과 locale 변환

Garupa pack, runtime과 rendering의 stable code는 Garupa 공개 entrypoint에서 source 독립 UI 진단으로 변환해야 한다(MUST). Raw exception, stack, local absolute path와 ZIP byte를 UI 또는 log에 노출해서는 안 되며(MUST NOT), locale 변경은 code와 source generation을 유지하면서 message만 즉시 갱신해야 한다(MUST).

#### Scenario: 알려진 Garupa 오류
- **WHEN** importer 또는 renderer가 알려진 stable code를 반환한다
- **THEN** 공개 entrypoint는 같은 code, 안전한 구조화 context와 현재 locale의 실행 가능한 message를 제공한다

#### Scenario: 알 수 없는 예외
- **WHEN** Garupa 내부의 알 수 없는 예외가 공개 경계에 도달한다
- **THEN** entrypoint는 raw exception 대신 Garupa 일반 오류 code와 locale message로 정규화한다

#### Scenario: locale 변경
- **WHEN** Garupa 오류가 표시된 상태에서 locale을 변경한다
- **THEN** stable code와 source generation은 유지되고 message만 새 locale로 변경된다

### Requirement: 검증된 branch-wide registry activation

Game source registry의 `garupa` entry는 외부 실제 fixture로 Spine 4.0 parse, straight-alpha edge, animation mapping, paired-eye 16방향, 73-frame package, 독립 설치 preview와 production artifact allowlist가 모두 통과한 증거를 전제로 `available`과 `GarupaSourceIntegration`을 가져야 한다(MUST). 활성화는 dev와 production mode를 분기하지 않고 현재 feature branch의 모든 build에 동일하게 적용해야 하며(MUST), `strr`의 `coming-soon` 상태에는 영향을 주어서는 안 된다(MUST NOT).

#### Scenario: 검증 완료 후 registry 조회
- **WHEN** 앱이 현재 feature branch의 game source registry를 조회한다
- **THEN** `garupa`는 `available`이고 공개 Garupa entrypoint에서 가져온 integration을 가져야 한다
- **AND** `strr`는 `coming-soon`과 integration 없음 상태를 유지해야 한다

#### Scenario: Garupa 탭 선택
- **WHEN** 사용자가 `BanG Dream!` 탭을 선택한다
- **THEN** 앱은 Garupa source panel을 mount하고 탭을 selected 상태로 표시해야 한다
- **AND** mount만으로 importer, runtime 또는 외부 provider request를 시작해서는 안 된다

#### Scenario: production build registry
- **WHEN** production build의 registry와 application chunk를 검사한다
- **THEN** `garupa`는 dev build와 동일하게 선택 가능하고 Spine 4.0 runtime은 명시적 source load에서 lazy load할 수 있어야 한다
- **AND** Garupa 원본 skeleton, atlas, PNG, ZIP과 private fixture는 포함되지 않아야 한다

### Requirement: Garupa 원본 asset 비포함과 provider metadata 허용

Garupa integration source, test, tracked snapshot, documentation과 build configuration은 BanG Dream! 원본 skeleton, atlas, PNG, buildData, Unity bundle 또는 이를 base64·archive로 변형한 byte를 추적 파일에 포함해서는 안 된다(MUST NOT). Exact repository·commit·catalog hash·안전한 relative path·권리 상태를 담은 provider manifest와 acquisition audit metadata는 포함할 수 있다(MAY). 자동 artifact 검사는 production web, package와 CLI에서 고정 Spine runtime JavaScript·license·schema·integration code·provider metadata를 허용하고 Garupa 원본 asset pattern을 거부해야 한다(MUST).

#### Scenario: repository 추적 파일 검사
- **WHEN** Garupa 관련 tracked file과 test fixture를 검사한다
- **THEN** 원본 `.skel`, costume atlas·PNG, buildData, Unity bundle, ZIP과 base64 payload는 없고 승인 manifest·hash metadata만 있을 수 있다

#### Scenario: production allowlist
- **WHEN** production web, package와 CLI artifact 내용을 검사한다
- **THEN** 고정 Spine runtime·license·code·locale·schema·provider metadata 외의 Garupa asset 또는 local backup 도구 산출물이 포함되지 않아야 한다
