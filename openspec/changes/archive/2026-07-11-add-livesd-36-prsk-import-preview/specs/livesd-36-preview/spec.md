## ADDED Requirements

### Requirement: 공통 스켈레톤 입력
시스템은 production에서 사용자가 선택한 단일 `.skel` 파일을 공통 스켈레톤으로 사용해야 한다(MUST). 개발 환경에서 사용자가 파일을 선택하지 않은 경우 `public/assets` symlink가 같은 출처로 제공하는 `/assets/prsk/base_model/sekai_skeleton.skel`을 편의 fallback으로 사용해야 하며(MUST), 외부 CDN이나 원격 fallback을 사용해서는 안 된다(MUST NOT). production build는 symlink 대상 PRSK 자산을 포함해서는 안 된다(MUST NOT).

#### Scenario: production 공통 스켈레톤 선택
- **WHEN** production 사용자가 공통 `.skel` 파일을 선택한다
- **THEN** 시스템은 파일을 `ArrayBuffer`로 읽어 버전 검사 단계에 전달한다

#### Scenario: 공통 스켈레톤 로드 성공
- **WHEN** 개발 환경에서 사용자 선택 파일이 없고 고정 개발 경로에 공통 스켈레톤이 존재한다
- **THEN** 시스템은 파일을 `ArrayBuffer`로 읽어 버전 검사 단계에 전달한다

#### Scenario: 공통 스켈레톤 누락
- **WHEN** production에서 사용자가 `.skel`을 선택하지 않았거나 개발 fallback이 404 또는 읽기 오류를 반환한다
- **THEN** 시스템은 공통 `.skel` 선택 또는 필요한 로컬 PRSK 자산 경로를 안내하고 런타임을 시작하지 않는다

### Requirement: LiveSD 3.6 버전 사전 검사
`LiveSD36Adapter`는 바이너리 헤더에서 hash와 version을 읽고 version이 `3.6` 계열일 때만 런타임 파싱을 허용해야 한다(MUST).

#### Scenario: 검증된 PRSK 버전
- **WHEN** 스켈레톤의 실제 header version이 `3.6.53`이거나 합성 fixture의 호환 표기가 `3.6.53D4`이다
- **THEN** 시스템은 호환 경고 없이 런타임 파싱을 계속한다

#### Scenario: 다른 LiveSD 3.6 버전
- **WHEN** 스켈레톤 version이 `3.6` 계열이지만 검증된 `3.6.53D4` 호환 프로필이 아니다
- **THEN** 시스템은 실험적 호환 경고를 노출하고 런타임 파싱을 시도한다

#### Scenario: 지원하지 않는 버전
- **WHEN** 스켈레톤 version이 `3.6` 계열이 아니거나 헤더가 손상되었다
- **THEN** 시스템은 `SkeletonBinary` 호출 전에 지원하지 않는 버전 또는 손상 헤더 오류를 반환한다

### Requirement: 고정 수정 런타임 재사용
시스템은 esterTion `spine-runtimes` 커밋 `8d79291441394b3a279d5d36f054d563dbc15e16`의 검증된 `spine-webgl.js`를 classic script로 한 번만 로드하고, 전역 `spine` 접근을 `LiveSD36Adapter` 내부로 제한해야 한다(MUST).

#### Scenario: 첫 런타임 로드
- **WHEN** 첫 미리보기 세션이 수정 런타임을 요청한다
- **THEN** loader는 고정 로컬 산출물을 classic script로 로드하고 전역 API를 어댑터에 제공한다

#### Scenario: 중복 런타임 요청
- **WHEN** 여러 미리보기 요청이 같은 런타임을 동시에 요청한다
- **THEN** loader는 동일한 단일 로드 작업과 런타임 인스턴스를 재사용한다

#### Scenario: 런타임 로드 실패
- **WHEN** 고정 산출물이 없거나 전역 `spine`을 생성하지 못한다
- **THEN** 시스템은 런타임 설치 또는 무결성 오류를 반환하고 미리보기를 생성하지 않는다

### Requirement: PRSK 바이너리 패딩
`LiveSD36Adapter`는 원본 스켈레톤을 변경하지 않고 한 바이트 큰 새 버퍼에 복사해 마지막 0바이트가 포함된 버퍼를 `SkeletonBinary.readSkeletonData()`에 전달해야 한다(MUST).

#### Scenario: 스켈레톤 파싱
- **WHEN** 지원되는 스켈레톤을 파싱한다
- **THEN** mock 런타임은 입력보다 정확히 한 바이트 크고 마지막 값이 0인 별도 버퍼를 전달받는다

### Requirement: WebGL 미리보기 구성
시스템은 캐릭터 atlas 페이지로 texture를 생성하고 `TextureAtlas`, `AtlasAttachmentLoader`, `SkeletonBinary`, `Skeleton`, `AnimationStateData`, `AnimationState`를 구성해 alpha가 활성화된 WebGL 캔버스에 렌더링해야 한다(MUST).

#### Scenario: 미리보기 생성 성공
- **WHEN** 공통 스켈레톤과 유효한 `PrskCharacterPack` 및 WebGL 캔버스가 주어진다
- **THEN** 시스템은 투명 배경에서 모델을 중앙 정렬하고 bounds에 맞춰 반복 렌더링한다

#### Scenario: WebGL 미지원
- **WHEN** 브라우저가 필요한 WebGL context를 생성하지 못한다
- **THEN** 시스템은 WebGL 미지원 오류를 표시하고 부분 생성된 자원을 정리한다

#### Scenario: 런타임 파싱 실패
- **WHEN** 3.6 계열로 식별된 스켈레톤을 수정 런타임이 파싱하지 못한다
- **THEN** 시스템은 해당 버전이 검증되지 않았음을 포함한 호환성 오류를 표시하고 자원을 정리한다

### Requirement: 애니메이션 탐색과 재생
`LiveSDPreviewSession`은 스켈레톤의 모든 애니메이션 이름을 제공하고 유효한 애니메이션을 반복 재생하며 런타임 세부 객체를 외부에 노출하지 않아야 한다(MUST).

#### Scenario: 기본 pose가 존재함
- **WHEN** 애니메이션 목록에 `pose_default`가 있다
- **THEN** 세션은 `pose_default`를 기본 애니메이션으로 선택해 반복 재생한다

#### Scenario: 기본 pose가 없음
- **WHEN** 애니메이션 목록에 `pose_default`가 없고 다른 애니메이션이 있다
- **THEN** 세션은 목록의 첫 애니메이션을 기본값으로 반복 재생한다

#### Scenario: 애니메이션 전환
- **WHEN** 사용자가 목록에 존재하는 다른 애니메이션을 선택한다
- **THEN** 세션은 선택한 애니메이션으로 전환하고 `currentAnimation`을 갱신한다

#### Scenario: 애니메이션이 없음
- **WHEN** 파싱된 스켈레톤에 애니메이션이 하나도 없다
- **THEN** 시스템은 미리보기를 시작하지 않고 명확한 애니메이션 없음 오류를 반환한다

### Requirement: 미리보기 수명 주기 정리
`LiveSDPreviewSession.dispose()`는 animation frame, object URL, texture 및 세션이 소유한 렌더링 자원을 한 번만 안전하게 해제해야 한다(MUST). 새 캐릭터 가져오기는 기존 세션을 먼저 해제해야 한다(MUST).

#### Scenario: 캐릭터 재가져오기
- **WHEN** 활성 미리보기가 있는 상태에서 새 캐릭터 ZIP을 성공적으로 가져온다
- **THEN** 시스템은 기존 세션을 dispose한 뒤 새 세션을 생성한다

#### Scenario: 중복 dispose
- **WHEN** 동일한 세션의 `dispose()`를 두 번 이상 호출한다
- **THEN** 시스템은 오류나 중복 해제 없이 첫 호출에서만 자원을 정리한다

### Requirement: 저장소와 라이선스 배포 게이트
시스템 구현은 런타임 vendoring 전에 저장소가 비공개인지 확인해야 하며(MUST), production 배포 전에 프로젝트 소유자가 개발·통합 시점의 유효한 Spine 라이선스를 확인했다는 결정을 기록해야 한다(MUST). 배포물은 런타임 원문 라이선스, 저작권과 fork 출처를 포함해야 한다(MUST).

#### Scenario: 공개 저장소에서 적용 시도
- **WHEN** 저장소가 공개 상태인 채로 런타임 vendoring 작업을 시작한다
- **THEN** 구현 작업은 런타임 파일을 추가하지 않고 비공개 전환을 선행 조건으로 보고한다

#### Scenario: 라이선스 확인 전 production 배포 시도
- **WHEN** 개발·통합 시점의 유효한 Spine 라이선스 확인 결정 없이 production 배포를 시도한다
- **THEN** release 절차는 중단되고 프로젝트 소유자의 확인을 요구한다

#### Scenario: 라이선스 확인 후 production 배포
- **WHEN** 라이선스 확인 결정이 기록되고 필수 runtime 고지가 포함되어 있다
- **THEN** 시스템은 사용자가 자신의 모델 리소스를 가져오는 production 미리보기를 배포할 수 있다

#### Scenario: runtime 고지가 누락됨
- **WHEN** 원문 라이선스, 저작권 또는 fork 출처 중 하나가 배포물과 사용자 고지에서 누락된다
- **THEN** release 검증은 실패한다

### Requirement: 런타임 출처와 무결성 기록
시스템 저장소는 vendoring된 런타임의 원본 커밋, 파일별 SHA-256, 원문 라이선스 및 출처를 함께 보존해야 한다(MUST).

#### Scenario: 런타임 파일 검증
- **WHEN** vendoring 또는 의존성 검증 작업을 수행한다
- **THEN** 세 런타임 파일의 SHA-256이 설계 문서와 `THIRD_PARTY_NOTICES.md`의 값과 일치해야 한다
