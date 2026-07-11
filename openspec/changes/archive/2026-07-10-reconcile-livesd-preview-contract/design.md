## Context

현재 앱은 React·Vite 기반에서 PRSK 분리 자산을 입력받아 esterTion fork의 LiveSD (Spine 3.6) WebGL runtime으로 렌더링한다. 구현 자체는 ZIP importer, 공통 스켈레톤 입력, runtime loader, `LiveSD36Adapter`, `LiveSDPreviewSession`으로 나뉘어 있지만, archive된 명세만 기준으로 다시 구현하면 다음 지점에서 현재 동작 또는 이번에 확정한 동작과 달라진다.

- foundation 명세는 과거 scaffold-only build를 전제로 runtime이 production에 없다고 서술하지만 현재 누적 제품은 runtime을 배포한다.
- `PrskCharacterPack`과 warning 필드가 source 전용 의미를 adapter까지 전파한다.
- importer의 여분 파일, 암호화 항목, atlas text·페이지 중복 처리와 공개 오류 code가 완전히 고정되어 있지 않다.
- browser loader가 same-origin runtime을 다시 fetch해 SHA-256을 검사하고 Blob URL로 실행한다.
- header inspector가 3.6 이외 version을 parser 전에 거부하고 header 문자열에 임의의 1024-byte 제한을 둔다.
- session 생성은 첫 draw 전에 성공하며 후속 render loop 예외를 UI에 전달하는 경계가 없다.
- repository visibility와 라이선스 확인 여부가 제품 capability와 결정 메모의 release gate로 남아 있다.

이 변경은 새로운 resource source나 runtime을 추가하지 않는다. 세 capability의 누적 계약을 먼저 정리한 뒤 구현을 맞추고 archive하여, 후속 `add-prsk-remote-resource-source`가 이 계약 위에서 별도로 재정렬되게 한다.

## Goals / Non-Goals

**Goals:**

- source 전용 ZIP 해석과 source 독립 LiveSD runtime 입력을 명확히 분리한다.
- ZIP, 공통 스켈레톤, runtime loader, adapter와 UI의 안정적인 공개 enum 값을 완전하게 고정한다.
- 모든 정상 header version을 고정 3.6 runtime으로 best-effort 파싱하고 호환성은 metadata로만 제공한다.
- same-origin classic script와 이미 검증된 build provenance의 책임을 분리한다.
- 첫 frame까지 포함한 미리보기 성공 조건과 비동기 render failure 전달·정리 계약을 고정한다.
- production runtime·LICENSE·notice 포함과 모델 자산 제외를 누적 제품 계약으로 만든다.
- README, `DECISIONS.md`, `THIRD_PARTY_NOTICES.md`를 새 계약과 일치시킨다.

**Non-Goals:**

- `add-prsk-remote-resource-source`의 catalog, remote fetch, local/remote 우선순위 또는 개발 기본 source 동작 변경
- 새 LiveSD runtime, 별도 version adapter 또는 runtime 자동 선택
- 범용 LiveSD archive 형식, Live2D (Cubism), 프레임 캡처나 export
- PRSK 자산의 repository·CI·production 포함
- runtime 라이선스에 대한 법률 판단, 저장소 visibility 확인 또는 license-confirmation release gate
- 새 npm dependency나 앱 framework 변경

## Decisions

### 1. 하나의 변경에서 세 capability의 누적 계약을 함께 교정한다

`web-app-foundation`, `prsk-character-archive-import`, `livesd-36-preview` delta를 `reconcile-livesd-preview-contract` 하나에 둔다. foundation은 feature가 runtime을 production에 포함할 수 있는 계층 경계를 정의하고, ZIP capability는 PRSK source 형식을, preview capability는 source 독립 runtime 계약을 소유한다.

현재 구현을 각 기존 change에 역으로 나눠 수정하는 대안은 이미 archive·sync된 역사와 현재 누적 제품을 다시 혼합하고 후속 change의 기준점을 불명확하게 하므로 선택하지 않는다. `add-prsk-remote-resource-source`는 이번 변경에서 수정하지 않고, 이번 변경을 적용·sync·archive한 뒤 별도 변경으로 재정렬한다.

### 2. importer 결과를 `LiveSDAtlasBundle`로 일반화한다

공개 경계는 다음과 같이 변경한다.

```ts
interface LiveSDAtlasBundle {
  readonly sourceName: string;
  readonly atlasPath: string;
  readonly atlasText: string;
  readonly atlasPages: ReadonlyMap<string, Blob>;
}

interface PrskCharacterArchiveImporter {
  import(file: File): Promise<LiveSDAtlasBundle>;
}

interface LiveSD36PreviewInput {
  readonly canvas: HTMLCanvasElement;
  readonly atlasBundle: LiveSDAtlasBundle;
  readonly skeletonData: ArrayBuffer;
}
```

`PrskCharacterArchiveImporter` 이름과 `sekai_atlas.atlas`, `.skel` 금지 같은 규칙은 PRSK source 전용이므로 유지한다. 반면 adapter는 ZIP이나 PRSK를 알 필요가 없으므로 `PrskCharacterPack`을 받지 않는다. `archiveName`은 remote·memory source에도 적용 가능한 `sourceName`으로 바꾼다.

`warnings`와 extra-entry 목록은 결과에서 제거한다. 여분 파일은 path·collision·file count·uncompressed size 검사까지 통과한 뒤 조용히 버린다. source-specific pack을 adapter에서 계속 사용하는 대안은 후속 remote source가 ZIP 의미를 흉내 내게 만들기 때문에 선택하지 않는다.

### 3. ZIP은 전체 항목을 먼저 검증하고 필요한 atlas bundle만 만든다

가져오기는 다음 순서를 사용한다.

1. 압축 파일 크기 32MiB를 검사한다.
2. directory를 제외한 모든 entry metadata를 열거해 32개, 암호화 여부, `.skel`, uncompressed 합계 64MiB를 검사한다.
3. 모든 entry path의 `\\`를 `/`로 바꾸고 segment를 정규화한 뒤 절대 경로, drive letter, NUL, root escape, 빈 경로와 collision을 검사한다.
4. basename이 정확히 `sekai_atlas.atlas`인 항목이 하나인지 확인한다.
5. atlas를 `TextDecoder('utf-8', { fatal: true })`로 읽고 하나 이상의 PNG page를 추출한다.
6. atlas directory 기준으로 각 page를 동일하게 정규화하고 format, 정규화 후 duplicate와 누락을 검사한다.
7. 참조된 PNG만 `image/png` Blob map으로 만들고 나머지 entry는 결과나 warning에 포함하지 않는다.

암호화 entry는 비밀번호 UI나 부분 지원 없이 `ARCHIVE_ENCRYPTED_ENTRY`로 전체 archive를 거부한다. 여분 파일을 아예 검사 대상에서 제외하는 대안은 path collision과 ZIP bomb 제한을 우회하게 하므로 선택하지 않는다. 여분 파일 warning을 유지하는 대안은 사용자가 해결할 필요가 없는 진단을 공개 계약에 남기므로 선택하지 않는다.

### 4. 공개 오류 code는 닫힌 union으로 유지하고 문구는 한국어 의미 계약으로 둔다

각 경계가 소유하는 code는 다음과 같다.

```ts
type PrskArchiveImportErrorCode =
  | 'ARCHIVE_CORRUPT'
  | 'ARCHIVE_ENCRYPTED_ENTRY'
  | 'ARCHIVE_ENTRY_LIMIT_EXCEEDED'
  | 'ARCHIVE_PATH_COLLISION'
  | 'ARCHIVE_SKEL_FORBIDDEN'
  | 'ARCHIVE_TOO_LARGE'
  | 'ARCHIVE_UNCOMPRESSED_LIMIT_EXCEEDED'
  | 'ARCHIVE_UNSAFE_PATH'
  | 'ATLAS_DUPLICATE_PAGE'
  | 'ATLAS_INVALID_TEXT'
  | 'ATLAS_MISSING'
  | 'ATLAS_MULTIPLE'
  | 'ATLAS_PAGE_LIST_EMPTY'
  | 'ATLAS_PAGE_MISSING'
  | 'ATLAS_UNSUPPORTED_PAGE_FORMAT';

type SharedSkeletonInputErrorCode =
  | 'SHARED_SKELETON_INVALID_TYPE'
  | 'SHARED_SKELETON_REQUIRED';

type RuntimeLoadErrorCode =
  | 'RUNTIME_SCRIPT_LOAD_FAILED'
  | 'RUNTIME_GLOBAL_MISSING';

type LiveSDPreviewErrorCode =
  | 'ANIMATION_MISSING'
  | 'ANIMATION_UNKNOWN'
  | 'ATLAS_IMAGE_DECODE_FAILED'
  | 'ATLAS_RUNTIME_PARSE_FAILED'
  | 'PREVIEW_RENDERER_CREATE_FAILED'
  | 'PREVIEW_RENDER_FAILED'
  | 'SKELETON_HEADER_CORRUPT'
  | 'SKELETON_PARSE_FAILED'
  | 'WEBGL_UNSUPPORTED';

type PreviewUIFallbackErrorCode = 'PREVIEW_UNKNOWN_ERROR';
```

영문 code는 테스트·호출자 계약이므로 정확히 고정한다. 한국어 message는 code, 관련 path/version과 사용자가 취할 조치를 전달해야 하지만 정확한 문장까지 API로 고정하지 않는다. 예상하지 못한 값은 UI 경계에서 `PREVIEW_UNKNOWN_ERROR`로 바꾸고 raw exception, stack 또는 내부 runtime message를 표시하지 않는다.

개발 fallback과 미래 remote source의 source-loading code는 이번 변경에 추가하지 않는다. 내부 React 상태인 `AppPhase`도 사용자 관찰 가능한 오류 enum이 아니므로 명세 계약에서 제외한다. 모든 내부 실패 문자열까지 enum으로 만드는 대안은 변경 비용만 늘리고 외부 계약과 구현 세부를 구분하지 못하므로 선택하지 않는다.

### 5. header version은 분류만 하고 파싱을 차단하지 않는다

header reader는 Spine binary string의 최대 5-byte varint를 읽되, 선언 길이가 남은 입력 buffer를 벗어나는지만 검사한다. hash는 `null`을 허용하고 version은 non-empty strict UTF-8이어야 한다. 임의의 1024-byte 상한은 제거하며, 손상 varint, truncated bytes, invalid UTF-8과 빈 version은 `SKELETON_HEADER_CORRUPT`로 통합한다.

```ts
type LiveSDSkeletonCompatibility =
  | 'verified'
  | 'experimental'
  | 'best_effort';

interface LiveSDSkeletonHeader {
  readonly hash: string | null;
  readonly version: string;
  readonly compatibility: LiveSDSkeletonCompatibility;
}

function classify(version: string): LiveSDSkeletonCompatibility {
  if (version === '3.6.53' || version === '3.6.53D4') return 'verified';
  if (version === '3.6' || version.startsWith('3.6.')) return 'experimental';
  return 'best_effort';
}
```

정상 header는 classification과 무관하게 고정 runtime으로 전달한다. 성공하면 미리보기를 허용하고 실패하면 `SKELETON_PARSE_FAILED`에 실제 input version과 runtime `3.6`만 포함한다. `SKELETON_VERSION_UNSUPPORTED`, `LiveSDPreviewWarningCode`, warning 배열과 UI compatibility 표시는 제거한다.

version별 runtime을 자동 선택하는 대안은 추가 runtime과 배포·테스트 범위를 요구하므로 제외한다. 3.6만 사전 허용하는 대안은 바이너리 형식이 실제로 호환되는 다른 version의 성공 가능성을 불필요하게 막으므로 선택하지 않는다.

### 6. NUL padding은 모든 parser 호출에 일관되게 적용한다

header version과 관계없이 원본 `ArrayBuffer`를 새 `Uint8Array(byteLength + 1)`에 복사하고 마지막 0바이트를 포함한 별도 buffer만 `SkeletonBinary.readSkeletonData()`에 전달한다. 이는 선택한 3.6 fork의 parser compatibility shim이며 입력 version 지원 선언이 아니다.

원본 buffer에 쓰는 대안은 caller 소유 데이터를 변경하고 재시도를 비결정적으로 만들 수 있다. 3.6 classification에서만 padding하는 대안은 동일 parser에 입력별로 다른 전처리를 적용하므로 선택하지 않는다.

### 7. runtime loader는 same-origin classic script 실행만 책임진다

`LiveSD36RuntimeLoader`는 먼저 현재 `window.spine`의 `SkeletonBinary`, `TextureAtlas`, `AtlasAttachmentLoader`, `webgl.GLTexture` shape을 검사한다. 유효하면 즉시 재사용하고, 아니면 다음 고정 URL을 `src`로 가진 classic `<script>` 하나를 삽입한다.

```text
/vendor/estertion-spine-3.6/spine-webgl.js
```

진행 중에는 하나의 promise를 공유한다. load event 뒤 shape이 유효하면 runtime을 반환한다. script error는 `RUNTIME_SCRIPT_LOAD_FAILED`, load 뒤 잘못된 global은 `RUNTIME_GLOBAL_MISSING`으로 바꾼다. 실패 시 DOM node와 cached promise를 정리하여 다음 명시적 요청이 다시 시도할 수 있게 한다.

same-origin URL을 먼저 `fetch`하고 browser crypto로 hash를 계산한 뒤 Blob URL로 실행하는 현재 방식은 제거한다. build가 이미 고정 파일과 provenance를 공급하고 같은 origin을 신뢰 경계로 사용하므로 browser hash는 변경 방지 경계를 추가하지 않으면서 CSP, `crypto.subtle` 지원과 object URL 수명만 복잡하게 만든다. `expectedSha256` option과 `RUNTIME_NOT_FOUND`, `RUNTIME_INTEGRITY_MISMATCH`, `RUNTIME_INTEGRITY_UNAVAILABLE`도 함께 제거한다.

### 8. 첫 draw 성공 뒤 세션을 반환하고 후속 오류는 단일 구독 경계로 전달한다

세션 계약은 다음과 같다.

```ts
interface LiveSDPreviewSession {
  readonly animations: readonly string[];
  readonly currentAnimation: string;
  readonly version: string;
  readonly compatibility: LiveSDSkeletonCompatibility;
  play(name: string): void;
  resize(width: number, height: number): void;
  onError(listener: (error: LiveSDPreviewError) => void): () => void;
  dispose(): void;
}
```

`WebGLLiveSDPreviewSession` 생성자는 자원을 보관하되 render loop를 자동 시작하지 않는다. adapter는 animation과 bounds를 구성한 뒤 session의 내부 `start()`를 호출한다. `start()`는 delta `0`으로 첫 update/apply/world-transform/clear/draw를 동기적으로 완료하고 다음 animation frame을 예약한다. 이 단계가 성공한 뒤에만 `createPreview()`가 session을 반환한다.

첫 draw가 실패하면 adapter는 `PREVIEW_RENDER_FAILED`로 정규화하고 session을 dispose한 뒤 reject한다. 후속 frame callback 전체도 `try/catch`로 감싼다. 실패 시 listener snapshot을 만들고 loop를 중단해 자원을 한 번 해제한 다음 `PREVIEW_RENDER_FAILED`를 listener마다 한 번 전달한다. `onError()`가 반환한 unsubscribe와 `dispose()`는 모두 idempotent하다. 앱은 session을 받은 직후 listener를 등록하고 unmount·교체 시 unsubscribe와 dispose를 모두 호출한다.

단순히 `requestAnimationFrame`을 예약한 시점을 ready로 보는 현재 방식은 첫 실제 WebGL 오류를 성공 뒤의 uncaught exception으로 만들기 때문에 선택하지 않는다. 모든 frame을 React가 직접 구동하는 대안은 runtime 수명 주기를 UI에 누출하므로 선택하지 않는다.

### 9. adapter는 generic bundle만 소비하고 session이 rendering 자원을 소유한다

adapter는 `LiveSDAtlasBundle`의 `atlasText`와 정규화 page map을 사용해 image decode, `GLTexture`, `TextureAtlas`, `AtlasAttachmentLoader`, `SkeletonBinary`, `Skeleton`, animation state와 renderer를 구성한다. 초기화 단계가 실패하면 생성 역순으로 정리하고 알려진 오류는 유지하며 그 밖의 구성 실패는 `PREVIEW_RENDERER_CREATE_FAILED`로 바꾼다.

세션은 animation frame, decoded image, texture를 소유한 atlas, shader, batcher와 animation track을 정리한다. `pose_default`가 있으면 기본값, 없으면 첫 animation을 반복 재생한다. 목록이 비면 `ANIMATION_MISSING`, 존재하지 않는 이름으로 `play()`하면 현재 animation을 바꾸지 않고 `ANIMATION_UNKNOWN`을 던진다. 새 source의 import와 preview 생성이 모두 성공한 시점에만 기존 session을 dispose하여 실패한 재가져오기가 현재 미리보기를 없애지 않게 한다.

### 10. SHA-256은 browser gate가 아니라 vendoring provenance로 유지한다

고정 fork commit과 세 원본 파일의 hash는 그대로 보존한다.

| 파일 | SHA-256 |
|---|---|
| `third_party/estertion-spine-3.6/spine-webgl.js` | `28dd3ecde3325395fb77d3f87e869308f9e710f16e3d5a79e549ae404c478eb4` |
| `third_party/estertion-spine-3.6/spine-webgl.d.ts` | `ea1439dd2e8fc83d3d26bd6890e706c6e5f0356dae8d9e4d112166170090232b` |
| `third_party/estertion-spine-3.6/LICENSE` | `d2af98ecac7e4bb6e4c4491fc734db7762b94626b18bcc87c7eac6febd86e1b5` |

Vite feature plugin은 development와 production 모두 같은 public URL에 `spine-webgl.js`, `LICENSE`, `THIRD_PARTY_NOTICES.md`를 제공한다. production UI는 LICENSE와 notice에 접근할 수 있는 link를 유지한다. type declaration은 compile-time 원본과 hash 기록에는 남지만 browser 산출물에 복사할 필요가 없다. PRSK 또는 다른 모델 자산은 production bundle에 포함하지 않는다.

repository visibility와 프로젝트 소유자의 license confirmation을 검사하는 build/release task는 두지 않는다. 다만 원문 LICENSE, copyright, fork와 commit 출처를 배포물에 포함하는 runtime 재배포 계약은 유지한다. runtime 고지까지 모두 제거하는 대안은 실제 배포물의 provenance를 잃으므로 선택하지 않는다.

### 11. 문서와 결정 기록은 현재 적용 가능한 계약만 남긴다

README는 version gate, compatibility warning, browser integrity check와 release gate를 제거하고 best-effort 파싱, generic source boundary, first-frame ready와 production 고지·모델 제외를 설명한다. `THIRD_PARTY_NOTICES.md`에서는 license-confirmation 결정 참조를 제거하고 원문 license와 provenance만 유지한다.

사용자 결정에 따라 `DECISIONS.md`에서는 repository visibility와 license-confirmation 정책 항목 및 상호 참조를 제거한다. version gate와 warning을 전제로 한 기존 결정은 새 best-effort·metadata-only 결정으로 대체 관계를 명시한다. 이 정리는 일반적인 append-only 원칙의 예외이며, 존재하지 않는 release policy가 현재 요구사항인 것처럼 읽히지 않게 하는 것을 우선한다.

## Risks / Trade-offs

- [Risk] 3.6과 크게 다른 version이 parser를 비정상적으로 실패시키거나 일부만 읽을 수 있다. → header는 안전하게 경계 검사하고 parser 예외를 `SKELETON_PARSE_FAILED`로 격리하며, 성공한 경우에만 첫 draw까지 완료한 session을 반환한다.
- [Risk] parser가 성공해도 의미상 잘못된 모델이 후속 frame에서 실패할 수 있다. → first draw gate와 session 오류 구독을 모두 두고 실패 시 자원을 즉시 정리한다.
- [Risk] header 문자열의 고정 상한 제거로 큰 문자열 decode 비용이 생길 수 있다. → 선언 길이는 실제 입력 buffer 안으로 제한되며 별도 network source의 전체 파일 크기 제한은 해당 source capability가 소유한다.
- [Risk] same-origin 파일이 배포 뒤 변조되면 browser 자체 hash 검사가 없다. → deployment origin과 build artifact를 신뢰 경계로 두고 vendoring hash, lock된 source file 및 build 검증으로 공급망 재현성을 확인한다.
- [Risk] 암호화 여부 metadata가 ZIP library version별로 다르게 노출될 수 있다. → 지원 library의 공개 encryption flag를 fixture 테스트로 고정하고 판별할 수 없는 encrypted archive도 성공적으로 해제하지 못하면 `ARCHIVE_ENCRYPTED_ENTRY` 또는 `ARCHIVE_CORRUPT`로 안전하게 실패시킨다.
- [Trade-off] compatibility를 UI에 표시하지 않으면 사용자가 실험 상태를 직접 볼 수 없다. → session/header metadata는 유지하여 telemetry나 미래 진단 화면에서 사용할 수 있게 하고 현재 UI는 실제 성공·실패만 전달한다.
- [Trade-off] 여분 파일을 조용히 무시하면 archive 정리 상태를 알 수 없다. → 미리보기 결과에 영향이 없고 모든 안전·자원 검사는 유지되므로 불필요한 warning surface를 줄이는 쪽을 선택한다.
- [Risk] 후속 remote change가 이전 `PrskCharacterPack`과 warning 계약을 계속 참조한다. → 이번 변경에서는 해당 change를 수정하지 않고 archive 후 별도 재정렬 단계에서 `LiveSDAtlasBundle` 기준으로 갱신한다.

## Migration Plan

1. 공개 type과 오류 union을 먼저 변경하고 TypeScript compile failure를 통해 모든 소비 지점을 찾는다.
2. importer를 전체 entry 검증, silent extra handling, strict atlas parsing과 `LiveSDAtlasBundle` 반환에 맞추고 fixture 테스트를 갱신한다.
3. header inspector의 version gate·1024-byte 제한·warning을 제거하고 compatibility classifier와 cross-version 테스트를 추가한다.
4. runtime loader를 direct same-origin classic script 방식으로 교체하고 기존 global, concurrency, retry와 API-shape 테스트를 갱신한다.
5. adapter/session을 generic bundle, first draw gate, `onError()`와 render-failure cleanup 계약으로 변경한다.
6. 앱을 `sourceName`, stable code+한국어 message, unknown fallback과 compatibility 비표시 계약에 맞춘다.
7. build plugin, production artifact test, README, `DECISIONS.md`, `THIRD_PARTY_NOTICES.md`를 production runtime 고지와 모델 제외 계약에 맞춘다.
8. typecheck, lint, unit/component test, production build와 Playwright를 실행하고 `openspec validate reconcile-livesd-preview-contract --strict`를 통과시킨다.
9. delta를 main specs에 sync하고 변경을 archive한 뒤에만 `add-prsk-remote-resource-source`를 새 generic 계약에 맞추는 별도 작업을 시작한다.

기능 회귀 시 code와 문서를 함께 이 변경 전 contract로 되돌린다. runtime 원본 파일과 model asset 공급 방식은 바뀌지 않으므로 data migration은 없다.

## Open Questions

없음. remote source의 오류·우선순위와 추가 version runtime 선택은 각각 후속 변경에서 결정한다.
