## ADDED Requirements

### Requirement: Codex Pet v1 atlas
exporter는 8열×9행, `192x208` cell로 구성된 정확히 `1536x1872` 크기의 투명 PNG atlas를 생성해야 하며(MUST), `spriteVersionNumber: 1` 외의 package를 이 변경에서 생성해서는 안 된다(MUST NOT). 이미지 크기는 20MiB를 초과해서는 안 된다(MUST NOT).

#### Scenario: 정상 atlas
- **WHEN** 57개 사용 frame sampling이 성공한다
- **THEN** exporter는 PNG signature와 `1536x1872` geometry를 가진 atlas를 생성한다

#### Scenario: 크기 제한 초과
- **WHEN** encoded PNG가 20MiB를 초과한다
- **THEN** exporter는 ZIP download를 만들지 않고 package size 오류를 표시한다

### Requirement: local custom pet manifest
exporter는 `id`, `displayName`, `description`, `spriteVersionNumber: 1`, 내부 상대 `spritesheetPath`를 가진 UTF-8 `pet.json`을 생성해야 한다(MUST). id는 소문자 영숫자와 단일 hyphen 구분의 안전한 slug여야 하며(MUST), path separator, 절대 경로, `.` 또는 `..` segment를 포함해서는 안 된다(MUST NOT).

#### Scenario: metadata 정규화
- **WHEN** 사용자가 display name과 description을 입력한다
- **THEN** exporter는 trim한 표시값과 display name에서 파생한 안전한 id를 manifest에 기록한다

#### Scenario: 빈 이름
- **WHEN** trim한 display name이 비어 있다
- **THEN** exporter는 package 생성을 차단하고 이름 입력을 안내한다

#### Scenario: 내부 spritesheet path
- **WHEN** manifest를 만든다
- **THEN** `spritesheetPath`는 같은 pet 디렉터리 안의 `spritesheet.png`만 가리킨다

### Requirement: 설치 디렉터리 보존 ZIP
exporter는 `<pet-id>/pet.json`과 `<pet-id>/spritesheet.png`를 포함한 ZIP Blob을 생성하고(MUST), download 이름을 `<pet-id>.codex-pet.zip`으로 제안해야 한다(MUST). 원본 `.skel`, atlas text, PRSK texture, provider URL 또는 사용자 로컬 경로를 ZIP에 포함해서는 안 된다(MUST NOT).

#### Scenario: ZIP entry 구조
- **WHEN** package export가 성공한다
- **THEN** ZIP에는 하나의 top-level pet 디렉터리와 그 아래 두 필수 파일만 존재한다

#### Scenario: source privacy
- **WHEN** local 또는 remote source에서 package를 생성한다
- **THEN** ZIP과 manifest에는 source archive path, 원본 asset URL과 LiveSD runtime 파일이 포함되지 않는다

#### Scenario: 브라우저 download
- **WHEN** 검증된 package의 download 버튼을 누른다
- **THEN** 브라우저는 `application/zip` Blob을 제안된 `.codex-pet.zip` 이름으로 다운로드한다

### Requirement: 독립 package 검증
시스템은 생성한 ZIP bytes를 다시 열어 top-level 구조, 안전한 entry path, manifest schema, manifest와 디렉터리 id 일치, PNG signature와 geometry, 사용 cell alpha 및 미사용 cell 투명도를 검증해야 한다(MUST). 검증이 성공하기 전에는 download 완료 상태나 installed preview를 표시해서는 안 된다(MUST NOT).

#### Scenario: 정상 package 재검증
- **WHEN** exporter가 만든 ZIP을 validator가 읽는다
- **THEN** validator는 manifest와 atlas를 원본 exporter 객체와 독립적으로 복원하고 모든 구조·geometry·alpha 검사를 통과한다

#### Scenario: unsafe ZIP entry
- **WHEN** entry가 top-level pet 디렉터리 밖을 가리키거나 정규화 후 충돌한다
- **THEN** validator와 test installer는 전체 package를 거부하고 파일을 쓰지 않는다

#### Scenario: 비어 있는 사용 cell
- **WHEN** 상태 계약상 사용되는 cell의 모든 alpha가 0이다
- **THEN** validator는 해당 state와 frame index를 포함한 오류로 package를 거부한다

#### Scenario: 불투명 미사용 cell
- **WHEN** 미사용 cell에 alpha가 0이 아닌 pixel이 있다
- **THEN** validator는 해당 row와 column을 포함한 오류로 package를 거부한다

### Requirement: Codex 좌표 기반 package preview
웹은 validator가 ZIP에서 다시 읽은 atlas를 Codex와 같은 8열×9행 background 좌표로 렌더링하고(MUST), 9개 상태 선택과 상태별 frame 순환을 제공해야 한다(MUST). 현재 state와 frame index는 자동 테스트가 관찰할 수 있어야 한다(MUST).

#### Scenario: 상태 전환
- **WHEN** 사용자가 installed preview에서 다른 상태를 선택한다
- **THEN** renderer는 해당 row의 첫 frame으로 전환하고 상태 계약의 duration으로 frame을 순환한다

#### Scenario: frame 변화
- **WHEN** 둘 이상의 서로 다른 frame을 가진 Airi 상태를 재생한다
- **THEN** Playwright screenshot 또는 pixel sample은 시간 경과 뒤 렌더링된 cell의 변화를 관찰한다

### Requirement: download ZIP 설치 검증
Playwright test installer는 download한 실제 ZIP bytes를 안전하게 풀어 명시된 Codex pets root의 `<pet-id>/`에 설치하고(MUST), 설치된 `pet.json`과 PNG를 다시 읽어야 한다(MUST). 기본 root는 test-results 안이며 실제 root는 명시적인 `CODEX_PET_INSTALL_ROOT`에서만 사용해야 한다(MUST).

#### Scenario: 격리 설치
- **WHEN** `CODEX_PET_INSTALL_ROOT`가 설정되지 않은 Playwright가 package를 설치한다
- **THEN** installer는 repository의 격리된 test Codex home에만 두 파일을 쓰고 사용자 home을 변경하지 않는다

#### Scenario: 명시적 실제 설치
- **WHEN** 사용자가 승인한 검증 실행이 실제 `${CODEX_HOME}/pets`를 `CODEX_PET_INSTALL_ROOT`로 제공한다
- **THEN** 같은 download/install 테스트는 해당 root의 `<pet-id>/`에 검증된 두 파일을 설치한다

#### Scenario: sd_07airi_normal end-to-end
- **WHEN** 로컬 공통 스켈레톤과 `assets/prsk/sd_07airi_normal` ZIP을 선택해 package를 다운로드하고 설치한다
- **THEN** 설치된 manifest는 v1과 Airi metadata를 가지며 웹 installed preview에서 Airi sprite가 각 상태 row로 렌더링된다
