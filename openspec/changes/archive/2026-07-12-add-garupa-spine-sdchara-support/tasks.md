## 1. 선행 자원·라이선스 게이트

- [x] 1.1 Git·Vite public root 밖의 private fixture root에 `panxuc/bangdream-live2d` exact commit의 `sdchara`와 selection metadata를 sparse backup하고 대표 JP `sdchara` canonical ZIP을 생성하며, tracked audit에는 source revision·manifest·파일 SHA-256과 model family 결과만 기록한다. 이 자원을 확보하지 못하면 runtime 구현을 시작하지 않는다.
- [x] 1.2 도입할 공식 Spine 4.0 runtime의 정확한 package/commit과 version을 확정하고 tarball·transitive file SHA-256, 원문 LICENSE, copyright notice 및 유효한 Spine 사용 조건을 검증한다. 라이선스 gate가 실패하면 2번 이후 구현을 시작하지 않는다.
- [x] 1.3 BanG Dream! 원본 자산의 local interoperability·테스트·배포 경계를 검토해 원본 asset 비포함, 외부 fixture 보관, 사용자 고지와 후속 release 승인 조건을 문서화한다.
- [x] 1.4 `bangdream-live2d` repository, full commit, commit-pinned jsDelivr base, catalog path·hash·size, region semantics, runtime profile과 미선언 data license를 고정한 frozen typed provider manifest와 독립 verifier를 추가한다.
- [x] 1.5 Repository 밖의 OS private application-data root 또는 `CHIBI_PRIVATE_FIXTURE_ROOT`에 owner-only sparse backup, hash inventory, acquisition receipt와 대표 canonical ZIP을 만드는 재현 가능한 debug command를 추가하고 실제 approved snapshot을 확보한다.

License and local evidence: 공식 `@esotericsoftware/spine-webgl@4.0.31` exact dependency와 repository 밖 approved fixture로 Spine `4.0.64` parse 및 첫 visible WebGL frame을 검증했다. 2026-07-11 integrating project owner의 적용 가능한 Spine Editor license 보유 및 사용자 public preview·production artifact 포함 승인으로 branch activation gate를 통과했다. 이 command는 build·test·release chain에 포함하지 않고 release·push는 별도 지시 전까지 blocked로 유지한다.

## 2. Versioned Spine runtime 기반

- [x] 2.1 기존 Spine 3.6 loader, `LiveSD36Adapter`, trailing NUL byte 정책, preview와 sampler 동작을 characterization test로 고정한다.
- [x] 2.2 실제 skeleton binary header를 bounded read해 `spine-3.6`과 `spine-4.0`을 선택하고 metadata 불일치·미지원 version을 stable runtime code로 반환하는 profile registry를 구현한다.
- [x] 2.3 기존 `window.spine` namespace와 한-byte NUL 복사 정책을 보존하는 `spine-3.6` profile adapter를 runtime 독립 facade 뒤로 이동한다.
- [x] 2.4 Spine 3.6 global을 변경하지 않는 별도 namespace의 `spine-4.0` lazy loader와 adapter를 추가하고, profile별 단일 load promise·오류·dispose 상태를 격리한다.
- [x] 2.5 Skeleton·atlas parse, animation state, bounds, draw order, WebGL draw와 dispose를 공통 계약으로 노출하고 version별 class·enum을 숨기는 runtime facade를 구현한다.
- [x] 2.6 Ready preview가 확정한 `runtimeKey`와 adapter identity를 canonical bounds와 export handoff까지 고정하고 runtime drift를 거부한다.
- [x] 2.7 Spine 3.6은 NUL 복사본, Spine 4.0은 원본과 동일한 byte view만 parser에 전달하는 adapter별 byte 정책과 회귀 test를 추가한다.
- [x] 2.8 Spine 4.0 dependency version·hash·LICENSE와 third-party notice를 검증하도록 runtime provenance 검사와 production artifact 검사를 확장한다.
- [x] 2.9 동시 load 재사용, cross-profile 실패 격리, API shape 검증, stable runtime 오류와 자원 정리를 unit test로 검증한다.

## 3. Garupa canonical pack importer

- [x] 3.1 `garupa-spine-pack.json` schema 1의 identity, single-segment 이름, canonical path, immutable provenance와 lowercase SHA-256 형식을 검증하는 parser를 구현한다.
- [x] 3.2 모든 manifest file hash를 계산해 1:1 대응을 확인하고 추가 `.skel`·`.atlas`, 누락 entry와 mutable source revision을 stable pack 오류로 거부한다.
- [x] 3.3 암호화·symlink·NUL·절대/drive/역슬래시·빈/점 segment·archive traversal·정규화/대소문자 충돌을 거부하고 32MiB compressed, 64MiB expanded, 32-file 제한을 선검증한다.
- [x] 3.4 `assetFamily: "sdchara"`만 허용하고 `characters/livesd` 4-frame sprite와 Live2D (Cubism) 입력을 각각 명시적인 unsupported 오류로 구분한다.
- [x] 3.5 Atlas를 strict UTF-8로 파싱해 안전한 상대 PNG page를 모두 수집하고 signature·decode·누락·중복을 검증하며 `pma` 생략/`false`만 `alphaMode: "straight"`로 허용한다.
- [x] 3.6 Skeleton header의 hash·version을 읽어 `4.0.64`를 `verified`, 다른 정상 `4.0.x`를 `experimental`로 표시하고 다른 major/minor와 손상된 header를 runtime load 전에 거부한다.
- [x] 3.7 검증된 원본 skeleton byte, atlas bundle과 source-independent metadata만 원자적으로 반환하고 실패 시 부분 source·object URL·임시 자원을 정리한다.
- [x] 3.8 Manifest, hash, ZIP bomb/path, 자산군, multi-page atlas, alpha mode, PNG와 skeleton version의 성공·실패 matrix를 synthetic fixture unit test로 작성한다.

## 4. Garupa Spine 4.0 preview와 sampling

- [x] 4.1 검증된 source를 Spine 4.0으로 parse하고 texture upload와 첫 visible frame 뒤에만 ready가 되며 실제 animation 목록과 `Idle` 우선 기본값을 제공하는 preview session을 구현한다.
- [x] 4.2 Garupa texture RGB를 보존하고 `premultipliedAlpha: false`, `SRC_ALPHA/ONE_MINUS_SRC_ALPHA`, draw-order-only 2D WebGL state를 preview와 sampler에 적용한다.
- [x] 4.3 기존 `192×208` cell, coarse bounds·alpha calibration·guard·inset과 projection 계약을 runtime facade로 재사용해 preview와 export framing을 일치시킨다.
- [x] 4.4 `F_eyeL`·`F_eyeR`, 각 parent transform과 실제 visible eye attachment를 검증하는 `garupa-dual-eye-v1` profile을 구현하고 지원하지 않는 rig은 preview-only로 제한한다.
- [x] 4.5 같은 screen-space gaze delta를 좌우 parent 2×2 world matrix 역변환으로 각각 적용하고 매 frame animation pose에서 재시작해 offset 누적과 singular transform을 방지한다.
- [x] 4.6 57개 표준 frame과 16개 look frame을 8×11 atlas에 결정적으로 생성하고 sample time, state/global mirror, 방향 index, progress와 `AbortSignal` 계약을 유지한다.
- [x] 4.7 Transparent framebuffer readback을 PNG 기록 전에 straight RGBA로 정확히 한 번 정규화하고 alpha 0 RGB를 0으로 만드는 alpha pipeline을 구현한다.
- [x] 4.8 Parse·draw·look·readback·취소·중복 dispose의 stable rendering 오류와 animation state, texture, shader, batcher, atlas, WebGL 및 frame callback 정리를 구현한다.
- [x] 4.9 Straight-alpha edge, draw order, animation catalog, canonical projection, dual-eye 16방향, mirror semantics, 73-frame 결정성 및 자원 수명을 synthetic·characterization test로 검증한다.
- [x] 4.10 같은 canvas에서 preview를 연속 교체할 때 이전 session이 shared WebGL context를 lose하거나 canvas를 축소하지 않게 하고, 성공·실패 교체 뒤 다음 frame이 유지되는 회귀 test를 추가한다.
- [x] 4.11 Garupa preview의 CSS 크기와 canvas backing store를 분리해 Retina device pixel ratio를 적용하고 canonical projection·export 해상도가 유지되는 회귀 test를 추가한다.

## 5. Garupa integration 경계

- [x] 5.1 Manifest, importer, metadata, 오류 adapter와 runtime 연결을 `src/features/livesd/garupa/` 아래에 두고 `index.ts` 하나만 공개하는 module 구조와 dependency-direction architecture test를 추가한다.
- [x] 5.2 Registry에 등록하지 않는 local/pinned source container를 구현해 manifest 표시·파일 선택만으로 작업하지 않고 명시적 `불러오기`에서만 import 또는 remote materialization과 runtime load를 시작하며, 성공한 첫 frame에서만 기존 ready source를 원자적으로 교체한다.
- [x] 5.3 Garupa remote adapter가 bundled provider manifest의 exact commit만 허용하고 `_info`·buildData·shared skeleton·costume atlas·page graph를 안전하게 materialize해 local importer와 같은 canonical handoff를 반환하도록 구현한다. Bestdori·mutable branch·임의 mirror URL은 거부한다.
- [x] 5.4 모든 지원 locale에 `Garupa Spine SD (sdchara)` 안내, 4-frame LIVE sprite 구분과 stable pack/runtime/rendering 오류 message를 추가하고 locale 변경 시 code·generation을 보존한다.
- [x] 5.5 새로고침 후 memory-only 초기화, 실패한 source 교체의 기존 상태 보존, mount·manifest 표시·선택 단계의 network 0건과 raw exception·path·ZIP byte 비노출을 component test로 검증한다.
- [x] 5.6 Activation 전 registry guard를 회귀 test로 고정하고 승인 provider metadata만 허용하면서 원본 `.skel`·atlas·PNG·buildData·ZIP·Unity bundle·debug backup을 막는 repository/production artifact allowlist를 확장한다.
- [x] 5.7 고정 `_info`와 character catalog를 명시적 목록 action에서만 검증·조인하고 locale별 `캐릭터명 · bundle ID` 검색 option, 모호·미매핑 fallback과 model load 분리를 구현·검증한다.
- [x] 5.8 승인 pinned live resource pack을 기본 UI로 두고 local canonical ZIP을 접힌 고급 기능으로 이동하며 repository·commit·region·license disclosure panel을 제거한다.
- [x] 5.9 Catalog를 locale별 캐릭터와 해당 캐릭터의 model bundle 이중 combobox로 재구성하고, 캐릭터 선택은 request 없이 model 선택에서 별도 버튼 없이 즉시 materialization·preview를 시작하도록 구현·검증한다.
- [x] 5.10 Pinned buildData와 `_info.json` shared model key의 대소문자 차이를 유일한 case-fold match로 해석하고 충돌을 skeleton request 전에 거부하는 회귀 test를 추가한다.

## 6. 통합 검증과 activation 준비

- [x] 6.1 `pnpm test`, `pnpm typecheck`, `pnpm lint`, `pnpm build`를 실행해 기존 Spine 3.6과 신규 비등록 Garupa 기반의 회귀·artifact 검사를 통과시킨다.
- [x] 6.2 저장소 밖의 hash 고정 실제 fixture로 Spine 4.0 parse와 첫 visible frame, straight-alpha edge, 실제 animation catalog와 9-state mapping을 검증하고 원본 byte 없이 결과·hash만 기록한다.
- [x] 6.3 같은 외부 fixture matrix로 model family별 paired-eye 16방향, 73-frame package 결정성, 독립 validator와 설치 preview를 검증하고 실패 family를 preview-only 또는 unsupported로 기록한다.
- [x] 6.4 Production web·CLI artifact에 고정 runtime·license·schema·code·locale·승인 provider metadata만 있고 Garupa 원본 asset, fixture, downloader, Bestdori 및 mutable provider endpoint가 없음을 최종 검사한다.
- [x] 6.5 모든 gate 증거가 성공한 경우에만 registry와 game-source UI를 활성화할 수 있음을 기록하고, 실제 활성화는 아래 7번 작업에서 별도로 검증한다.
- [x] 6.6 `openspec validate add-garupa-spine-sdchara-support --type change --strict`를 실행해 최종 change artifact를 검증한다.

## 7. 현재 feature branch 활성화

- [x] 7.1 `game-source-selection`과 Garupa integration boundary를 갱신하고 `garupa` registry entry를 모든 build에서 `available`과 공개 `GarupaSourceIntegration`으로 연결한다.
- [x] 7.2 공식 Spine 4.0.31을 exact production dependency로 승격하고 public preview·production artifact 포함 승인을 provenance·notice·web/CLI artifact verifier에 기록하되 release·push와 Garupa 원본 asset 포함은 계속 차단한다.
- [x] 7.3 Registry·App component 회귀 test, 전체 test/typecheck/lint/build, OpenSpec strict validation과 기존 ngrok URL의 공개 browser pinned-source smoke를 통과시킨다.
- [x] 7.4 전체 회귀·typecheck·lint·build·OpenSpec strict validation을 다시 통과시키고 ngrok browser에서 서로 다른 두 model의 연속 즉시 로드, 이전 preview 보존과 반응형 이중 combobox를 검증한다.
- [x] 7.5 공개 browser에서 mixed-case MyGO source `00040_2023`의 73-frame Codex Pet package를 생성·다운로드하고 독립 package validator, 전체 build·artifact gate와 main spec 동기화 준비를 검증한다.

7.3 validation note: 격리된 `feature/bang_dream_support` worktree에서 Garupa registry·App·runtime·remote·importer 회귀 test, 전체 test 502개와 CLI test 6개, typecheck, lint/build, runtime/provider/production artifact verifier, OpenSpec strict validation, 실제 외부 fixture의 690-bundle locale name catalog와 73-frame package validator, ngrok production browser pinned-source·ZIP 생성 smoke를 통과했다.

7.4 validation note: 전체 test 505개와 CLI test 6개, typecheck, lint/build, runtime/provider/production artifact verifier와 OpenSpec strict validation을 통과했다. ngrok browser에서 live resource 목록 140개 character group·690개 model, `00001`과 `00001_2023`의 연속 즉시 load·첫 visible frame·324개 animation catalog·교체 뒤 interactive redraw를 확인했고 alert와 console error는 0건이었다. 390×844 viewport에서 두 combobox는 324px 폭으로 viewport 안에 있었고 document horizontal overflow는 0이었다.

7.5 validation note: 공개 ngrok browser에서 mixed-case MyGO/Taki source `00040_2023`을 즉시 불러와 `taki-shina-00040-2023.codex-pet.zip`을 생성·다운로드하고 설치 preview까지 확인했으며 alert, console error, page error와 failed request는 0건이었다. ZIP SHA-256은 `cc4c283b5f0293ad6fad3b6d42f74d134872548777c1fa99cbc271752307d62e`이고, 독립 validator는 manifest ID `taki-shina-00040-2023`, 1536×2288 PNG, 8×11 cell, row별 사용 frame `[6,8,8,4,5,8,6,6,6,8,8]`, 총 73 frame, 미사용 cell alpha 0, edge clipping 0을 확인했다. 전체 web test 508개와 CLI test 6개, typecheck, lint, production·CLI build와 runtime/provider/artifact verifier, OpenSpec 21개 strict validation을 통과했고 Garupa·Spine 4.0 delta를 main spec에 동기화해 커밋 전 상태로 준비했다.
