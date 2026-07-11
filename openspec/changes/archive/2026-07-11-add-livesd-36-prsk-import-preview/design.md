## Context

프로젝트에는 아직 애플리케이션 스택이나 구현 코드가 없고, 기존 README는 Live2D (Cubism)를 첫 지원 대상으로 가정한다. 로컬에는 `assets/prsk/base_model/sekai_skeleton.skel`과 캐릭터별 `sekai_atlas.atlas` 및 `sekai_atlas.png`가 준비되어 있지만 `assets/` 전체는 Git에서 제외되어 있다.

PRSK 공통 스켈레톤은 `3.6.53D4` 호환 프로필로 식별되며 바이너리에 저장된 실제 version 문자열은 `3.6.53`이다. 공식 LiveSD 3.6 TypeScript 런타임은 바이너리 로딩을 제공하지 않으므로, `SkeletonBinary`가 추가된 esterTion `spine-runtimes` fork의 커밋 `8d79291441394b3a279d5d36f054d563dbc15e16`을 재사용한다. 해당 런타임에는 Spine Runtimes Software License가 적용되므로 개발·통합 시점에 유효한 Spine 라이선스를 확인하고 배포물에 원문 라이선스와 저작권 고지를 포함해야 한다.

프런트엔드 기술 스택과 앱 스캐폴딩은 별도 변경으로 결정하며, 실제 적용 전에는 저장소 비공개 전환, 개발·통합 시점의 라이선스 확인과 로컬 PRSK 자산 준비가 선행되어야 한다.

## Goals / Non-Goals

**Goals:**

- PRSK 캐릭터 ZIP을 브라우저 안에서 안전하게 검증하고 정규화한다.
- 고정된 로컬 공통 스켈레톤과 캐릭터 atlas 및 이미지를 결합한다.
- LiveSD 3.6 바이너리를 수정 런타임으로 읽고 WebGL에서 미리본다.
- 가져오기, 런타임, 미리보기 수명 주기를 독립적인 인터페이스로 분리한다.
- 라이선스와 자산 저작권 경계를 명확히 하고 고지를 보존한 production 배포를 지원한다.

**Non-Goals:**

- 프런트엔드 프레임워크, 번들러, 테스트 러너 또는 ZIP 라이브러리 선택
- 범용 LiveSD ZIP, 여러 캐릭터를 담은 ZIP, LiveSD 3.6 이외 버전 지원
- Live2D (Cubism) 지원
- 자산 추출·다운로드 기능 또는 PRSK 자산의 저장소 포함
- 프레임 캡처, 모션 매핑, 스프라이트 생성, Codex Pet 내보내기
- Spine 라이선스 취득 절차 또는 법률 자문

## Decisions

### 1. PRSK 분리 구조를 입력 계약으로 사용한다

캐릭터 ZIP에는 `.skel`을 포함하지 않고, 중첩 경로를 허용한 정확히 하나의 `sekai_atlas.atlas`와 atlas가 참조하는 모든 PNG 페이지를 포함한다. production에서는 사용자가 공통 `.skel`을 별도 파일로 선택한다. 개발 환경에서는 `public/assets → ../assets` symlink를 통해 같은 출처의 `/assets/prsk/base_model/sekai_skeleton.skel`과 `/assets/prsk/sd_mob003/` atlas/PNG를 입력 미선택 시 자동 로드하며 외부 CDN fallback은 사용하지 않는다. production build는 `publicDir` 복사를 비활성화한다.

범용 단일 모델 ZIP보다 현재 자산 구조를 그대로 검증할 수 있고, 공통 2MiB 스켈레톤을 캐릭터마다 복제하지 않는다는 장점이 있다. 대신 이 importer를 일반 LiveSD importer로 표현하지 않고 `PrskCharacterArchiveImporter`로 한정하며, UI는 공통 스켈레톤과 캐릭터 ZIP을 독립 입력으로 관리한다.

### 2. 가져오기 결과를 런타임 독립 데이터로 정규화한다

외부에 노출되는 최소 계약은 다음과 같다.

```ts
interface PrskCharacterArchiveImporter {
  import(file: File): Promise<PrskCharacterPack>;
}

interface PrskCharacterPack {
  archiveName: string;
  atlasPath: string;
  atlasText: string;
  atlasPages: ReadonlyMap<string, Blob>;
  warnings: readonly ImportWarning[];
}
```

importer는 압축 해제와 경로 검증만 담당한다. object URL 생성, WebGL texture 생성 및 런타임 객체 수명은 어댑터가 담당한다.

### 3. ZIP 입력에 명시적인 자원·경로 제한을 적용한다

- 압축 ZIP 크기: 최대 32MiB
- 압축 해제 후 파일 합계: 최대 64MiB
- 파일 항목 수: 최대 32개
- atlas: 파일명이 정확히 `sekai_atlas.atlas`인 항목 한 개
- 이미지: atlas 페이지 이름을 atlas 경로 기준으로 해석한 PNG

절대 경로, 드라이브 문자, NUL, `..`로 루트를 벗어나는 경로를 거부한다. 동일한 정규화 경로 충돌도 거부한다. 이 제한은 ZIP bomb과 경로 혼동을 막으면서 현재 PRSK 캐릭터 팩 크기에 충분한 여유를 둔다.

### 4. LiveSD 3.6 어댑터가 버전 검사와 런타임 세부사항을 캡슐화한다

```ts
interface LiveSD36Adapter {
  inspectSkeleton(data: ArrayBuffer): LiveSDSkeletonHeader;
  createPreview(input: LiveSD36PreviewInput): Promise<LiveSDPreviewSession>;
}

interface LiveSDPreviewSession {
  readonly version: string;
  readonly animations: readonly string[];
  readonly currentAnimation: string;
  play(name: string): void;
  resize(width: number, height: number): void;
  dispose(): void;
}
```

`inspectSkeleton`은 hash와 version 문자열만 먼저 읽고 `3.6` 계열인지 확인한다. 실제 헤더 `3.6.53`을 `3.6.53D4` 검증 프로필로 판정하며, 그 밖의 3.6 계열은 허용하되 실험적 호환 경고를 반환한다. 다른 계열은 `SkeletonBinary`를 호출하기 전에 거부한다.

PRSK 호환을 위해 어댑터는 원본 스켈레톤을 변경하지 않고 `byteLength + 1` 크기의 새 `Uint8Array`에 복사해 마지막 0바이트가 포함된 버퍼를 `SkeletonBinary.readSkeletonData()`에 전달한다.

### 5. 수정 런타임은 고정 산출물을 classic script로 재사용한다

저장소를 비공개로 전환한 뒤 다음 파일만 `third_party/estertion-spine-3.6/`에 byte-for-byte로 포함한다.

| 파일 | SHA-256 |
|---|---|
| `spine-webgl.js` | `28dd3ecde3325395fb77d3f87e869308f9e710f16e3d5a79e549ae404c478eb4` |
| `spine-webgl.d.ts` | `ea1439dd2e8fc83d3d26bd6890e706c6e5f0356dae8d9e4d112166170090232b` |
| `LICENSE` | `d2af98ecac7e4bb6e4c4491fc734db7762b94626b18bcc87c7eac6febd86e1b5` |

빌드 파일을 ES module로 수정하지 않는다. `LiveSD36RuntimeLoader`가 classic script를 한 번만 로드하고 생성된 전역 `spine`을 `LiveSD36Adapter` 내부로 제한한다. 출처, 커밋, 해시 및 원문 라이선스는 `THIRD_PARTY_NOTICES.md`에 함께 기록한다.

전체 fork, naganeko `chibi-gif` 또는 새 바이너리 파서를 포함하는 대안은 각각 저장소 크기, 라이선스 불확실성 및 구현 비용 때문에 선택하지 않는다.

### 6. 미리보기 세션이 렌더링 수명 주기를 소유한다

어댑터는 `GLTexture`, `TextureAtlas`, `AtlasAttachmentLoader`, `SkeletonBinary`, `Skeleton`, `AnimationStateData`, `AnimationState` 순서로 구성한다. 애니메이션은 스켈레톤 데이터에서 열거하고 `pose_default`가 있으면 기본값으로, 없으면 첫 항목을 선택해 반복 재생한다.

미리보기는 alpha가 활성화된 투명 WebGL 캔버스를 사용하고 모델 bounds를 기준으로 중앙 정렬 및 화면 맞춤을 수행한다. 새 ZIP 가져오기, 컴포넌트 해제 또는 오류 발생 시 animation frame, object URL, texture 및 WebGL 관련 객체를 정리한다.

### 7. 라이선스 확인과 배포 고지를 release gate로 사용한다

런타임 파일을 추가하기 전에 GitHub 저장소가 비공개인지 확인하고, 프로젝트 소유자가 개발·통합 시점에 유효한 Spine 라이선스를 확인했다는 결정을 기록한다. 확인 후에는 production build와 공개 URL 배포를 허용하되, 런타임 원문 라이선스, 저작권, fork 출처와 고정 커밋을 저장소 및 사용자에게 접근 가능한 고지 화면에 보존한다. 사용자가 모델 리소스를 직접 가져오는 구조는 자산 배포와 런타임 배포를 분리하지만 런타임 고지 의무를 대체하지 않는다.

## Risks / Trade-offs

- [Risk] 수정 fork가 오래되어 모든 LiveSD 3.6 patch와 호환된다는 보장이 없다. → 실제 header `3.6.53`인 `3.6.53D4` 프로필만 검증 완료로 표시하고 다른 3.6 파싱 실패를 구분된 오류로 반환한다.
- [Risk] ZIP atlas 형식의 경계 사례를 자체 검증 코드가 놓칠 수 있다. → importer는 페이지 참조와 경로만 검증하고 실제 atlas 해석은 동일 런타임의 `TextureAtlas`에서 다시 검증한다.
- [Risk] WebGL context 또는 GPU 자원이 재가져오기 과정에서 누수될 수 있다. → 단일 `LiveSDPreviewSession.dispose()`가 모든 수명 주기를 소유하고 교체 전에 반드시 호출되게 한다.
- [Risk] 라이선스 확인 기록이나 runtime 고지가 누락된 채 release될 수 있다. → release 점검에서 저장소 visibility, 결정 기록, 원문 라이선스와 사용자 노출 고지를 모두 검증한다.
- [Trade-off] 고정 공통 스켈레톤은 빠른 PRSK 검증에 유리하지만 범용 importer로 재사용할 수 없다. → 향후 범용 LiveSD importer를 별도 capability로 추가한다.

## Migration Plan

1. 별도 OpenSpec 변경에서 프런트엔드 기술 스택과 앱 스캐폴딩을 확정한다.
2. `/opsx:apply` 전에 저장소를 비공개로 전환하고 개발·통합 시점의 유효한 Spine 라이선스 확인 결정을 기록한다.
3. 고정 커밋의 런타임 세 파일과 고지를 추가하고 SHA-256을 검증한다.
4. importer, 런타임 loader/adapter, 미리보기 세션과 UI를 순서대로 구현한다.
5. 원문 라이선스와 저작권·fork 고지를 사용자 화면과 배포물에서 확인한다.
6. 자동 테스트와 gitignore된 PRSK 자산을 이용한 로컬 스모크 테스트를 통과시킨다.
7. 문제가 있으면 런타임 vendoring과 LiveSD 3.6 기능을 제거하고 문서만 유지해 이전 미구현 상태로 되돌린다.

## Open Questions

없음. 프런트엔드 기술 스택은 별도 변경으로 분리했고, production 배포는 개발·통합 시점의 유효한 Spine 라이선스 확인을 전제로 확정했다.
