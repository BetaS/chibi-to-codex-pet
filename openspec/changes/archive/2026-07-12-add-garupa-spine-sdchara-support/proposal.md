## Why

Bestdori는 BanG Dream!의 Spine 기반 `sdchara` 공용 skeleton과 의상 atlas/PNG를 현재 제공하지만 CORS를 허용하지 않고, 대표 데이터는 Spine `4.0.64`라 기존 LiveSD (Spine 3.6) 경로와 직접 호환되지 않는다. `panxuc/bangdream-live2d`의 고정 commit은 같은 자산을 CORS 가능한 immutable URL로 제공하므로, 서빙되지 않는 로컬 디버그 백업과 사용자-facing 승인 manifest를 분리하면서 Spine 4.0 렌더링 지원을 정의해야 한다.

## What Changes

- Garupa `sdchara` 한 의상을 공용 `.skel`, 의상 `.atlas`와 atlas가 참조하는 모든 PNG page로 정규화한 local ZIP 형식을 정의하고 browser importer가 구조, 경로, hash, Spine version과 straight-alpha 계약을 검증한다.
- `panxuc/bangdream-live2d`의 정확한 40자리 commit SHA, commit-pinned jsDelivr base, catalog 경로·hash와 권리 상태를 고정한 사용자-facing provider manifest를 추가한다.
- 사용자가 명시적으로 온라인 불러오기를 실행한 경우에만 승인 manifest의 동일 commit에서 catalog, buildData, skeleton, costume atlas와 PNG를 받아 메모리에서 canonical source로 정규화하는 경계를 정의한다.
- Bestdori-derived `sdchara`와 선택 metadata를 Git 추적·Vite public root 밖에 sparse backup하고 대표 canonical ZIP과 audit receipt를 만드는 개발 전용 절차를 추가한다.
- 기존 Spine 3.6 경로를 유지하면서 source metadata에 따라 격리된 Spine 4.0 runtime을 선택하는 versioned runtime 경계를 추가한다.
- Garupa Spine 4.0 preview, animation catalog, canonical framing, frame sampling과 `F_eyeL`/`F_eyeR` 기반 look rig의 호환성 계약을 추가한다.
- Garupa 전용 code와 오류를 `livesd/garupa` 공개 integration 경계 안에 두고 공통 LiveSD model·rendering 계약에 source metadata만 전달한다.
- Bestdori 직접 URL, 임의 mirror URL과 mutable branch는 제품 source에서 제외한다. 제품 browser는 승인된 `bangdream-live2d` manifest의 pinned delivery origin만 사용한다.
- Bestdori의 `characters/livesd/**` 4-frame sprite, Live2D (Cubism), 원본 Unity AssetBundle과 다른 region의 혼합 runtime은 이번 지원 범위에서 제외한다.
- 실제 외부 fixture와 artifact gate가 모두 통과했으므로 현재 feature branch에서 `garupa` registry entry를 `available`로 전환하고 공개 Garupa integration을 연결한다. 개발·production build를 환경별로 분기하지 않으며 release·push는 별도 사용자 지시 전까지 수행하지 않는다.
- Garupa 탭의 기본 입력을 승인된 live resource pack으로 두고, 캐릭터와 그 캐릭터의 모델을 순서대로 고르는 이중 combobox를 제공한다. 모델 선택은 별도 확인 버튼 없이 해당 pinned model의 materialization과 preview를 즉시 시작하며 local canonical ZIP은 접힌 고급 기능으로 유지한다.
- 같은 canvas에서 모델을 연속 교체할 때 preview session이 canvas 소유 WebGL context를 강제로 잃게 하지 않고 자신이 만든 Spine·texture 자원만 정리해 두 번째 이후 로딩도 안정적으로 동작하게 한다.

## Capabilities

### New Capabilities

- `garupa-spine-sdchara-pack-import`: 정규화된 local Garupa `sdchara` ZIP의 manifest, 안전한 경로, Spine 4.0 skeleton, atlas page와 straight-alpha source 결과를 검증하는 계약.
- `garupa-pinned-snapshot-source`: 고정 `bangdream-live2d` revision을 사용자-facing manifest로 제공하고 승인된 remote snapshot과 비공개 local debug backup을 같은 canonical source 계약으로 materialize하는 계약.
- `spine-versioned-runtime`: 기존 Spine 3.6과 신규 Spine 4.0 runtime을 source profile에 따라 선택하고 namespace, 자원 수명과 라이선스 provenance를 격리하는 계약.
- `garupa-spine-sdchara-rendering`: Garupa Spine 4.0 입력의 preview, 실제 animation 탐색, straight-alpha sampling, mirror와 paired-eye look pose를 검증하는 계약.
- `garupa-integration-boundary`: Garupa 전용 importer, source metadata, 오류 변환과 향후 UI integration의 공개 경계 및 공통 계층 의존 방향을 정의하는 계약.

### Modified Capabilities

- `game-source-selection`: `garupa`를 검증된 `GarupaSourceIntegration`과 함께 선택 가능한 `available` entry로 전환하고, `strr`만 `coming-soon`으로 유지한다.

## Impact

- 향후 `src/features/livesd/garupa/`, versioned runtime loader/adapter, runtime 독립 preview·sampling facade와 관련 단위·component·artifact 검증이 영향을 받는다.
- Spine 4.0 runtime의 고정 버전, 원문 LICENSE, copyright notice와 build-time provenance 기록이 추가로 필요하다. 기존 vendored Spine 3.6 runtime은 교체하지 않는다.
- 원본 BanG Dream! `.skel`, atlas, PNG, Unity bundle과 Bestdori downloader는 tracked source·production web·CLI artifact에 포함하지 않는다. 로컬 debug backup은 서빙되지 않는 repository 외부 private fixture root에만 둔다.
- Production에는 공식 Spine 4.0 runtime JavaScript, 원문 LICENSE·copyright notice, Garupa integration code와 승인된 repository·commit·catalog hash·delivery policy metadata를 포함할 수 있다. Garupa 원본 모델 byte와 private fixture는 계속 포함하지 않으며 release·push는 이 branch 작업 범위에 포함하지 않는다.
