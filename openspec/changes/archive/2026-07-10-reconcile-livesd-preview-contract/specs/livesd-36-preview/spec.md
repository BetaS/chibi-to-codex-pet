## MODIFIED Requirements

### Requirement: 공통 스켈레톤 입력
시스템은 production에서 사용자가 선택한 단일 `.skel` 파일을 공통 스켈레톤으로 사용해야 한다(MUST). 사용자 선택 파일의 확장자는 대소문자와 관계없이 `.skel`이어야 하며(MUST), 선택 누락과 잘못된 확장자를 각각 `SHARED_SKELETON_REQUIRED`, `SHARED_SKELETON_INVALID_TYPE`으로 구분해야 한다(MUST). 개발 환경에서 사용자가 파일을 선택하지 않은 경우 `public/assets` symlink가 같은 출처로 제공하는 `/assets/prsk/base_model/sekai_skeleton.skel`을 편의 fallback으로 사용해야 하며(MUST), 외부 CDN이나 원격 fallback을 사용해서는 안 된다(MUST NOT). production build는 symlink 대상 PRSK 자산을 포함해서는 안 된다(MUST NOT).

#### Scenario: production 공통 스켈레톤 선택
- **WHEN** production 사용자가 대소문자와 관계없이 `.skel` 확장자인 공통 스켈레톤 파일을 선택한다
- **THEN** 시스템은 파일을 `ArrayBuffer`로 읽어 헤더 검사 단계에 전달한다

#### Scenario: 잘못된 공통 스켈레톤 확장자
- **WHEN** 사용자가 `.skel` 이외의 확장자를 가진 공통 스켈레톤 파일을 선택한다
- **THEN** 시스템은 `SHARED_SKELETON_INVALID_TYPE`과 해결 방법을 설명하는 한국어 메시지를 표시하고 runtime을 시작하지 않는다

#### Scenario: 공통 스켈레톤 로드 성공
- **WHEN** 개발 환경에서 사용자 선택 파일이 없고 고정 개발 경로에 공통 스켈레톤이 존재한다
- **THEN** 시스템은 파일을 `ArrayBuffer`로 읽어 헤더 검사 단계에 전달한다

#### Scenario: production 공통 스켈레톤 누락
- **WHEN** production에서 사용자가 공통 스켈레톤 파일을 선택하지 않는다
- **THEN** 시스템은 `SHARED_SKELETON_REQUIRED`와 `.skel` 선택을 안내하는 한국어 메시지를 표시하고 runtime을 시작하지 않는다

#### Scenario: development 공통 스켈레톤 누락
- **WHEN** development에서 사용자 선택 파일이 없고 고정 개발 fallback이 404 또는 읽기 오류를 반환한다
- **THEN** 시스템은 필요한 로컬 자산 경로를 안내하고 runtime을 시작하지 않는다

### Requirement: LiveSD 3.6 버전 사전 검사
`LiveSD36Adapter`는 runtime 호출 전에 바이너리 헤더에서 hash와 원본 version 문자열을 입력 버퍼 경계 안에서 안전하게 읽어야 한다(MUST). 정상적으로 읽은 version은 입력 허용 여부를 제한하지 않으며(MUST NOT), 어댑터는 모든 version을 고정 LiveSD 3.6 runtime으로 best-effort 파싱해야 한다(MUST). 헤더에는 `verified | experimental | best_effort` 중 하나인 `LiveSDSkeletonCompatibility` metadata를 부여해야 하며(MUST), `3.6.53`과 `3.6.53D4`는 `verified`, 그 밖의 `3.6` 계열은 `experimental`, 다른 major/minor는 `best_effort`로 분류해야 한다(MUST).

#### Scenario: 검증된 version
- **WHEN** 스켈레톤의 원본 header version이 `3.6.53` 또는 `3.6.53D4`이다
- **THEN** 시스템은 원본 문자열을 유지하고 compatibility를 `verified`로 기록한 뒤 runtime 파싱을 시도한다

#### Scenario: 다른 LiveSD 3.6 version
- **WHEN** 스켈레톤의 원본 header version이 `3.6` 계열이지만 `3.6.53` 또는 `3.6.53D4`가 아니다
- **THEN** 시스템은 compatibility를 `experimental`로 기록하고 runtime 파싱을 시도한다

#### Scenario: 다른 major 또는 minor version
- **WHEN** 스켈레톤의 정상적인 원본 header version이 `3.3`, `3.7` 또는 다른 major/minor를 나타낸다
- **THEN** 시스템은 compatibility를 `best_effort`로 기록하고 version gate 없이 LiveSD 3.6 runtime 파싱을 시도한다

#### Scenario: 다른 version의 runtime 파싱 성공
- **WHEN** `best_effort`로 분류된 스켈레톤을 LiveSD 3.6 runtime이 성공적으로 파싱한다
- **THEN** 시스템은 해당 스켈레톤의 미리보기를 허용한다

#### Scenario: 손상된 바이너리 헤더
- **WHEN** hash 또는 version의 길이 varint, 바이트 범위나 strict UTF-8 문자열이 누락·절단·손상되었다
- **THEN** 시스템은 `SKELETON_HEADER_CORRUPT`를 반환하고 runtime을 호출하지 않는다

#### Scenario: 입력 버퍼에 맞춘 안전한 헤더 읽기
- **WHEN** 정상적인 hash 또는 version 문자열이 구현 내부의 임의 고정 길이보다 길지만 전체 값이 입력 버퍼 안에 존재한다
- **THEN** 시스템은 고정 1024-byte 제한으로 거부하지 않고 입력 버퍼 경계 안에서 전체 헤더를 읽는다

### Requirement: 고정 수정 런타임 재사용
시스템은 esterTion `spine-runtimes` 커밋 `8d79291441394b3a279d5d36f054d563dbc15e16`의 고정 `spine-webgl.js`를 same-origin `/vendor/estertion-spine-3.6/spine-webgl.js`에서 classic script로 한 번만 직접 로드하고, 전역 `spine` 접근을 runtime loader와 `LiveSD36Adapter` 경계로 제한해야 한다(MUST). 유효한 runtime은 `SkeletonBinary`, `TextureAtlas`, `AtlasAttachmentLoader`, `webgl.GLTexture` API shape을 모두 제공해야 한다(MUST). 브라우저 loader는 runtime 바이트를 다시 fetch하거나 SHA-256을 계산하거나 Blob URL로 실행해서는 안 된다(MUST NOT).

#### Scenario: 첫 runtime 로드
- **WHEN** 첫 미리보기 세션이 고정 runtime을 요청하고 유효한 전역 `spine`이 없다
- **THEN** loader는 고정 same-origin URL을 `src`로 가진 classic script 하나를 삽입하고 유효한 전역 API를 어댑터에 제공한다

#### Scenario: 이미 로드된 runtime 재사용
- **WHEN** 필요한 API shape을 가진 `window.spine`이 이미 존재한다
- **THEN** loader는 script나 network 요청을 추가하지 않고 같은 runtime을 즉시 반환한다

#### Scenario: 동시 runtime 요청
- **WHEN** 여러 미리보기 요청이 runtime 로드 완료 전에 동시에 `load()`를 호출한다
- **THEN** loader는 동일한 단일 load promise와 runtime instance를 재사용한다

#### Scenario: runtime script 로드 실패
- **WHEN** same-origin script가 network 또는 실행 오류로 load event를 완료하지 못한다
- **THEN** 시스템은 `RUNTIME_SCRIPT_LOAD_FAILED`를 반환하고 실패한 단일 load 상태를 정리해 후속 요청이 다시 시도할 수 있게 한다

#### Scenario: runtime global shape 누락
- **WHEN** script load event 이후 전역 `spine`이 없거나 필수 API shape 중 하나가 없다
- **THEN** 시스템은 `RUNTIME_GLOBAL_MISSING`을 반환하고 미리보기를 생성하지 않는다

### Requirement: PRSK 바이너리 패딩
`LiveSD36Adapter`는 header version이나 compatibility와 관계없이 원본 스켈레톤을 변경하지 않고 한 바이트 큰 새 버퍼에 복사해 마지막 0바이트가 포함된 버퍼를 `SkeletonBinary.readSkeletonData()`에 전달해야 한다(MUST).

#### Scenario: 스켈레톤 파싱
- **WHEN** 정상 헤더를 가진 어떤 version의 스켈레톤을 파싱한다
- **THEN** mock runtime은 입력보다 정확히 한 바이트 크고 마지막 값이 0인 별도 버퍼를 전달받으며 원본 입력은 변경되지 않는다

### Requirement: WebGL 미리보기 구성
시스템은 runtime 독립 `LiveSDAtlasBundle`의 atlas 페이지로 texture를 생성하고 `TextureAtlas`, `AtlasAttachmentLoader`, `SkeletonBinary`, `Skeleton`, `AnimationStateData`, `AnimationState`를 구성해 alpha가 활성화된 WebGL canvas에 렌더링해야 한다(MUST). 세션은 구성뿐 아니라 첫 frame draw까지 성공한 뒤에만 ready가 되어야 한다(MUST).

#### Scenario: 미리보기 생성 성공
- **WHEN** 공통 스켈레톤과 유효한 `LiveSDAtlasBundle` 및 WebGL canvas가 주어지고 첫 frame draw가 성공한다
- **THEN** 시스템은 투명 배경에서 모델을 중앙 정렬하고 bounds에 맞춰 반복 렌더링하며 ready 세션을 반환한다

#### Scenario: WebGL 미지원
- **WHEN** 브라우저가 필요한 WebGL context를 생성하지 못한다
- **THEN** 시스템은 `WEBGL_UNSUPPORTED`를 표시하고 부분 생성된 자원을 정리한다

#### Scenario: runtime 파싱 실패
- **WHEN** 정상 헤더를 가진 스켈레톤을 고정 LiveSD 3.6 runtime이 파싱하지 못한다
- **THEN** 시스템은 실제 입력 version과 runtime `3.6`을 포함한 `SKELETON_PARSE_FAILED`를 표시하고 compatibility label 없이 자원을 정리한다

#### Scenario: 첫 frame 렌더 실패
- **WHEN** runtime 객체 구성은 성공했지만 첫 frame의 update, apply 또는 draw가 실패한다
- **THEN** 미리보기 생성은 `PREVIEW_RENDER_FAILED`로 실패하고 animation frame과 모든 부분 생성 자원을 정리하며 ready 상태를 노출하지 않는다

#### Scenario: 지속 렌더 실패
- **WHEN** ready 세션의 후속 animation frame에서 update, apply 또는 draw가 실패한다
- **THEN** 세션은 `PREVIEW_RENDER_FAILED`를 한 번 알리고 반복 렌더링과 소유 자원을 정리한다

### Requirement: 애니메이션 탐색과 재생
`LiveSDPreviewSession`은 스켈레톤의 모든 애니메이션 이름을 제공하고 유효한 애니메이션을 반복 재생하며 runtime 세부 객체를 외부에 노출하지 않아야 한다(MUST).

#### Scenario: 기본 pose가 존재함
- **WHEN** 애니메이션 목록에 `pose_default`가 있다
- **THEN** 세션은 `pose_default`를 기본 애니메이션으로 선택해 반복 재생한다

#### Scenario: 기본 pose가 없음
- **WHEN** 애니메이션 목록에 `pose_default`가 없고 다른 애니메이션이 있다
- **THEN** 세션은 목록의 첫 애니메이션을 기본값으로 반복 재생한다

#### Scenario: 애니메이션 전환
- **WHEN** 사용자가 목록에 존재하는 다른 애니메이션을 선택한다
- **THEN** 세션은 선택한 애니메이션으로 전환하고 `currentAnimation`을 갱신한다

#### Scenario: 알 수 없는 애니메이션 선택
- **WHEN** 호출자가 세션의 애니메이션 목록에 없는 이름으로 전환을 요청한다
- **THEN** 세션은 현재 재생을 유지하고 `ANIMATION_UNKNOWN`을 반환한다

#### Scenario: 애니메이션이 없음
- **WHEN** 파싱된 스켈레톤에 애니메이션이 하나도 없다
- **THEN** 시스템은 `ANIMATION_MISSING`을 반환하고 미리보기를 시작하지 않는다

### Requirement: 미리보기 수명 주기 정리
`LiveSDPreviewSession.dispose()`는 animation frame, image decode 자원, texture 및 세션이 소유한 rendering 자원을 한 번만 안전하게 해제해야 한다(MUST). 새 source 가져오기와 UI unmount는 기존 세션을 먼저 해제해야 한다(MUST). 세션은 ready 이후 비동기 렌더 오류를 한 번 전달하고 구독을 해제할 수 있는 runtime 독립 오류 알림 경계를 제공해야 한다(MUST).

#### Scenario: 새 source 가져오기
- **WHEN** 활성 미리보기가 있는 상태에서 새 atlas source를 성공적으로 가져온다
- **THEN** 시스템은 기존 세션을 dispose한 뒤 새 세션을 생성한다

#### Scenario: UI unmount
- **WHEN** 미리보기 UI가 unmount된다
- **THEN** 시스템은 활성 세션과 오류 구독을 해제한다

#### Scenario: 비동기 렌더 오류 알림
- **WHEN** ready 이후 렌더 loop가 실패한다
- **THEN** 세션은 정규화된 `PREVIEW_RENDER_FAILED`를 구독자에게 한 번 전달하고 스스로 dispose한다

#### Scenario: 중복 dispose
- **WHEN** 동일한 세션의 `dispose()`를 두 번 이상 호출한다
- **THEN** 시스템은 오류나 중복 해제 없이 첫 호출에서만 자원을 정리한다

### Requirement: 런타임 출처와 무결성 기록
시스템 저장소는 vendoring된 runtime의 원본 fork와 commit, 파일별 SHA-256, 원문 LICENSE와 copyright notice를 함께 보존해야 한다(MUST). production 산출물은 실행에 필요한 `spine-webgl.js`, 원문 LICENSE와 사용자 접근 가능한 third-party notice를 포함해야 하며(MUST), PRSK 또는 다른 모델 자산을 포함해서는 안 된다(MUST NOT). 브라우저 runtime loader는 이 기록용 SHA-256을 실행 전 검증 조건으로 사용해서는 안 된다(MUST NOT).

#### Scenario: vendoring 파일 검증
- **WHEN** vendoring 또는 dependency provenance 검증 작업을 수행한다
- **THEN** `spine-webgl.js`, type declaration과 원문 LICENSE의 SHA-256이 설계 문서와 `THIRD_PARTY_NOTICES.md`의 값과 일치한다

#### Scenario: production runtime 고지
- **WHEN** production build를 생성한다
- **THEN** 산출물에는 same-origin runtime JavaScript, 원문 LICENSE와 fork·commit·copyright 정보를 담은 사용자 접근 가능한 third-party notice가 포함된다

#### Scenario: production 모델 자산 제외
- **WHEN** production build 내용을 검사한다
- **THEN** PRSK symlink 대상과 다른 사용자 모델 자산이 포함되지 않는다

## ADDED Requirements

### Requirement: 안정적인 LiveSD 진단 계약
runtime loader와 `LiveSD36Adapter`가 반환하는 알려진 실패는 아래의 안정적인 영문 code만 사용해야 하며(MUST), UI는 code와 문제 해결에 필요한 한국어 message를 함께 표시해야 한다(MUST). 관련 path 또는 실제 input version이 있으면 구조화된 정보나 message에 포함해야 한다(MUST). 알려지지 않은 예외는 stack이나 원문 예외를 노출하지 않고 `PREVIEW_UNKNOWN_ERROR`와 일반적인 한국어 message로 정규화해야 한다(MUST). compatibility metadata는 programmatic contract로만 제공하고 UI에 label, badge 또는 warning으로 표시해서는 안 된다(MUST NOT).

```text
RuntimeLoadErrorCode =
  RUNTIME_SCRIPT_LOAD_FAILED
  RUNTIME_GLOBAL_MISSING

LiveSDPreviewErrorCode =
  ANIMATION_MISSING
  ANIMATION_UNKNOWN
  ATLAS_IMAGE_DECODE_FAILED
  ATLAS_RUNTIME_PARSE_FAILED
  PREVIEW_RENDERER_CREATE_FAILED
  PREVIEW_RENDER_FAILED
  SKELETON_HEADER_CORRUPT
  SKELETON_PARSE_FAILED
  WEBGL_UNSUPPORTED

PreviewUIFallbackErrorCode =
  PREVIEW_UNKNOWN_ERROR

LiveSDSkeletonCompatibility =
  verified
  experimental
  best_effort
```

#### Scenario: 알려진 오류 표시
- **WHEN** runtime loader 또는 adapter가 위 enum의 알려진 오류를 반환한다
- **THEN** UI는 안정적인 영문 code와 실행 가능한 한국어 message를 함께 표시한다

#### Scenario: 알 수 없는 예외 정규화
- **WHEN** importer, input, runtime 또는 preview 경계 밖의 예외가 UI까지 전파된다
- **THEN** UI는 raw exception이나 stack 대신 `PREVIEW_UNKNOWN_ERROR`와 일반적인 한국어 오류 message를 표시한다

#### Scenario: compatibility 비표시
- **WHEN** 세션 또는 header가 `experimental`이나 `best_effort` compatibility를 가진다
- **THEN** 호출자는 metadata를 programmatic하게 읽을 수 있지만 UI는 compatibility 상태를 표시하지 않는다

#### Scenario: parse 실패 정보
- **WHEN** `SKELETON_PARSE_FAILED`를 사용자에게 표시한다
- **THEN** message는 실제 input version과 사용한 LiveSD runtime `3.6`을 포함하고 `verified`, `experimental`, `best_effort` label은 포함하지 않는다

## REMOVED Requirements

### Requirement: 저장소와 라이선스 배포 게이트
**Reason**: 저장소 visibility와 프로젝트 소유자의 라이선스 확인 여부는 미리보기 capability가 runtime에서 판정할 제품 동작이 아니며, production 배포 차단 조건으로 유지하지 않기로 결정했다.

**Migration**: 자동 또는 수동 release gate는 제거한다. 원문 LICENSE, copyright notice, fork·고정 commit·SHA-256 provenance를 보존하고 production 산출물에서 사용자가 고지에 접근할 수 있게 하는 배포 계약은 `런타임 출처와 무결성 기록` 요구사항으로 유지한다.
