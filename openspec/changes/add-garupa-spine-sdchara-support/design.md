## Context

이 변경을 시작할 때 제품은 LiveSD (Spine 3.6) `LiveSD36Adapter`, 전역 `window.spine`, trailing NUL 보정, PMA preview·sampler와 단일 `eye_scale` look rig를 사용했고 Garupa game registry entry는 `coming-soon`이며 실행 가능한 integration이 없었다. 이후 기록된 activation gate가 모두 통과했고 사용자가 현재 feature branch의 dev·production 공통 활성화를 지시했다.

Bestdori의 Garupa 자산은 이름이 비슷한 두 계열로 나뉜다.

| 자산군 | 내용 | 이번 범위 |
|---|---|---|
| `characters/livesd/<sdResourceName>` | `sdchara.png`의 `anim001`–`anim004` 4-frame sprite | 제외 |
| `sdchara` | 공용 Spine skeleton + 의상별 atlas/PNG | 지원 대상 |

JP `sdchara/model/s000_templete/s000_templete.skel`은 header `4.0.64`, 43 bones, 51 slots, 324 animations이며 `Idle`, `F_eyeL`, `F_eyeR`을 포함한다. 대표 `00001` buildData는 `sdchara/model/s000_templete` 공용 skeleton과 `u000_templete_Atlas.asset` 의상 texture를 연결한다. 공식 Spine 4.0 core `4.0.30`으로 대표 skeleton, costume atlas 98 regions와 `Idle` pose를 실제 파싱했고 atlas parser의 page `pma` 값은 `false`였다. 일부 costume은 여러 PNG page를 사용한다.

Bestdori 직접 asset 응답은 인증 없이 접근되지만 `Access-Control-Allow-Origin`이 없어 외부 browser가 직접 fetch할 수 없다. 반면 `bangdream-live2d`의 GitHub Raw와 commit-pinned jsDelivr 응답은 catalog, buildData, `.skel`, atlas와 PNG 모두 CORS `*`와 `Cross-Origin-Resource-Policy: cross-origin`을 제공한다. jsDelivr exact commit 응답은 1년 immutable cache와 commit identity header를 제공하지만 압축 가능한 file의 Range 응답은 원본 byte range로 신뢰할 수 없어 full GET만 사용해야 한다. 별도 API·정적 pack 조사는 다음 결과를 얻었다.

| 후보 | 실제 Spine byte | 현재성·접근성 | 독립성·판정 |
|---|---|---|---|
| [panxuc/bangdream-live2d](https://github.com/panxuc/bangdream-live2d) | `.skel`, `.atlas.txt`, PNG, buildData와 metadata aggregate | `live2d` branch commit `15b3e023cfdc576212f8b3a6b001c9f26e755f23`, 2026-07-08; GitHub Raw/jsDelivr 200, CORS `*` | 소비는 독립적이나 일·수요일 갱신이 Bestdori JP/CN에 의존하고 data license 없음. 가장 강한 offline acquisition 후보 |
| [bangdream-live2d-viewer](https://github.com/panxuc/bangdream-live2d-viewer) | model 목록, 개별 file, deterministic Spine ZIP API 구현 | code는 MIT·2026 유지; 배포 `live2d.haneoka.org/api/*`는 2026-07-11 Cloudflare challenge 403과 same-origin 정책 | ZIP assembler 참고·self-host 후보, production remote dependency로 부적합 |
| [Greatdori-OfflineResBundle](https://github.com/Chorus-ACE/Greatdori-OfflineResBundle) | JP snapshot에 Spine byte 존재 | `jp/basic` commit `0a5eb50a...`, 2025-10-24 | Bestdori 복제 snapshot, data license 없음, fallback 참고만 허용 |
| [Bandori Party API](https://bandori.party/api/) | 없음 | API 200 | rendered image·metadata 전용으로 pack 생성 불가 |
| Python/Go Bestdori SDK, DoriKit | 자체 byte 없음 | code는 유지 중 | Bestdori URL wrapper 또는 전체 복제 도구이며 독립 source 아님 |
| 과거 `bandori.ga`, `bangdream.ga`, `res.bangdream.ga` | 확인 불가 | DNS 해석 실패 | 사용 불가 |
| UnityPy, AssetRipper, UABEA | 이미 확보한 Unity bundle 추출 가능 | generic tool | 원본 catalog·download·Garupa 조립 규칙은 제공하지 않으며 device export fallback |

`panxuc` `_info.json`에는 buildData 690개 후보와 builddata file 2,841개가 있으며 `data/characters.all.5.json`, `data/cards.all.5.json`, `data/costumes.all.5.json`도 함께 갱신된다. 동일 shared layout에 JP를 먼저 받고 CN을 합치므로 이 변경은 JP semantics만 지원하고 region-neutral catalog로 간주하지 않는다. Mutable branch URL은 discovery에만 사용하고 사용자 source는 승인 manifest의 immutable commit SHA를 사용하며 materialized file의 SHA-256을 기록해야 한다. 별도 `spine` branch는 path가 편하지만 2025-05 initial commit에 머물러 있으므로 최신 provider로 사용하지 않는다.

```text
                         승인 metadata만 tracked
                     provider manifest (full SHA)
                                │
               ┌────────────────┴────────────────┐
               ▼                                 ▼
    명시적 browser load                  local debug backup
  jsDelivr exact commit             private sparse checkout
               │                                 │
               └──── buildData → files → hash ───┘
                                │
                                ▼
                     canonical source / local ZIP
                                │
                                ▼
              importer → spine-4.0 → 73-frame Pet
```

## Goals / Non-Goals

**Goals:**

- 한 의상의 Garupa `sdchara`를 provider 독립 local ZIP으로 안전하게 가져온다.
- 승인된 `bangdream-live2d` exact commit을 사용자-facing manifest로 제공하고, 명시적 browser load에서 같은 canonical source로 materialize한다.
- Bestdori-derived `sdchara` 전체와 선택 metadata를 서빙되지 않는 private debug root에 백업하고 대표 fixture를 재현 가능하게 만든다.
- 기존 Spine 3.6 동작을 유지하면서 Spine 4.0 runtime과 byte 정책을 격리한다.
- Straight-alpha preview·sampling, 실제 animation catalog와 paired-eye look rig를 검증한다.
- 외부 미러의 가용성 변화가 기존 ready source와 PRSK 동작에 영향을 주지 않게 하고 local ZIP fallback을 유지한다.
- 실제 자산 없이 구현·artifact를 검증하고 기록된 외부 fixture gate가 모두 성공한 현재 feature branch에서 탭을 활성화한다.

**Non-Goals:**

- Bestdori, Haneoka, mutable branch, 임의 GitHub repository 또는 사용자가 입력한 arbitrary URL을 browser provider로 연결하는 기능.
- Bestdori의 `characters/livesd` 4-frame sprite, Live2D (Cubism), cat/minigame과 Spine 3.5·3.6·4.1 Garupa 변형 지원.
- Unity AssetBundle download, packet capture, decryption 또는 generic Unity extraction을 제품에 포함하는 기능.
- 게임 원본 asset 또는 third-party snapshot byte를 tracked source·배포물·Vite public root에 포함하는 작업.
- Remote recipe/NPX source를 추가하거나 이 feature branch를 release·push하는 작업.

## Decisions

### 1. 제품 범위는 `Garupa Spine SD (sdchara)`로 명시한다

사용자-facing label, manifest `assetFamily`과 오류는 `sdchara`를 기준으로 한다. `characters/livesd`는 실제 LIVE 의상 SD이지만 Spine이 아니므로 자동 변환하거나 같은 이름으로 노출하지 않는다. 이를 조용히 허용하면 네 frame sprite를 rigged animation으로 오인하고 잘못된 runtime·mapping을 적용할 수 있다.

대안으로 모든 Garupa SD를 한 integration에서 받는 방식을 고려했지만 sprite importer와 Spine runtime은 입력·animation·export 계약이 다르므로 별도 변경이 적절하다.

### 2. Browser canonical source는 local ZIP과 승인된 pinned snapshot 두 경로다

Local ZIP의 canonical tree는 다음과 같다.

```text
garupa-spine-pack.json
model/<modelName>.skel
costume/<atlasName>.atlas
costume/<atlas page>.png
costume/<additional page>.png
```

Manifest schema version 1은 다음 identity와 integrity를 가진다.

```json
{
  "schemaVersion": 1,
  "gameId": "garupa",
  "assetFamily": "sdchara",
  "sdAssetBundleName": "00001",
  "modelName": "s000_templete",
  "skeletonPath": "model/s000_templete.skel",
  "atlasPath": "costume/u000_templete.atlas",
  "files": {
    "model/s000_templete.skel": "<sha256>",
    "costume/u000_templete.atlas": "<sha256>",
    "costume/u000_templete.png": "<sha256>"
  },
  "provenance": {
    "sourceKind": "github-mirror",
    "sourceRevision": "15b3e023cfdc576212f8b3a6b001c9f26e755f23",
    "acquiredAt": "2026-07-11T00:00:00Z"
  }
}
```

Unity `buildData.asset`, `*_Atlas.asset`과 원본 bundle은 canonical pack에 넣지 않는다. Local normalizer 또는 pinned snapshot materializer가 buildData의 model/texture 연결을 해석하고 atlas page 이름을 portable filename으로 바꾼 뒤 hash를 생성한다. Remote 경로도 검증이 끝나면 ZIP importer와 같은 runtime 독립 handoff를 반환하며 provider URL과 buildData 객체를 rendering 계층으로 넘기지 않는다. Haneoka ZIP의 `<model>/<model>.skel|atlas|png` 형식은 유용한 중간 산출물이지만 manifest와 immutable provenance가 없으므로 normalizer를 한 번 거쳐야 한다.

Manifest 없는 ZIP을 browser가 추론하는 대안은 간단하지만 자산군, 공유 model identity, source revision과 integrity를 검증할 수 없어 채택하지 않는다.

### 3. bangdream-live2d exact commit을 experimental 사용자 provider로 고정한다

Source 우선순위는 다음과 같다.

```text
1. 사용자가 이미 가진 canonical ZIP
2. 승인 manifest의 panxuc commit-pinned jsDelivr snapshot
3. private debug backup에서 만든 canonical ZIP
4. user-owned AssetBundle + UnityPy offline fallback
```

제품 manifest는 repository `panxuc/bangdream-live2d`, full revision `15b3e023cfdc576212f8b3a6b001c9f26e755f23`, commit URL과 `https://cdn.jsdelivr.net/gh/panxuc/bangdream-live2d@<revision>` base를 고정한다. Asset index `sdchara/_info.json`과 character metadata의 path, byte length·SHA-256, JP-preferred JP/CN union semantics, `spine-4.0` expected profile과 `licenseStatus: not-declared`도 기록한다. Branch name은 provenance 정보일 뿐 URL resolution에 사용하지 않는다.

Manifest import와 label 표시는 network 0건이어야 하고 사용자의 명시적 load 이후에만 catalog와 asset을 full GET한다. Resolver는 manifest origin·repository·commit 아래의 안전한 relative path만 허용하고 arbitrary URL, credential, redirect, query·fragment와 mutable ref를 거부한다. `_info.json`, buildData, shared skeleton, costume atlas와 page graph는 모두 같은 revision에서 읽고, 긴 flattened filename과 atlas page 이름의 차이는 unique catalog match로 정규화한다.

Data license·SLA가 없고 updater가 Bestdori JP/CN을 합치는 점은 유지되는 위험이다. 따라서 provider는 experimental이고 Garupa registry 활성화나 권리 승인을 뜻하지 않는다. jsDelivr 실패를 다른 revision이나 Bestdori로 자동 fallback하지 않으며 local ZIP을 사용자 fallback으로 유지한다.

### 4. Debug backup은 서빙되지 않는 private fixture root에 둔다

기본 debug root는 repository 밖의 OS private application-data directory로 하고 `CHIBI_PRIVATE_FIXTURE_ROOT`로 다른 repository 외부 위치를 선택할 수 있다. Vite는 workspace root file도 development URL로 제공할 수 있고 `assets/`는 `public/assets -> ../assets` symlink로 추가 노출되므로 `.debug-fixtures/`, `assets/`, `public/`을 포함한 repository 내부 경로를 Garupa 원본 backup에 사용하지 않는다. Vite는 `.debug-fixtures` deny rule도 방어적으로 유지한다.

Backup command는 manifest의 exact revision을 sparse checkout해 `sdchara/`, `data/characters.all.5.json`과 `data/costumes.all.5.json`만 보관한다. 전체 대상은 약 2,938 file·40MiB이므로 repository 전체 2GiB clone보다 범위가 작다. Tool은 owner-only directory, detached commit, receipt와 file SHA-256 inventory를 만들고 대표 `00001` canonical ZIP을 생성한다. Tracked QA 증거에는 source revision, manifest/hash와 결과만 두고 원본 byte는 두지 않는다.

### 5. Spine runtime registry를 major/minor profile로 분리한다

공통 header reader가 실제 byte의 major/minor를 읽고 `spine-3.6` 또는 `spine-4.0` profile을 선택한다. Manifest runtime 주장은 실제 header와 일치해야 한다. Cross-version best-effort parsing은 Garupa에 적용하지 않는다.

```text
LiveSD source
  ├─ header 3.6 → 기존 LiveSD36Adapter → trailing NUL copy
  └─ header 4.0 → LiveSD40Adapter     → original bytes
```

Spine 4.0 runtime은 ESM namespace 또는 명시적 module object로 보존해 기존 `window.spine` 3.6을 덮어쓰지 않는다. Runtime profile마다 load promise와 adapter factory를 갖고 preview가 ready가 된 뒤 `runtimeKey`를 export handoff에 고정한다.

로컬 평가 dependency는 공식 `@esotericsoftware/spine-webgl@4.0.31` exact devDependency로 고정한다. `4.0.30`으로 대표 `4.0.64` binary와 compact atlas를 파싱했고, `4.0.31`의 WebGL IIFE가 `4.0.30`과 byte-identical임을 확인했다. Package는 exact `@esotericsoftware/spine-core@4.0.31`을 사용한다. Tarball·lockfile integrity, installed file SHA-256과 package 원문 LICENSE는 evaluation provenance에서 검증한다. 기존 raw WebGL renderer를 유지하기 위해 PixiJS와 `pixi-spine`을 추가하는 대안은 채택하지 않는다.

`scripts/verifyGarupaSpine40Local.mjs`는 repository 밖의 approved fixture를 해시 검증하고 격리된 headless browser memory에서만 runtime과 asset byte를 사용해 parse, 첫 visible frame과 선택적인 73-frame compatibility gate를 검사한다. Smoke projection도 공통 coarse projection과 같은 10% padding·target aspect 보정으로 X/Y uniform scale을 유지해야 한다. 외부 request, fixture serving, screenshot과 model 산출물은 기본 command에서 만들지 않으며 build·test·release chain에는 연결하지 않는다. 2026-07-11 integrating project owner의 적용 가능한 Spine Editor license 보유 확인과 사용자 공개 검증 승인으로 production source integration 및 이 branch의 public preview·production artifact 포함은 허용한다. Release·push는 별도 지시 전까지 blocked로 유지하며 원문 LICENSE·copyright notice를 runtime과 함께 제공한다.

### 6. Source alpha와 framebuffer readback을 분리한다

Garupa atlas의 `pma` 생략은 Spine 4.0 parser에서 `false`이며 palette PNG pixel도 straight-alpha 특성을 가진다. Texture upload는 RGB를 변경하지 않고 Spine renderer는 `premultipliedAlpha = false`, normal blend는 `SRC_ALPHA, ONE_MINUS_SRC_ALPHA`를 사용한다.

Transparent framebuffer에 blend된 RGB는 PNG straight RGBA가 아니므로 readback 뒤 정확히 한 번 unpremultiply하고 alpha 0 RGB를 0으로 만든다. 이는 source texture를 PMA로 취급하는 것과 다른 단계다. Preview와 export의 반투명 edge fixture로 dark fringe, halo와 이중 변환을 함께 검사한다.

### 7. Garupa look rig는 paired-eye profile이다

`garupa-dual-eye-v1`은 `F_eyeL`과 `F_eyeR` bone, 각 parent transform과 실제 visible eye attachment를 확인한다. 같은 screen/world gaze delta를 두 parent matrix의 역행렬로 각각 변환해 local offset에 적용한다. 매 frame animation pose를 다시 적용해 이전 offset을 제거한다.

```text
screen gaze delta
      ├─ inverse(parent(F_eyeL)) → left local delta
      └─ inverse(parent(F_eyeR)) → right local delta
```

두 bone 중 하나라도 유효하지 않으면 일반 animation preview는 허용하지만 Codex Pet v2 look export는 차단한다. 단일 `eye_scale`을 가정하는 기존 공통 validator를 즉시 수정하면 active STRR 변경과 결합되므로, 이번에는 Garupa renderer의 profile adapter로 격리한다. 실제 fixture 검증 뒤 공통 `LiveSDLookRig` 추상화로 승격할 수 있다.

### 8. 공통 rendering facade는 output 계약만 공유한다

Garupa adapter는 runtime API 차이를 감추고 기존 canonical projection, 57개 표준 pose, 16개 look pose, `192×208`, 8×11 atlas, mirror, progress와 cancellation 결과를 제공한다. 공통 consumer는 version별 Spine class를 알지 않는다. Garupa 전용 code는 `src/features/livesd/garupa/`, runtime profile은 공통 runtime registry가 소유하며 공통 model·rendering 계층은 Garupa를 역방향 import하지 않는다.

기존 `LiveSD36FrameSampler`에 4.0 조건문을 누적하는 대안은 runtime API·alpha·look rig 차이를 하나의 클래스에 결합하므로 채택하지 않는다. Runtime 독립 facade 뒤에 version adapter를 둔다.

### 9. 검증 완료 후 현재 feature branch에서 registry를 활성화한다

실제 외부 fixture byte는 저장소에 넣지 않고 저장소 밖 audit에서 다음 gate를 통과해야 한다.

1. Spine 4.0 skeleton + costume atlas 첫 visible frame
2. straight-alpha 반투명 edge preview와 PNG
3. 실제 animation catalog와 9-state mapping
4. `F_eyeL`/`F_eyeR` 16방향 look
5. 73-frame package 생성, 독립 validator와 설치 preview
6. production web·CLI artifact allowlist

모든 gate가 `qa/garupa/`에 기록되어 통과했으므로 이 변경이 직접 `game-source-selection`을 수정하고 `GarupaSourceIntegration`을 registry에 연결한다. 활성화는 환경 변수로 dev/prod를 분기하지 않고 현재 feature branch의 모든 build에 적용한다. Pinned provider 자체의 `experimental`·미선언 data license 고지는 유지하며, 원본 asset 비포함과 release·push 차단은 별도 artifact·작업 경계로 유지한다.

## Risks / Trade-offs

- **[Panxuc snapshot은 data license가 없고 Bestdori에서 갱신됨]** → provider manifest에 `licenseStatus: not-declared`와 upstream을 공개하고 experimental source로만 제공한다. Registry 기본 활성화와 상업 배포 전 권리 검토를 별도 gate로 둔다.
- **[JP/CN shared snapshot이 region을 혼합함]** → JP를 초기 semantics로 고정하고 `buildData.asset`이 실제 있는 690개만 packable catalog 후보로 취급한다. 다른 region은 별도 manifest profile에서 지원한다.
- **[Pinned CDN 또는 repository가 제거·차단될 수 있음]** → full commit과 catalog hash를 고정하고 기존 ready source를 보존하며 local ZIP fallback을 유지한다. 다른 revision·Bestdori로 자동 fallback하지 않는다.
- **[Commit pin만으로 updater의 부분 snapshot 품질을 보증하지 못함]** → 승인 전 local sparse backup, file inventory, 대표 canonical pack parse와 first-frame gate를 실행하고 manifest revision을 수동 승격한다.
- **[Ignored `assets/`와 workspace file이 development server에 노출될 수 있음]** → 원본 backup은 repository 밖의 private fixture root에만 두고 `.debug-fixtures` deny rule과 artifact·tracked-file 검사로 workspace, `public/assets`와 dist 유입을 막는다.
- **[Haneoka deployed API가 Cloudflare challenge를 적용함]** → API availability를 자동 fallback으로 가정하지 않고 MIT assembler code만 참고한다.
- **[Spine 4.0 runtime이 bundle size와 license surface를 늘림]** → exact production dependency·hash·notice allowlist를 검증하고 Garupa 선택 뒤에만 runtime chunk를 lazy load한다. 이 branch의 public preview·production artifact 포함은 승인됐지만 release·push는 별도 지시 전까지 차단한다.
- **[Straight-alpha source와 premultiplied framebuffer 용어가 혼동될 수 있음]** → texture upload, renderer blend, framebuffer readback을 별도 metadata·test로 검증한다.
- **[한 shared skeleton의 paired-eye 규칙이 모든 model 변형을 대표하지 않을 수 있음]** → model family별 외부 fixture matrix를 activation gate에 포함하고 실패한 family는 preview-only 또는 unsupported로 남긴다.
- **[Active STRR 변경과 공통 facade refactor가 겹칠 수 있음]** → 이번 change는 기존 capability delta와 game registry를 수정하지 않는다. 공통 refactor는 기존 3.6 behavior characterization test를 먼저 고정한다.
- **[Canonical manifest가 기존 Haneoka ZIP보다 한 단계 더 필요함]** → offline normalizer가 Haneoka-style ZIP을 읽어 manifest·hash를 추가할 수 있게 schema와 reference algorithm을 문서화한다.

## Migration Plan

1. `bangdream-live2d` exact revision의 typed provider manifest, independent verifier와 private sparse backup command를 추가하고 대표 canonical ZIP·hash audit를 생성한다.
2. 기존 Spine 3.6 adapter·sampler의 behavior characterization와 architecture test를 먼저 추가하고 runtime facade 뒤로 이동한다.
3. `garupa-spine-pack.json` parser, ZIP safety, hash, atlas page와 4.0 header 검증을 synthetic fixture로 구현한다.
4. 고정 Spine 4.0 runtime과 provenance·license 검사를 추가하되 기존 3.6 global과 loader를 유지한다.
5. Garupa straight-alpha preview, canonical framing, paired-eye look와 73-frame sampler를 runtime facade 뒤에 구현한다.
6. `src/features/livesd/garupa/` 공개 entrypoint, local ZIP과 pinned remote source lifecycle을 만들고 gate 통과 뒤 game registry에 등록한다.
7. Private backup과 pinned remote source에서 같은 canonical pack 결과가 나오는지 activation gate를 실행하고 원본 byte 없이 hash·결과만 기록한다.
8. 모든 gate가 성공하면 현재 feature branch에서 `garupa` 탭과 production runtime chunk를 활성화하되 release·push는 수행하지 않는다.

Rollback은 pinned provider manifest·Garupa entrypoint와 Spine 4.0 profile을 제거하고 기존 `spine-3.6` profile을 직접 연결하는 것이다. Private backup은 product state가 아니며 별도로 삭제할 수 있다. Production registry가 변경되지 않으므로 기존 PRSK 사용자 state와 package 계약은 유지된다.

## Open Questions

- 후속 activation에서 release 승인이 생기면 현재 ESM lazy loader를 public application chunk에 포함할지 별도 licensed vendor artifact로 고정할지 최종 결정해야 한다.
- Paired-eye 이동 반경을 기존 `eye_scale` profile과 같은 final-cell pixel 값으로 사용할 때 모든 Garupa face scale에서 자연스러운가?
- `s000_child`, RAS, Morfonica, MyGO와 특수 model family가 같은 `F_eyeL`/`F_eyeR` 계약을 만족하는가?
- Pinned provider의 catalog를 사용자가 직접 탐색하게 할지, 승인된 model family만 작은 product index로 노출할지 결정해야 한다.
- Data 재배포가 아닌 local interoperability 도구에 적용되는 BanG Dream! 자산 이용 조건을 어떤 release gate와 사용자 고지로 표현할 것인가?
