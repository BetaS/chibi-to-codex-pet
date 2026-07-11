## ADDED Requirements

### Requirement: Codex Pet v2 atlas
exporter는 8열×11행, `192x208` cell로 구성된 정확히 `1536x2288` 크기의 투명 PNG atlas를 생성해야 하며(MUST), `spriteVersionNumber: 2` 외의 package를 새로 생성해서는 안 된다(MUST NOT). 이미지 크기는 20MiB를 초과해서는 안 된다(MUST NOT).

#### Scenario: 정상 v2 atlas
- **WHEN** 57개 표준 frame과 16개 look frame sampling이 성공한다
- **THEN** exporter는 PNG signature와 `1536x2288` geometry를 가진 atlas를 생성한다

#### Scenario: 크기 제한 초과
- **WHEN** encoded PNG가 20MiB를 초과한다
- **THEN** exporter는 ZIP download를 만들지 않고 package size 오류를 표시한다

## MODIFIED Requirements

### Requirement: local custom pet manifest
exporter는 `id`, `displayName`, `description`, `spriteVersionNumber: 2`, 내부 상대 `spritesheetPath`를 가진 UTF-8 `pet.json`을 생성해야 한다(MUST). id는 소문자 영숫자와 단일 hyphen 구분의 안전한 slug여야 하며(MUST), path separator, 절대 경로, `.` 또는 `..` segment를 포함해서는 안 된다(MUST NOT).

#### Scenario: metadata 정규화
- **WHEN** 사용자가 display name과 description을 입력한다
- **THEN** exporter는 trim한 표시값과 display name에서 파생한 안전한 id, `spriteVersionNumber: 2`를 manifest에 기록한다

#### Scenario: 빈 이름
- **WHEN** trim한 display name이 비어 있다
- **THEN** exporter는 package 생성을 차단하고 이름 입력을 안내한다

#### Scenario: 내부 spritesheet path
- **WHEN** manifest를 만든다
- **THEN** `spritesheetPath`는 같은 pet 디렉터리 안의 `spritesheet.png`만 가리킨다

### Requirement: 독립 package 검증
시스템은 생성한 ZIP bytes를 다시 열어 top-level 구조, 안전한 entry path, v2 manifest schema, manifest와 디렉터리 id 일치, PNG signature와 `1536x2288` geometry, 표준 상태 cell alpha, 미사용 cell 투명도 및 16개 look cell alpha를 검증해야 한다(MUST). 검증이 성공하기 전에는 download 완료 상태나 installed preview를 표시해서는 안 된다(MUST NOT).

#### Scenario: 정상 v2 package 재검증
- **WHEN** exporter가 만든 ZIP을 validator가 읽는다
- **THEN** validator는 v2 manifest와 11개 atlas row를 원본 exporter 객체와 독립적으로 복원하고 모든 구조·geometry·alpha 검사를 통과한다

#### Scenario: unsafe ZIP entry
- **WHEN** entry가 top-level pet 디렉터리 밖을 가리키거나 정규화 후 충돌한다
- **THEN** validator와 test installer는 전체 package를 거부하고 파일을 쓰지 않는다

#### Scenario: 비어 있는 표준 사용 cell
- **WHEN** rows 0–8의 상태 계약상 사용되는 cell의 모든 alpha가 0이다
- **THEN** validator는 해당 state와 frame index를 포함한 오류로 package를 거부한다

#### Scenario: 비어 있는 look cell
- **WHEN** rows 9–10의 16개 cell 중 하나의 모든 alpha가 0이다
- **THEN** validator는 해당 row와 direction column을 포함한 `PNG_CELL_EMPTY` 오류로 package를 거부한다

#### Scenario: 불투명 미사용 cell
- **WHEN** rows 0–8의 미사용 cell에 alpha가 0이 아닌 pixel이 있다
- **THEN** validator는 해당 row와 column을 포함한 오류로 package를 거부한다

### Requirement: Codex 좌표 기반 package preview
웹은 validator가 ZIP에서 다시 읽은 atlas를 Codex와 같은 8열×11행 background 좌표로 렌더링하고(MUST), 9개 표준 상태 선택과 상태별 frame 순환, 16방향 pointer look 선택을 제공해야 한다(MUST). 현재 state, frame index와 look direction index는 자동 테스트가 관찰할 수 있어야 한다(MUST).

#### Scenario: 표준 상태 전환
- **WHEN** 사용자가 installed preview에서 다른 표준 상태를 선택한다
- **THEN** renderer는 해당 row의 첫 frame으로 전환하고 상태 계약의 duration으로 frame을 순환한다

#### Scenario: pointer look 우선순위
- **WHEN** pointer가 dead zone 밖의 preview stage에 있다
- **THEN** renderer는 현재 표준 상태 frame보다 계산된 rows 9–10의 look frame을 우선 표시한다

#### Scenario: pointer look 종료
- **WHEN** pointer가 dead zone으로 이동하거나 preview stage를 나간다
- **THEN** renderer는 look frame을 제거하고 현재 선택·hover 표준 상태로 복귀한다

#### Scenario: frame 변화
- **WHEN** 둘 이상의 서로 다른 frame을 가진 Airi 상태를 재생한다
- **THEN** Playwright screenshot 또는 pixel sample은 시간 경과 뒤 렌더링된 표준 상태 cell의 변화를 관찰한다

### Requirement: download ZIP 설치 검증
Playwright test installer는 download한 실제 v2 ZIP bytes를 안전하게 풀어 명시된 Codex pets root의 `<pet-id>/`에 설치하고(MUST), 설치된 `pet.json`과 `1536x2288` PNG를 다시 읽어야 한다(MUST). 기본 root는 test-results 안이며 실제 root는 명시적인 `CODEX_PET_INSTALL_ROOT`에서만 사용해야 한다(MUST).

#### Scenario: 격리 설치
- **WHEN** `CODEX_PET_INSTALL_ROOT`가 설정되지 않은 Playwright가 v2 package를 설치한다
- **THEN** installer는 repository의 격리된 test Codex home에만 두 파일을 쓰고 사용자 home을 변경하지 않는다

#### Scenario: 명시적 실제 설치
- **WHEN** 사용자가 승인한 검증 실행이 실제 `${CODEX_HOME}/pets`를 `CODEX_PET_INSTALL_ROOT`로 제공한다
- **THEN** 같은 download/install 테스트는 해당 root의 `<pet-id>/`에 검증된 v2 manifest와 PNG를 설치한다

#### Scenario: sd_07airi_normal v2 end-to-end
- **WHEN** 로컬 공통 스켈레톤과 `assets/prsk/sd_07airi_normal` ZIP을 선택해 package를 다운로드하고 설치한다
- **THEN** 설치된 manifest는 v2와 Airi metadata를 가지며 표준 9개 row와 16개 look cell이 웹 installed preview에서 렌더링된다

#### Scenario: sd_21miku_normal v2 end-to-end
- **WHEN** 로컬 공통 스켈레톤과 `assets/prsk/sd_21miku_normal` ZIP을 선택하고 idle을 `z_test_F_negi01`로 override해 package를 다운로드하고 설치한다
- **THEN** 설치된 manifest는 v2와 Miku metadata를 가지며 idle의 negi, 마우스 오버의 `w_happy_surprise01_f`, 16개 look cell을 렌더링한다

## REMOVED Requirements

### Requirement: Codex Pet v1 atlas

**Reason**: 16방향 pointer look을 지원하는 v2 11행 atlas가 새 exporter의 표준이되었다.

**Migration**: 기존 rows 0–8은 그대로 유지하고 rows 9–10의 16방향 look frame과 `spriteVersionNumber: 2`를 추가한다.
