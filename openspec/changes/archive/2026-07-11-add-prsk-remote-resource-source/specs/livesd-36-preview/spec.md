## MODIFIED Requirements

### Requirement: 공통 스켈레톤 입력
시스템은 active source mode와 일치하는 하나의 공통 LiveSD 3.6 스켈레톤 입력을 사용해야 한다(MUST). production local mode에서는 사용자가 선택한 단일 `.skel` 파일을 사용하고, remote mode에서는 사용자가 명시적으로 실행한 `PrskRemoteResourceSource`의 스켈레톤 결과를 사용해야 한다(MUST). local 선택 파일의 확장자는 대소문자와 관계없이 `.skel`이어야 하며(MUST), 선택 누락과 잘못된 확장자를 각각 `SHARED_SKELETON_REQUIRED`, `SHARED_SKELETON_INVALID_TYPE`으로 구분해야 한다(MUST). development local mode에서 사용자가 파일을 선택하지 않은 경우 `public/assets` symlink가 같은 출처로 제공하는 `/assets/prsk/base_model/sekai_skeleton.skel`을 편의 fallback으로 사용해야 한다(MUST). 시스템은 페이지 진입이나 local 입력 실패를 암묵적인 원격 fallback 트리거로 사용해서는 안 되며(MUST NOT), production build는 symlink 대상 PRSK 자산을 포함해서는 안 된다(MUST NOT).

#### Scenario: production local 공통 스켈레톤 선택
- **WHEN** production local mode 사용자가 대소문자와 관계없이 `.skel` 확장자인 공통 스켈레톤 파일을 선택한다
- **THEN** 시스템은 파일을 `ArrayBuffer`로 읽어 헤더 검사 단계에 전달한다

#### Scenario: 잘못된 local 공통 스켈레톤 확장자
- **WHEN** local mode 사용자가 `.skel` 이외의 확장자를 가진 공통 스켈레톤 파일을 선택한다
- **THEN** 시스템은 `SHARED_SKELETON_INVALID_TYPE`과 해결 방법을 설명하는 한국어 메시지를 표시하고 runtime을 시작하지 않는다

#### Scenario: production remote 공통 스켈레톤 선택
- **WHEN** production remote mode 사용자가 유효한 catalog dropdown에서 캐릭터를 명시적으로 선택한다
- **THEN** 시스템은 검증·제한된 원격 스켈레톤 `ArrayBuffer`를 버전 검사 단계에 전달한다

#### Scenario: development local 공통 스켈레톤 로드 성공
- **WHEN** development local mode에서 사용자 선택 파일이 없고 고정 개발 경로에 공통 스켈레톤이 존재한다
- **THEN** 시스템은 파일을 `ArrayBuffer`로 읽어 헤더 검사 단계에 전달한다

#### Scenario: production local 공통 스켈레톤 누락
- **WHEN** production local mode에서 사용자가 공통 스켈레톤 파일을 선택하지 않는다
- **THEN** 시스템은 `SHARED_SKELETON_REQUIRED`와 `.skel` 선택을 안내하는 한국어 메시지를 표시하고 runtime을 시작하지 않는다

#### Scenario: development local 공통 스켈레톤 누락
- **WHEN** development local mode에서 사용자 선택 파일이 없고 고정 개발 fallback이 404 또는 읽기 오류를 반환한다
- **THEN** 시스템은 필요한 로컬 자산 경로를 안내하고 runtime을 시작하지 않는다

#### Scenario: 암묵적 원격 fallback 금지
- **WHEN** local mode의 공통 스켈레톤 입력이 없거나 로드에 실패하고 remote URL placeholder 또는 preset이 존재한다
- **THEN** 시스템은 원격 스켈레톤을 요청하지 않고 local 입력 오류를 유지한다

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
