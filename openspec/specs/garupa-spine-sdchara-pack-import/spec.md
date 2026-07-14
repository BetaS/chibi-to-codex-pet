# Garupa Spine SD canonical pack import 명세

## Purpose

획득 경로와 독립적인 Garupa Spine SD canonical ZIP의 구조, 검증, import와 오류 계약을 정의한다.

## Requirements

### Requirement: Garupa Spine SD canonical ZIP 입력

시스템은 사용자가 명시적으로 선택한 하나의 local ZIP에서 한 `sdchara` 의상의 Garupa LiveSD 입력을 가져와야 한다(MUST). ZIP root에는 정확히 하나의 `garupa-spine-pack.json`이 있어야 하며(MUST), manifest는 `schemaVersion: 1`, `gameId: "garupa"`, `assetFamily: "sdchara"`, `sdAssetBundleName`, `modelName`, `skeletonPath`, `atlasPath`, `files`와 `provenance`를 포함해야 한다(MUST). `sdAssetBundleName`과 `modelName`은 1–128자의 ASCII 영숫자, `_`, `-`만 포함하는 단일 segment여야 하고(MUST), `skeletonPath`는 `model/` 아래의 단일 `.skel`, `atlasPath`는 `costume/` 아래의 단일 `.atlas` entry를 가리켜야 한다(MUST). `files`는 skeleton, atlas와 모든 PNG entry의 정규화 경로를 lowercase 64자리 SHA-256 hex에 1:1로 대응해야 하며(MUST), `provenance`는 `sourceKind`, immutable `sourceRevision`과 RFC 3339 `acquiredAt`을 기록해야 한다(MUST). Manifest가 가리키지 않는 다른 `.skel` 또는 `.atlas`가 있으면 입력을 모호한 pack으로 거부해야 한다(MUST).

#### Scenario: 유효한 canonical pack
- **WHEN** manifest가 `sdAssetBundleName: "00001"`, `modelName: "s000_templete"`, `skeletonPath: "model/s000_templete.skel"`, `atlasPath: "costume/u000_templete.atlas"`를 선언하고 대응 entry와 모든 atlas PNG page가 존재한다
- **THEN** importer는 Garupa `sdchara` pack의 구조·경로 검증을 계속한다

#### Scenario: manifest와 실제 entry 불일치
- **WHEN** manifest가 선언한 skeleton 또는 atlas entry가 없거나 다른 대소문자 경로에만 존재한다
- **THEN** importer는 `GARUPA_MANIFEST_INVALID`로 전체 pack을 거부하고 runtime을 시작하지 않는다

#### Scenario: 여러 skeleton 또는 atlas
- **WHEN** ZIP에 manifest가 가리키는 파일 외의 `.skel` 또는 `.atlas` entry가 존재한다
- **THEN** importer는 `GARUPA_MODEL_AMBIGUOUS`로 전체 pack을 거부한다

#### Scenario: 파일 hash 불일치
- **WHEN** skeleton, atlas 또는 PNG entry의 계산한 SHA-256이 manifest `files`의 값과 다르다
- **THEN** importer는 `GARUPA_PACK_HASH_MISMATCH`로 전체 pack을 거부하고 부분 source를 노출하지 않는다

#### Scenario: mutable source provenance
- **WHEN** pack이 mutable branch나 latest URL에서 획득됐지만 immutable commit·object revision을 `sourceRevision`에 기록하지 않았다
- **THEN** importer는 `GARUPA_MANIFEST_INVALID`로 거부하고 재현 가능한 revision을 요구한다

### Requirement: Spine sdchara 자산군 구분

Importer는 manifest의 `assetFamily`이 정확히 `sdchara`인 Spine pack만 허용해야 한다(MUST). Bestdori 또는 게임 경로의 `characters/livesd/**`, `sdchara.png`, `anim001`–`anim004` sprite rect 중심 입력은 실제 라이브 무대용 sprite 자산으로 식별해 `GARUPA_LIVE_SPRITE_UNSUPPORTED`로 거부해야 하며(MUST), Live2D (Cubism) manifest와 file extension은 `GARUPA_ASSET_FAMILY_UNSUPPORTED`로 거부해야 한다(MUST).

#### Scenario: 실제 LIVE 4-frame sprite 입력
- **WHEN** 입력이 `.skel`과 `.atlas` 없이 `sdchara.png`와 `anim001`–`anim004` sprite metadata만 포함한다
- **THEN** importer는 `GARUPA_LIVE_SPRITE_UNSUPPORTED`를 반환하고 Spine 변환을 시도하지 않는다

#### Scenario: Live2D 입력
- **WHEN** manifest 또는 entry가 Cubism `.moc`, `.moc3`, `.model.json` 자산군을 나타낸다
- **THEN** importer는 `GARUPA_ASSET_FAMILY_UNSUPPORTED`를 반환하고 LiveSD runtime을 시작하지 않는다

### Requirement: Garupa ZIP 경로와 자원 안전성

Importer는 암호화된 entry, symlink, NUL, absolute·drive path, 빈 segment, `.`·`..`, backslash와 정규화 후 중복·대소문자 충돌 경로를 거부해야 한다(MUST). 시스템은 압축 ZIP 32MiB, 압축 해제 후 전체 file 합계 64MiB, directory를 제외한 file entry 32개의 제한을 적용해야 하며(MUST), 결과에서 사용하지 않는 entry도 안전성 검사와 자원 제한에 포함해야 한다(MUST).

#### Scenario: archive root 이탈
- **WHEN** ZIP entry, manifest path 또는 atlas page reference가 `../`, absolute path나 drive path로 canonical root를 이탈한다
- **THEN** importer는 `GARUPA_PACK_UNSAFE_PATH`로 전체 pack을 거부하고 어떤 byte도 runtime에 전달하지 않는다

#### Scenario: 정규화 경로 충돌
- **WHEN** 서로 다른 entry가 separator, segment 또는 대소문자 정규화 후 같은 경로가 된다
- **THEN** importer는 `GARUPA_PACK_PATH_COLLISION`으로 전체 pack을 거부한다

#### Scenario: 압축 해제 한도 초과
- **WHEN** ZIP metadata의 모든 file size 합계가 64MiB를 초과한다
- **THEN** importer는 file content를 압축 해제하기 전에 `GARUPA_PACK_TOO_LARGE`로 거부한다

#### Scenario: 암호화된 entry
- **WHEN** ZIP에 암호화 flag가 설정된 entry가 하나라도 있다
- **THEN** importer는 `GARUPA_PACK_ENCRYPTED`로 전체 pack을 거부한다

### Requirement: Atlas page와 straight-alpha 검증

Importer는 manifest의 atlas를 strict UTF-8 텍스트로 읽고 하나 이상의 texture page를 찾아야 한다(MUST). 모든 page reference는 atlas entry의 directory 안에 있는 안전한 상대 경로와 `.png` 확장자를 사용해야 하고(MUST), ZIP의 유일한 대응 entry는 PNG signature와 성공적인 image decode를 가져야 한다(MUST). 모든 atlas page는 `pma`가 없거나 `false`여야 하며(MUST), `pma: true` 또는 page별 혼합 alpha mode는 `GARUPA_ALPHA_MODE_UNSUPPORTED`로 거부해야 한다(MUST). 성공 결과의 alpha mode는 `straight`여야 한다(MUST).

#### Scenario: 단일 page straight-alpha atlas
- **WHEN** atlas가 `pma`를 생략한 PNG page 하나를 선언하고 대응 PNG가 유효하다
- **THEN** importer는 해당 page를 정확히 한 번 포함하고 `alphaMode: "straight"`로 검증을 계속한다

#### Scenario: 다중 page atlas
- **WHEN** atlas가 서로 다른 PNG page 둘 이상을 선언하고 ZIP에 모든 대응 entry가 존재한다
- **THEN** 결과 bundle은 atlas 순서와 상대 경로를 유지해 모든 page를 정확히 한 번 포함한다

#### Scenario: PMA page 거부
- **WHEN** atlas page 하나라도 `pma: true`를 선언한다
- **THEN** importer는 `GARUPA_ALPHA_MODE_UNSUPPORTED`로 전체 pack을 거부하고 texture를 생성하지 않는다

#### Scenario: 누락되거나 잘못된 PNG
- **WHEN** atlas page가 누락됐거나 `.png` entry의 payload가 PNG signature 또는 image decode 검사를 통과하지 못한다
- **THEN** importer는 각각 `GARUPA_ATLAS_PAGE_MISSING` 또는 `GARUPA_TEXTURE_INVALID`로 전체 pack을 거부한다

### Requirement: Garupa Spine 4.0 skeleton 검증

Importer는 공통 binary header reader로 skeleton의 hash와 원본 version을 입력 버퍼 경계 안에서 읽어야 한다(MUST). `4.0.64`는 `verified`, 그 밖의 정상 `4.0.x`는 `experimental` compatibility로 기록하고 Spine 4.0 runtime parse 대상으로 허용해야 한다(MUST). 다른 major/minor와 손상된 header는 runtime 호출 전에 각각 `GARUPA_SKELETON_UNSUPPORTED_VERSION`, `GARUPA_SKELETON_CORRUPT`로 거부해야 한다(MUST). Spine 4.0 skeleton byte는 변경하지 않고 원본 `ArrayBuffer` 그대로 전달해야 한다(MUST).

#### Scenario: 검증된 4.0.64 skeleton
- **WHEN** skeleton header version이 `4.0.64`이다
- **THEN** importer는 원본 hash와 version을 보존하고 `runtimeKey: "spine-4.0"`, compatibility `verified`로 runtime 단계에 전달한다

#### Scenario: 다른 4.0 patch
- **WHEN** 정상 skeleton header version이 `4.0.65` 또는 다른 `4.0.x`이다
- **THEN** importer는 compatibility `experimental`로 기록하고 같은 Spine 4.0 runtime parse를 시도하도록 전달한다

#### Scenario: 다른 major 또는 minor
- **WHEN** skeleton header version이 `3.6`, `3.8`, `4.1` 또는 다른 major/minor이다
- **THEN** importer는 실제 version을 포함한 `GARUPA_SKELETON_UNSUPPORTED_VERSION`으로 거부하고 다른 runtime으로 fallback하지 않는다

#### Scenario: 4.0 byte 보존
- **WHEN** 정상 4.0 skeleton을 runtime 입력으로 준비한다
- **THEN** 전달된 byte length와 전체 byte는 ZIP entry 원본과 같아야 하고 끝에 NUL padding을 추가해서는 안 된다

### Requirement: Source 독립 Garupa handoff

검증 성공 결과는 원본 skeleton `ArrayBuffer`, 정규화된 `LiveSDAtlasBundle`, `gameId: "garupa"`, `assetFamily: "sdchara"`, `sdAssetBundleName`, `modelName`, `runtimeKey: "spine-4.0"`, 원본 version·header hash, 검증된 file SHA-256, 정규화된 provenance, `alphaMode: "straight"`, `lookRigProfile: "garupa-dual-eye-v1"`만 source metadata로 제공해야 한다(MUST). Bestdori URL, Unity `buildData.asset`, `*_Atlas.asset`, Unity bundle, runtime 객체와 object URL을 결과에 포함해서는 안 된다(MUST NOT).

#### Scenario: 검증된 source 결과
- **WHEN** manifest, ZIP 안전성, skeleton, atlas와 모든 PNG 검증이 성공한다
- **THEN** importer는 같은 pack에서 나온 runtime 독립 입력과 canonical Garupa metadata를 원자적으로 반환한다

#### Scenario: 검증 중 실패
- **WHEN** 필수 검증 단계가 하나라도 실패한다
- **THEN** importer는 부분 source 결과나 object URL을 노출하지 않고 소유한 임시 자원을 정리한다

### Requirement: Session-only source와 artifact 경계

Garupa source byte와 선택 상태는 사용자가 `불러오기`를 명시적으로 실행한 현재 browser session의 memory에서만 처리해야 한다(MUST). Local ZIP 경로는 외부 request를 보내서는 안 되고(MUST NOT), pinned snapshot 경로는 승인 manifest의 exact commit delivery origin에만 request할 수 있다(MAY). 두 경로 모두 source byte, entry, hash와 캐릭터 선택을 persistent storage에 기록해서는 안 된다(MUST NOT). Production web과 CLI artifact는 provider manifest metadata를 제외한 원본 Garupa `.skel`, atlas, PNG, buildData, ZIP, Unity bundle과 downloader를 포함해서는 안 된다(MUST NOT).

#### Scenario: local pack 불러오기
- **WHEN** 사용자가 canonical ZIP을 선택하고 명시적으로 `불러오기`를 실행한다
- **THEN** importer는 선택한 browser `File` byte만 처리하고 remote fallback 요청을 0건으로 유지한다

#### Scenario: pinned snapshot materialization
- **WHEN** approved remote adapter가 exact commit의 file graph를 검증한다
- **THEN** importer handoff는 provider URL이나 buildData 객체 없이 local ZIP과 같은 canonical skeleton·atlas·PNG·hash metadata만 받는다

#### Scenario: 새로고침 뒤 초기화
- **WHEN** 사용자가 Garupa pack을 처리한 뒤 페이지를 새로고침한다
- **THEN** pack byte, source metadata와 preview session이 없는 idle 상태로 시작한다

#### Scenario: production artifact 검사
- **WHEN** production web과 CLI artifact allowlist를 검사한다
- **THEN** Garupa 원본 asset, fixture, downloader와 Bestdori endpoint는 없고 승인된 repository·commit·delivery metadata만 포함될 수 있다

### Requirement: 안정적인 Garupa pack 오류 계약

Importer는 아래 영문 code만 알려진 pack 오류로 사용해야 하며(MUST), 알 수 없는 실패는 `GARUPA_PACK_CORRUPT`로 정규화해야 한다(MUST).

```text
GARUPA_PACK_CORRUPT
GARUPA_PACK_ENCRYPTED
GARUPA_PACK_TOO_LARGE
GARUPA_PACK_UNSAFE_PATH
GARUPA_PACK_PATH_COLLISION
GARUPA_PACK_HASH_MISMATCH
GARUPA_MANIFEST_MISSING
GARUPA_MANIFEST_INVALID
GARUPA_ASSET_FAMILY_UNSUPPORTED
GARUPA_LIVE_SPRITE_UNSUPPORTED
GARUPA_MODEL_AMBIGUOUS
GARUPA_ATLAS_INVALID
GARUPA_ATLAS_PAGE_MISSING
GARUPA_TEXTURE_INVALID
GARUPA_ALPHA_MODE_UNSUPPORTED
GARUPA_SKELETON_CORRUPT
GARUPA_SKELETON_UNSUPPORTED_VERSION
```

#### Scenario: 알려진 pack 실패
- **WHEN** manifest, 자산군, path, 자원 한도, skeleton, atlas 또는 texture 검증이 실패한다
- **THEN** importer는 위 집합의 해당 code와 현재 locale로 변환 가능한 구조화된 진단을 반환하고 부분 source를 노출하지 않는다
