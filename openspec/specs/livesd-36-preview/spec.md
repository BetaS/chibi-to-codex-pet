# LiveSD 3.6 미리보기 명세

## Purpose

LiveSD (Spine 3.6) skeleton과 atlas/PNG를 browser WebGL session으로 만들고 실제 animation을 재생한다. 이 capability는 입력 검증, runtime loading, framing, pointer look, 수평 반전, 오류와 session lifecycle을 담당한다.

## Requirements

### Requirement: 공통 스켈레톤 입력
시스템은 active resource source와 일치하는 하나의 공통 LiveSD 3.6 skeleton 입력을 사용해야 한다(MUST). Production upload source는 사용자가 선택한 단일 `.skel` file을 사용하고, provided/custom source는 사용자가 model option을 commit한 뒤 `PrskRemoteResourceSource`가 반환한 skeleton을 사용해야 한다(MUST). Upload file의 확장자는 대소문자와 관계없이 `.skel`이어야 하며(MUST), 선택 누락과 잘못된 확장자를 각각 `SHARED_SKELETON_REQUIRED`, `SHARED_SKELETON_INVALID_TYPE`으로 구분해야 한다(MUST). Development upload source는 file 선택이 없을 때 same-origin `/assets/prsk/base_model/sekai_skeleton.skel`을 사용할 수 있다(MAY). Source failure는 선택된 source의 오류로 처리하고(MUST), production model asset은 runtime source에서 제공되어야 한다(MUST).

#### Scenario: Production upload 공통 스켈레톤 선택
- **WHEN** production upload source 사용자가 대소문자와 관계없이 `.skel` 확장자인 공통 스켈레톤 파일을 선택한다
- **THEN** 시스템은 파일을 `ArrayBuffer`로 읽어 헤더 검사 단계에 전달한다

#### Scenario: 잘못된 upload 공통 스켈레톤 확장자
- **WHEN** upload source 사용자가 `.skel` 이외의 확장자를 가진 공통 스켈레톤 파일을 선택한다
- **THEN** 시스템은 `SHARED_SKELETON_INVALID_TYPE`과 해결 방법을 설명하는 현재 locale의 message를 표시하고 runtime을 시작하지 않는다

#### Scenario: Production remote 공통 스켈레톤 선택
- **WHEN** production provided 또는 custom source 사용자가 유효한 catalog dropdown에서 캐릭터를 명시적으로 선택한다
- **THEN** 시스템은 검증·제한된 원격 스켈레톤 `ArrayBuffer`를 버전 검사 단계에 전달한다

#### Scenario: Development 공통 스켈레톤 로드 성공
- **WHEN** development upload source에서 사용자 선택 파일이 없고 고정 개발 경로에 공통 스켈레톤이 존재한다
- **THEN** 시스템은 파일을 `ArrayBuffer`로 읽어 헤더 검사 단계에 전달한다

#### Scenario: Production upload 공통 스켈레톤 누락
- **WHEN** production upload source에서 사용자가 공통 스켈레톤 파일을 선택하지 않는다
- **THEN** 시스템은 `SHARED_SKELETON_REQUIRED`와 `.skel` 선택을 안내하는 현재 locale의 message를 표시하고 runtime을 시작하지 않는다

#### Scenario: Development 공통 스켈레톤 누락
- **WHEN** development upload source에서 사용자 선택 파일이 없고 고정 개발 source가 404 또는 읽기 오류를 반환한다
- **THEN** 시스템은 필요한 로컬 자산 경로를 안내하고 runtime을 시작하지 않는다

#### Scenario: Upload source 실패 격리
- **WHEN** upload source의 공통 스켈레톤 입력이 없거나 로드에 실패한다
- **THEN** 시스템은 upload source 오류를 유지하고 provided/custom request generation을 시작하지 않는다

### Requirement: LiveSD 3.6 버전 사전 검사
`LiveSD36Adapter`는 runtime 호출 전에 바이너리 헤더에서 hash와 원본 version 문자열을 입력 버퍼 경계 안에서 안전하게 읽어야 한다(MUST). 정상적인 헤더를 가진 skeleton은 고정 LiveSD 3.6 runtime의 best-effort parse 대상으로 전달해야 한다(MUST). 헤더에는 `verified | experimental | best_effort` 중 하나인 `LiveSDSkeletonCompatibility` metadata를 부여해야 하며(MUST), `3.6.53`과 `3.6.53D4`는 `verified`, 그 밖의 `3.6` 계열은 `experimental`, 다른 major/minor는 `best_effort`로 분류해야 한다(MUST).

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
시스템은 esterTion `spine-runtimes` 커밋 `8d79291441394b3a279d5d36f054d563dbc15e16`의 고정 `spine-webgl.js`를 same-origin `/vendor/estertion-spine-3.6/spine-webgl.js`에서 classic script로 한 번 직접 로드하고, 전역 `spine` 접근을 runtime loader와 `LiveSD36Adapter` 경계로 제한해야 한다(MUST). 유효한 runtime은 `SkeletonBinary`, `TextureAtlas`, `AtlasAttachmentLoader`, `webgl.GLTexture` API shape을 모두 제공해야 한다(MUST). Runtime byte와 SHA-256은 build-time provenance 검사가 담당하고 browser loader는 packaged same-origin script URL을 사용해야 한다(MUST).

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
시스템은 runtime 독립 `LiveSDAtlasBundle`의 atlas 페이지로 texture를 생성하고 `TextureAtlas`, `AtlasAttachmentLoader`, `SkeletonBinary`, `Skeleton`, `AnimationStateData`, `AnimationState`를 구성해 alpha가 활성화되고 depth와 stencil이 비활성화된 WebGL canvas에 렌더링해야 한다(MUST). 미리보기는 선택 animation의 첫 frame을 보수적인 coarse bounds로 렌더링한 실제 alpha pixel bounds를 world 좌표로 역변환해 framing을 보정해야 하며(MUST), texture가 투명한 attachment를 포함하는 raw `Skeleton.getBounds()`를 최종 framing 근거로 사용해서는 안 된다(MUST NOT). 매 frame draw 전에 depth test와 depth write 및 cull, scissor, stencil state를 비활성화하고(MUST), attachment를 임의 z 값이나 이름으로 재정렬하지 않은 채 현재 `skeleton.drawOrder`와 alpha blending으로 겹침 순서를 결정해야 한다(MUST). 세션은 보정된 첫 frame draw까지 성공한 뒤에만 ready가 되어야 한다(MUST).

#### Scenario: 미리보기 생성 성공
- **WHEN** 공통 스켈레톤과 유효한 `LiveSDAtlasBundle` 및 WebGL canvas가 주어지고 첫 frame draw가 성공한다
- **THEN** 시스템은 투명 배경에서 첫 coarse render의 실제 alpha bounds 기준으로 모델을 중앙 정렬해 다시 그리고 ready 세션을 반환한다

#### Scenario: 투명 texture placeholder
- **WHEN** 현재 pose에 world geometry는 크지만 texture pixel이 완전 투명한 Region 또는 Mesh attachment가 있다
- **THEN** 시스템은 coarse render의 alpha bounds 보정으로 해당 placeholder를 최종 framing에서 제외하고 보이는 캐릭터를 축소하지 않는다

#### Scenario: animation 전환 framing
- **WHEN** 사용자가 다른 animation으로 재생을 전환한다
- **THEN** 시스템은 새 animation의 첫 pose를 coarse render해 실제 alpha bounds로 framing을 다시 보정한다

#### Scenario: draw order 기반 겹침
- **WHEN** 동일 평면의 둘 이상의 attachment가 겹치거나 animation draw-order timeline이 순서를 변경한다
- **THEN** renderer는 depth 판정이나 임의 z offset 없이 현재 `skeleton.drawOrder` 순서로 합성한다

#### Scenario: 오염된 depth state 복구
- **WHEN** 첫 frame 또는 후속 frame 전에 WebGL depth test나 depth write state가 활성화되어 있다
- **THEN** renderer는 draw 전에 depth test와 depth write를 다시 비활성화해 같은 입력을 같은 순서로 렌더링한다

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

### Requirement: 사용자 조절 가능한 Pet framing 미리보기
ready WebGL preview는 최종 `192×208` cell과 같은 aspect ratio의 visible border box를 표시해야 하며(MUST), 자동 안전 fit 대비 `80%–150%`, 기본 `100%`, 1% 단위의 Pet 크기와 최종 cell pixel 기준 X `-96..96`, Y `-104..104`, 기본 `0,0`, 1px 단위 offset control을 제공해야 한다(MUST). `+X`는 오른쪽, `+Y`는 아래쪽 이동이어야 한다(MUST). 각 control은 보이는 label, 현재 값과 단위, keyboard 조작과 접근 가능한 현재값을 제공해야 하며(MUST), preview가 없을 때 비활성화되어야 한다(MUST). Framing 변경은 cached alpha-calibrated WebGL projection에 즉시 적용하고(MUST), 같은 calibration과 animation pose를 다시 그려야 한다(MUST). 선택 framing은 animation 변경과 canvas resize에서 유지하고(MUST), 새 source가 성공적으로 ready가 되면 `100%, 0, 0`으로 초기화해야 한다(MUST).

#### Scenario: 150% 확대와 border box
- **WHEN** 사용자가 ready preview의 Pet 크기를 100%에서 150%로 변경한다
- **THEN** 같은 pose의 가시 최대축은 raster 반올림 오차 안에서 약 1.5배가 되고 `192×208` border box 밖의 부분은 preview에서 잘린다

#### Scenario: X/Y offset 방향
- **WHEN** 사용자가 X를 `+12px`, Y를 `+8px`로 설정한다
- **THEN** 현재 pose는 export cell 기준 오른쪽 12px, 아래쪽 8px로 이동하고 border box는 움직이지 않는다

#### Scenario: keyboard와 접근 가능한 현재값
- **WHEN** 사용자가 Pet 크기 또는 offset control에 focus하고 방향키를 누른다
- **THEN** 배율은 1%, offset은 1px씩 변경되고 보이는 output과 접근 가능한 현재값이 같은 값을 표시한다

#### Scenario: animation과 resize에서 framing 유지
- **WHEN** 125%, X `-10px`, Y `6px`를 선택한 뒤 animation을 전환하거나 preview canvas를 resize한다
- **THEN** session은 세 값을 유지하고 새 pose 보정 또는 resize projection에 같은 framing을 적용한다

#### Scenario: 새 source의 기본 framing
- **WHEN** 다른 local 또는 remote source가 첫 frame까지 성공해 active source가 된다
- **THEN** framing은 `100%, 0, 0`으로 초기화되고 이전 source가 loading 또는 실패한 동안에는 기존 active framing을 바꾸지 않는다

#### Scenario: 잘못된 session framing
- **WHEN** session API가 범위 밖, 비정수 offset 또는 유한하지 않은 배율·offset을 받는다
- **THEN** session은 값을 적용하지 않고 범위 오류를 반환한다

### Requirement: 애니메이션 탐색과 재생
`LiveSDPreviewSession`은 active local 또는 remote 스켈레톤을 실제로 파싱해 얻은 모든 애니메이션 이름을 제공하고 유효한 애니메이션을 반복 재생하며 runtime 세부 객체를 외부에 노출하지 않아야 한다(MUST). UI의 animation dropdown은 검색 가능한 accessible combobox여야 하고(MUST), underlying option은 현재 ready 세션의 `animations`와 순서까지 1:1로 일치해야 하며(MUST), 번들·하드코딩 애니메이션 목록이나 catalog metadata를 option으로 합쳐서는 안 된다(MUST NOT). 검색 query는 애니메이션 이름에 대한 대소문자를 구분하지 않는 substring match로 visible option만 클라이언트에서 필터링해야 하고(MUST), `currentAnimation`을 변경하거나 catalog·모델 요청을 시작해서는 안 된다(MUST NOT). 자유 입력 text는 현재 option을 명시적으로 선택하기 전까지 재생할 애니메이션으로 인정해서는 안 된다(MUST NOT).

#### Scenario: 원격 스켈레톤 animation dropdown
- **WHEN** 선택한 원격 모델의 스켈레톤 파싱 결과가 `pose_default`, `idle`, `walk` 애니메이션을 이 순서로 포함한다
- **THEN** 시스템은 세 이름을 같은 label과 value 및 같은 순서의 searchable dropdown option으로 표시하고 `pose_default`를 기본값으로 반복 재생한다

#### Scenario: 애니메이션 option 검색
- **WHEN** 현재 animation dropdown에 `pose_default`, `idle`, `walk`가 있고 사용자가 `WAL`을 검색한다
- **THEN** 시스템은 `walk`만 visible list에 표시하고 underlying option과 `currentAnimation`을 유지하며 어떤 catalog·모델 요청도 보내지 않는다

#### Scenario: 애니메이션 검색 초기화
- **WHEN** 사용자가 animation 검색 query를 모두 지운다
- **THEN** 시스템은 현재 ready 세션의 전체 애니메이션 option을 원래 순서로 복원하고 재생 상태를 변경하지 않는다

#### Scenario: 애니메이션 검색 결과 없음
- **WHEN** 검색 query와 일치하는 애니메이션 option이 없거나 사용자가 option에 없는 text를 입력한다
- **THEN** 시스템은 `검색 결과 없음`을 표시하고 입력 text를 선택값으로 commit하거나 `session.play()`를 호출하지 않는다

#### Scenario: 기본 pose가 존재함
- **WHEN** 현재 세션의 애니메이션 목록에 `pose_default`가 있다
- **THEN** 세션과 animation dropdown은 `pose_default`를 기본 애니메이션으로 선택해 반복 재생한다

#### Scenario: 기본 pose가 없음
- **WHEN** 현재 세션의 애니메이션 목록에 `pose_default`가 없고 다른 애니메이션이 있다
- **THEN** 세션과 animation dropdown은 파싱된 목록의 첫 애니메이션을 기본값으로 선택해 반복 재생한다

#### Scenario: 애니메이션 전환
- **WHEN** 사용자가 전체 또는 검색 결과의 animation dropdown에서 현재 세션 목록에 존재하는 다른 애니메이션을 선택한다
- **THEN** 세션은 추가 catalog·스켈레톤·atlas·PNG 요청 없이 선택한 애니메이션으로 전환하고 `currentAnimation`을 갱신한다

#### Scenario: 원격 모델 교체 성공
- **WHEN** 새 원격 모델이 이전 세션과 다른 애니메이션 목록으로 첫 frame까지 성공해 ready가 된다
- **THEN** 시스템은 미리보기, animation dropdown option과 기본 선택을 새 세션의 파싱 결과로 함께 교체하고 기존 animation 검색 query를 비운다

#### Scenario: 원격 모델 교체 실패
- **WHEN** 활성 미리보기가 있는 상태에서 새 원격 모델의 입력 준비, 스켈레톤 파싱 또는 첫 frame이 실패한다
- **THEN** 시스템은 기존 세션, animation dropdown option, 검색 query와 `currentAnimation`을 유지하고 새 오류를 표시한다

#### Scenario: 알 수 없거나 오래된 애니메이션 선택
- **WHEN** 호출자가 현재 세션의 애니메이션 목록에 없는 자유 입력 또는 이전 세션의 이름으로 전환을 요청한다
- **THEN** 세션은 현재 재생과 dropdown 선택을 유지하고 `ANIMATION_UNKNOWN`을 반환한다

#### Scenario: 애니메이션이 없음
- **WHEN** 파싱된 local 또는 remote 스켈레톤에 애니메이션이 하나도 없다
- **THEN** 시스템은 `ANIMATION_MISSING`을 반환하고 해당 새 미리보기를 시작하지 않는다

### Requirement: 미리보기 수명 주기 정리
`LiveSDPreviewSession.dispose()`는 animation frame, image decode 자원, texture 및 세션이 소유한 rendering 자원을 한 번만 안전하게 해제해야 한다(MUST). 새 local 또는 remote 모델이 첫 frame까지 성공한 경우에만 시스템은 기존 세션을 해제하고 새 ready 세션으로 교체해야 한다(MUST). 새 입력 준비나 preview 생성이 실패하면 기존 세션과 animation dropdown의 option·query·filtered result·선택을 유지해야 한다(MUST). UI unmount는 활성 세션과 오류 구독을 해제해야 하며(MUST), 세션은 ready 이후 비동기 렌더 오류를 한 번 전달하고 구독을 해제할 수 있는 runtime 독립 오류 알림 경계를 제공해야 한다(MUST).

#### Scenario: local 캐릭터 재가져오기
- **WHEN** 활성 미리보기가 있는 상태에서 새 local 캐릭터 ZIP과 공통 스켈레톤으로 첫 frame까지 성공한다
- **THEN** 시스템은 기존 세션을 dispose한 뒤 새 ready 세션과 animation dropdown으로 교체하고 animation 검색 query를 비운다

#### Scenario: remote 캐릭터 재가져오기
- **WHEN** 활성 미리보기가 있는 상태에서 새 remote 모델 입력이 스켈레톤 파싱과 첫 frame까지 성공한다
- **THEN** 시스템은 기존 세션을 dispose한 뒤 새 ready 세션과 animation dropdown으로 교체하고 animation 검색 query를 비운다

#### Scenario: 새 입력 준비 실패
- **WHEN** 활성 미리보기가 있는 상태에서 새 local 또는 remote 입력 준비, preview 생성이나 첫 frame이 실패한다
- **THEN** 시스템은 기존 세션과 animation dropdown의 option·query·filtered result·선택을 교체하거나 dispose하지 않고 오류를 표시한다

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
시스템 저장소는 vendoring된 runtime의 원본 fork와 commit, 파일별 SHA-256, 원문 LICENSE와 copyright notice를 함께 보존해야 한다(MUST). Build-time provenance 검사는 기록된 SHA-256을 검증해야 하며(MUST), browser loader는 production에 포함된 same-origin `spine-webgl.js`를 로드해야 한다(MUST). Production 산출물의 vendored 항목은 runtime, 원문 LICENSE와 사용자 접근 가능한 third-party notice로 제한되고 모델 asset은 runtime source에서 제공되어야 한다(MUST).

#### Scenario: vendoring 파일 검증
- **WHEN** vendoring 또는 dependency provenance 검증 작업을 수행한다
- **THEN** `spine-webgl.js`, type declaration과 원문 LICENSE의 SHA-256이 설계 문서와 `THIRD_PARTY_NOTICES.md`의 값과 일치한다

#### Scenario: production runtime 고지
- **WHEN** production build를 생성한다
- **THEN** 산출물에는 same-origin runtime JavaScript, 원문 LICENSE와 fork·commit·copyright 정보를 담은 사용자 접근 가능한 third-party notice가 포함된다

#### Scenario: production 모델 asset 경계
- **WHEN** production build 내용을 검사한다
- **THEN** PRSK symlink 대상과 다른 사용자 모델 자산이 포함되지 않는다

### Requirement: 안정적인 LiveSD 진단 계약
runtime loader와 `LiveSD36Adapter`가 반환하는 알려진 실패는 아래의 안정적인 영문 code를 사용해야 하며(MUST), browser UI는 code와 문제 해결에 필요한 현재 locale의 message를 함께 표시해야 한다(MUST). 관련 path 또는 실제 input version이 있으면 구조화된 정보나 localized message에 포함해야 한다(MUST). 알려지지 않은 예외는 `PREVIEW_UNKNOWN_ERROR`와 현재 locale의 일반 message로 정규화해야 한다(MUST). Compatibility metadata는 programmatic adapter contract이며 UI 진단은 stable code와 localized message로 구성해야 한다(MUST).

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
- **THEN** UI는 안정적인 영문 code와 현재 locale의 실행 가능한 message를 함께 표시해야 한다

#### Scenario: 알 수 없는 예외 정규화
- **WHEN** importer, input, runtime 또는 preview 경계 밖의 예외가 UI까지 전파된다
- **THEN** UI는 raw exception이나 stack 대신 `PREVIEW_UNKNOWN_ERROR`와 현재 locale의 일반 오류 message를 표시해야 한다

#### Scenario: locale 전환 뒤 오류 표시
- **WHEN** preview 오류가 표시된 상태에서 locale을 변경한다
- **THEN** 동일한 stable code는 유지되고 message만 새 locale로 즉시 변경되어야 한다

#### Scenario: compatibility metadata 소비
- **WHEN** 세션 또는 header가 `experimental`이나 `best_effort` compatibility를 가진다
- **THEN** 호출자는 metadata를 programmatic하게 읽고 UI는 stable code와 localized message로 진단을 표시한다

#### Scenario: parse 실패 정보
- **WHEN** `SKELETON_PARSE_FAILED`를 사용자에게 표시한다
- **THEN** message는 실제 input version과 사용한 LiveSD runtime `3.6`을 포함하고 `verified`, `experimental`, `best_effort` label은 포함하지 않는다

### Requirement: 활성 source의 export handoff
앱은 첫 WebGL frame까지 성공해 ready가 된 preview의 runtime 독립 `LiveSDAtlasBundle`과 원본 스켈레톤 `ArrayBuffer`를 active export source로 함께 보존해야 한다(MUST). 새 source의 preview 활성화가 성공할 때 session과 export source를 원자적으로 교체해야 하며(MUST), loading 또는 실패한 source를 exporter에 전달해서는 안 된다(MUST NOT).

#### Scenario: 첫 ready source
- **WHEN** local 또는 remote source가 첫 frame까지 렌더링해 ready가 된다
- **THEN** 상태 매핑과 exporter는 같은 source의 atlas bundle, skeleton bytes와 animation 목록을 받는다

#### Scenario: source 교체 성공
- **WHEN** 기존 ready source가 있는 상태에서 새 source preview가 ready가 된다
- **THEN** 앱은 기존 session과 export source를 함께 새 source로 교체하고 새 animation 추천을 계산한다

#### Scenario: source 교체 실패
- **WHEN** 새 source의 importer, runtime parse 또는 첫 frame render가 실패한다
- **THEN** 실패한 source는 exporter에 노출되지 않고 기존 ready session과 export source는 유지된다

#### Scenario: ready 이후 render 실패
- **WHEN** 활성 preview session이 후속 frame에서 실패해 dispose된다
- **THEN** 앱은 해당 session과 연결된 export source를 제거하고 package 생성을 비활성화한다

#### Scenario: UI unmount
- **WHEN** 앱이 unmount된다
- **THEN** 활성 session, export source와 진행 중 export를 정리한다

### Requirement: PRSK premultiplied-alpha preview 합성

시스템은 PRSK atlas PNG의 color channel이 이미 alpha와 곱해진 PMA source임을 보존해야 하며(MUST), alpha가 활성화되고 `premultipliedAlpha`가 활성화된 WebGL drawing buffer와 PMA Spine renderer로 attachment를 합성해야 한다(MUST). Texture upload는 source color channel을 그대로 사용하고(MUST), normal attachment는 `ONE, ONE_MINUS_SRC_ALPHA` 의미의 blend로 합성되어야 한다(MUST). 같은 pose의 attachment edge는 desktop과 높은 device pixel ratio의 mobile viewport에서 주변 pixel과 연속적으로 보여야 한다(MUST).

#### Scenario: PMA texture upload와 preview draw
- **WHEN** `max(R,G,B) <= A`인 반투명 edge pixel을 가진 PRSK atlas로 preview를 만든다
- **THEN** texture upload는 pixel channel을 추가 premultiply하지 않는다
- **AND** WebGL context와 Spine renderer는 PMA 합성 mode를 사용한다

#### Scenario: Mobile attachment 연결 경계
- **WHEN** 반투명 edge가 있는 서로 겹치는 PRSK attachment를 높은 device pixel ratio의 mobile viewport에서 렌더링한다
- **THEN** attachment 연결 경계는 주변 texture 색상과 연속적으로 합성된다
- **AND** polygon 경계에 추가 dark border 또는 stroke가 나타나지 않는다

#### Scenario: PMA 2D draw order
- **WHEN** PMA mode로 서로 겹치는 PRSK attachment를 렌더링한다
- **THEN** 시스템은 현재 `skeleton.drawOrder`를 유지한다
- **AND** depth, z-offset 또는 attachment geometry 변경으로 seam을 가리지 않는다

### Requirement: Runtime 수평 반전 preview

`LiveSDPreviewSession`은 현재 animation pose, alpha-calibrated bounds, framing scale과 canvas 크기를 유지하면서 전체 렌더를 bounds 중심 기준으로 수평 반전할 수 있어야 한다(MUST). 반전은 projection에서 수행하고(MUST), skeleton bone·attachment geometry·draw order를 변경해서는 안 된다(MUST NOT). 반전 변경은 새 session, animation restart, alpha recalibration 또는 network request 없이 현재 pose에 즉시 다시 그려져야 한다(MUST).

#### Scenario: 반전 활성화와 해제
- **WHEN** ready session에서 수평 반전을 활성화한 뒤 해제한다
- **THEN** projection은 각각 같은 중심의 negative width와 원래 positive width를 사용한다
- **AND** animation, framing scale과 session identity는 유지된다

#### Scenario: 비대칭 캐릭터 실제 pixel
- **WHEN** 한쪽 장식이 있는 PRSK 캐릭터를 같은 pose에서 반전한다
- **THEN** 장식의 pixel centroid는 canvas 중심 반대편으로 이동한다
- **AND** 캐릭터의 alpha bounds 크기와 수직 위치는 유지된다

#### Scenario: 반전 중 animation calibration
- **WHEN** 반전된 session에서 다른 animation을 선택한다
- **THEN** 시스템은 canonical 무반전 coarse projection에서 실제 alpha bounds를 계산한다
- **AND** 최종 pose만 현재 반전 projection으로 렌더링한다

### Requirement: 반전된 pointer look 의미

수평 반전된 preview에서도 pointer의 화면상 좌우와 눈 이동 방향이 일치해야 한다(MUST). 시스템은 normalized pointer target을 screen space로 보존하고(MUST), eye bone world delta를 계산할 때 반전 상태에서 X축만 역변환해야 한다(MUST). Mirror toggle, animation frame 또는 pointer 이동 사이에 이전 look offset을 누적해서는 안 된다(MUST NOT).

#### Scenario: 반전 상태의 오른쪽 pointer
- **WHEN** 수평 반전된 preview의 오른쪽 가장자리로 pointer를 이동한다
- **THEN** 화면상 눈은 오른쪽으로 이동한다
- **AND** bone에 적용되는 world X delta는 무반전 preview의 오른쪽 pointer와 반대 부호다

#### Scenario: pointer 유지 중 mirror toggle
- **WHEN** 오른쪽 pointer target이 활성 상태에서 mirror를 연속으로 켜고 끈다
- **THEN** 각 draw는 현재 animation pose에서 이전 offset을 제거하고 새 방향 offset을 한 번만 적용한다
