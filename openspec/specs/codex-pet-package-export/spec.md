# Codex Pet 패키지 export 명세

## Purpose

샘플링된 73개 LiveSD frame을 Codex custom pet v2의 PNG atlas와 manifest로 만든다. 생성 결과는 독립 validator를 통과한 뒤 ZIP download와 Codex 좌표 기반 preview에 제공된다.

## Requirements

### Requirement: Codex Pet v2 atlas
exporter는 8열×11행, `192x208` cell로 구성된 정확히 `1536x2288` 크기의 투명 PNG atlas를 생성해야 한다(MUST). 새 package의 `spriteVersionNumber`는 `2`이고(MUST), encoded PNG의 최대 크기는 20MiB다(MUST). 빈 PNG는 `SPRITESHEET_EMPTY`, 20MiB 초과는 `SPRITESHEET_TOO_LARGE`로 거부해야 한다(MUST).

#### Scenario: 정상 v2 atlas
- **WHEN** 57개 표준 frame과 16개 look frame sampling이 성공한다
- **THEN** exporter는 PNG signature와 `1536x2288` geometry를 가진 atlas를 생성한다

#### Scenario: 크기 제한 초과
- **WHEN** encoded PNG가 20MiB를 초과한다
- **THEN** exporter는 ZIP download를 만들지 않고 package size 오류를 표시한다

### Requirement: local custom pet manifest
exporter는 정확히 `id`, `displayName`, `description`, `spriteVersionNumber: 2`, 내부 상대 `spritesheetPath` 필드만 가진 UTF-8 `pet.json`을 생성해야 한다(MUST). Builder와 recipe의 trim된 `displayName`은 JavaScript UTF-16 `length` 기준 1–80, `description`은 0–280 범위여야 한다(MUST). id는 소문자 ASCII 영숫자와 단일 hyphen 구분의 안전한 slug여야 하며(MUST), path separator, 절대 경로, `.` 또는 `..` segment를 포함해서는 안 된다(MUST NOT).

ID 파생은 표시 이름을 NFKD 정규화하고 소문자로 바꾼 뒤 combining mark를 제거하고(MUST), 정규화 결과의 각 Unicode code point를 순서대로 처리해야 한다(MUST). ASCII `a-z0-9`는 그대로 유지하고(MUST), 그 밖의 Unicode letter 또는 number는 소문자 hexadecimal code point를 `u` 앞에 붙인 token으로 변환하며(MUST), 나머지 code point는 hyphen separator로 바꾼 뒤 연속·양끝 hyphen을 제거해야 한다(MUST).
빈 표시 이름은 `DISPLAY_NAME_REQUIRED`, 안전한 ID를 만들 수 없는 이름은 `PET_ID_INVALID`로 거부해야 한다(MUST).

#### Scenario: metadata 정규화
- **WHEN** 사용자가 display name과 description을 입력한다
- **THEN** exporter는 trim한 표시값과 display name에서 파생한 안전한 id, `spriteVersionNumber: 2`를 manifest에 기록한다

#### Scenario: 비 ASCII 표시 이름의 결정적 ID
- **WHEN** 표시 이름에 한글·일본어·중국어 같은 비 ASCII letter 또는 number가 있다
- **THEN** NFKD와 combining mark 제거를 거친 각 Unicode code point는 locale transliteration이 아니라 `u<lowercase-code-point-hex>` token으로 변환되어 같은 입력에서 같은 안전한 ID를 만든다

#### Scenario: 빈 이름
- **WHEN** trim한 display name이 비어 있다
- **THEN** exporter는 package 생성을 차단하고 이름 입력을 안내한다

#### Scenario: 내부 spritesheet path
- **WHEN** manifest를 만든다
- **THEN** `spritesheetPath`는 같은 pet 디렉터리 안의 `spritesheet.png`만 가리킨다

### Requirement: 설치 디렉터리 보존 ZIP
exporter는 `<pet-id>/pet.json`과 `<pet-id>/spritesheet.png`만 포함한 ZIP Blob을 생성하고(MUST), download 이름을 `<pet-id>.codex-pet.zip`으로 제안해야 한다(MUST). Source asset과 위치 정보는 package 입력으로만 사용되며 ZIP entry가 될 수 없다(MUST).

#### Scenario: ZIP entry 구조
- **WHEN** package export가 성공한다
- **THEN** ZIP에는 하나의 top-level pet 디렉터리와 그 아래 두 필수 파일만 존재한다

#### Scenario: source privacy
- **WHEN** local 또는 remote source에서 package를 생성한다
- **THEN** ZIP과 manifest에는 source archive path, 원본 asset URL과 LiveSD runtime 파일이 포함되지 않는다

#### Scenario: 브라우저 download
- **WHEN** 검증된 package의 download 버튼을 누른다
- **THEN** 브라우저는 `application/zip` Blob을 제안된 `.codex-pet.zip` 이름으로 다운로드한다

#### Scenario: 반복 가능한 ZIP metadata
- **WHEN** 같은 manifest와 PNG로 package를 반복 생성한다
- **THEN** 두 entry는 압축 level `0`, DOS epoch `1980-01-01T00:00:00.000Z`, extended timestamp 비활성 설정을 사용해야 한다

### Requirement: 독립 package 검증
시스템은 생성한 ZIP bytes를 다시 열어 정확히 두 개인 비암호화 file entry, top-level 구조, UTF-8 안전 경로, entry signature·overlap, v2 manifest schema, manifest와 디렉터리 id 일치, PNG signature와 `1536x2288` geometry, 표준 상태 cell alpha, 미사용 cell 투명도 및 16개 look cell alpha를 검증해야 한다(MUST). `pet.json`의 압축 해제 크기는 최대 64KiB, PNG는 최대 20MiB여야 한다(MUST). 검증이 성공하기 전에는 download 완료 상태나 installed preview를 표시해서는 안 된다(MUST NOT).

Validator의 안정적 오류 code는 아래 집합으로 제한해야 한다(MUST).

```text
MANIFEST_INVALID
PACKAGE_ENTRY_ENCRYPTED
PACKAGE_ENTRY_STRUCTURE_INVALID
PACKAGE_ENTRY_UNSAFE
PACKAGE_ZIP_INVALID
PNG_CELL_EMPTY
PNG_CELL_CLIPPED
PNG_DECODE_FAILED
PNG_GEOMETRY_INVALID
PNG_INVALID
PNG_OCCUPANCY_TOO_SMALL
PNG_TOO_LARGE
PNG_UNUSED_CELL_NOT_TRANSPARENT
```

#### Scenario: 정상 v2 package 재검증
- **WHEN** exporter가 만든 ZIP을 validator가 읽는다
- **THEN** validator는 v2 manifest와 11개 atlas row를 원본 exporter 객체와 독립적으로 복원하고 모든 구조·geometry·alpha 검사를 통과한다

#### Scenario: unsafe ZIP entry
- **WHEN** entry가 top-level pet 디렉터리 밖을 가리키거나 정규화 후 충돌한다
- **THEN** validator와 test installer는 전체 package를 거부하고 파일을 쓰지 않는다

#### Scenario: ZIP filename 정규화
- **WHEN** validator가 entry filename을 읽는다
- **THEN** raw filename은 fatal UTF-8 decode 결과와 library filename이 정확히 같아야 한다
- **AND** NUL, backslash, absolute·drive path, 빈 segment, `.`·`..` 또는 두 segment가 아닌 path는 `PACKAGE_ENTRY_UNSAFE`로 거부해야 한다
- **AND** 첫 segment는 manifest와 동일한 안전 Pet ID, 두 번째 segment는 `pet.json` 또는 `spritesheet.png`여야 한다

#### Scenario: 암호화 또는 중첩 ZIP entry
- **WHEN** 두 entry 중 하나가 암호화되었거나 ZIP signature·overlap 검사를 통과하지 못한다
- **THEN** validator는 payload를 읽어 preview에 사용하지 않고 안정적 package 오류로 거부한다

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
웹은 validator가 ZIP에서 다시 읽은 atlas를 Codex와 같은 8열×11행 background 좌표로 렌더링하고(MUST), installed preview의 정확한 `192×208` sprite 영역에 visible border box와 cell size label을 표시해야 한다(MUST). preview는 9개 표준 상태 선택과 상태별 frame 순환, 16방향 pointer look 선택을 제공해야 한다(MUST). 현재 state, frame index와 look direction index는 자동 테스트가 관찰할 수 있어야 한다(MUST).

#### Scenario: installed preview border box
- **WHEN** 검증된 package preview가 표시된다
- **THEN** 현재 atlas cell은 `192×208` 고정 border box 안에서 렌더링되고 scale 또는 offset으로 crop된 edge를 확인할 수 있다

#### Scenario: 표준 상태 전환
- **WHEN** 사용자가 installed preview에서 다른 표준 상태를 선택한다
- **THEN** renderer는 해당 row의 첫 frame으로 전환하고 상태 계약의 duration으로 frame을 순환하되 `idle`에는 정의된 6배 표시 배율을 적용한다

#### Scenario: pointer look 우선순위
- **WHEN** pointer가 dead zone 밖의 preview stage에 있다
- **THEN** renderer는 현재 표준 상태 frame보다 계산된 rows 9–10의 look frame을 우선 표시한다

#### Scenario: pointer look 종료
- **WHEN** pointer가 dead zone으로 이동하거나 preview stage를 나간다
- **THEN** renderer는 look frame을 제거하고 현재 선택·hover 표준 상태로 복귀한다

#### Scenario: frame 변화
- **WHEN** 둘 이상의 서로 다른 frame을 가진 상태를 재생한다
- **THEN** browser screenshot 또는 pixel sample은 시간 경과 뒤 렌더링된 표준 상태 cell의 변화를 관찰한다

### Requirement: download ZIP 설치 검증
Playwright test installer는 download한 실제 v2 ZIP bytes를 안전하게 풀어 명시된 Codex pets root의 `<pet-id>/`에 설치하고(MUST), 설치된 `pet.json`과 `1536x2288` PNG를 다시 읽어야 한다(MUST). 기본 root는 test-results 안이며 실제 root는 명시적인 `CODEX_PET_INSTALL_ROOT`에서만 사용해야 한다(MUST).

#### Scenario: 격리 설치
- **WHEN** `CODEX_PET_INSTALL_ROOT`가 설정되지 않은 Playwright가 v2 package를 설치한다
- **THEN** installer는 repository의 격리된 test Codex home에만 두 파일을 쓰고 사용자 home을 변경하지 않는다

#### Scenario: 명시적 실제 설치
- **WHEN** 사용자가 승인한 검증 실행이 실제 `${CODEX_HOME}/pets`를 `CODEX_PET_INSTALL_ROOT`로 제공한다
- **THEN** 같은 download/install 테스트는 해당 root의 `<pet-id>/`에 검증된 v2 manifest와 PNG를 설치한다

#### Scenario: Local PRSK v2 end-to-end
- **WHEN** 유효한 공통 스켈레톤과 PRSK character ZIP에서 사용자 상태 mapping으로 package를 다운로드하고 설치한다
- **THEN** 설치된 manifest와 atlas는 v2 계약, 선택한 metadata, 9개 표준 row와 16개 look cell을 보존한다
- **AND** 웹 installed preview는 선택한 상태 animation과 pointer look을 렌더링한다

### Requirement: v2 atlas 가시 점유율과 custom framing 경계
독립 package validator는 alpha 값이 2 이상인 pixel로 모든 사용 cell의 가시 bounds를 계산해야 한다(MUST). 기본 framing 검증에서는 rows 0–10의 모든 사용 cell이 네 외곽으로부터 최소 4px의 투명 안전 여백을 가져야 한다(MUST). Builder와 recipe renderer는 `framingScale > 1.00` 또는 X/Y offset 중 하나가 0이 아닐 때만 validator의 `allowEdgeClipping`을 활성화해야 한다(MUST). `framingScale <= 1.00`이고 offset이 `0,0`이면 scale이 기본값이 아니어도 strict 안전 여백 검증을 유지해야 한다(MUST). Edge clipping이 허용된 package도 모든 사용 cell의 empty 검사, 57개 표준 cell 합집합의 `max(width / 192, height / 208) >= 0.70`, atlas geometry, manifest와 미사용 cell alpha 검사를 계속 적용해야 한다(MUST). strict 안전 여백 위반은 cell 좌표를 포함한 `PNG_CELL_CLIPPED`, 점유율 미달은 측정값을 포함한 `PNG_OCCUPANCY_TOO_SMALL`으로 package를 거부해야 한다(MUST).

#### Scenario: 기본 framing의 안전 여백
- **WHEN** scale 100%, offset `0,0` package의 used cell alpha가 4px 안전 영역에 닿는다
- **THEN** validator는 row와 column을 포함한 `PNG_CELL_CLIPPED`로 package를 거부한다

#### Scenario: custom framing edge crop 허용
- **WHEN** scale 125% 또는 0이 아닌 offset의 package를 custom framing option으로 검증하고 used cell alpha가 edge에 닿는다
- **THEN** validator는 edge 접촉만으로 package를 거부하지 않고 나머지 geometry, empty, occupancy와 unused cell 검사를 수행한다

#### Scenario: 축소만 한 framing의 strict 여백
- **WHEN** scale 80%와 offset `0,0`으로 package를 검증한다
- **THEN** validator는 edge clipping option을 활성화하지 않고 rows 0–10의 4px 안전 여백을 계속 검사한다

#### Scenario: custom framing의 빈 cell 거부
- **WHEN** 큰 offset으로 custom-framed used cell 하나가 완전히 투명해진다
- **THEN** validator는 custom framing option과 관계없이 해당 cell을 `PNG_CELL_EMPTY`로 거부한다

#### Scenario: 과도하게 축소된 atlas
- **WHEN** 57개 표준 cell의 가시 bounds 합집합 최대 점유율이 0.70보다 작다
- **THEN** validator는 측정된 점유율을 포함한 `PNG_OCCUPANCY_TOO_SMALL`으로 package를 거부한다

### Requirement: 사용자 framing과 package 결과 일관성
웹은 현재 preview의 `framingScale`과 X/Y offset을 package sampling 시작 시 snapshot해 PNG pixel에 bake해야 한다(MUST). V2 manifest는 정의된 metadata와 spritesheet 필드만 사용하며 framing은 raster 결과로 표현해야 한다(MUST). Framing 값이 변경되면 진행 중인 export와 완료된 download·validation·installed preview를 무효화하고(MUST), 사용자가 입력한 metadata와 animation mapping은 유지해야 한다(MUST). 기본 framing은 strict 70% 점유율과 4px 안전 여백을 통과해야 하고(MUST), custom framing은 edge crop을 허용하면서 empty·점유율·geometry 검사를 통과해야 한다(MUST).

#### Scenario: framing 변경 후 이전 결과 무효화
- **WHEN** 검증된 ZIP과 installed preview가 있는 상태에서 사용자가 scale 또는 X/Y offset을 변경한다
- **THEN** 이전 download와 installed preview는 제거되고 metadata와 animation mapping은 유지된 채 새 framing으로 다시 생성할 수 있다

#### Scenario: 진행 중 framing 변경
- **WHEN** sampling 또는 packaging 중 사용자가 scale 또는 offset을 변경한다
- **THEN** 이전 framing 작업은 취소되어 결과를 노출하지 않고 다음 생성은 변경된 framing snapshot을 사용한다

#### Scenario: V2 manifest와 raster framing
- **WHEN** custom framing package를 만든다
- **THEN** `pet.json`은 v2 schema의 필드를 사용하고 선택 scale과 offset은 `spritesheet.png`의 raster 결과로 표현된다

#### Scenario: preview와 package 일치
- **WHEN** 150%, X `12px`, Y `8px` framing으로 package를 생성한다
- **THEN** LiveSD preview와 export는 모두 100% 대비 1.5배, 오른쪽 12px, 아래쪽 8px라는 같은 control 의미를 사용한다
- **AND** installed preview는 export의 57개 표준 pose 합집합으로 계산된 실제 raster 결과를 정확히 표시한다
- **AND** LiveSD preview의 자동 fit은 현재 animation 한 pose, export의 자동 fit은 여러 pose 합집합이라는 각자의 calibration 계약을 따른다

### Requirement: 사용자 눈 이동량과 package 결과 일관성
웹은 ready source의 패키징 설정에 현재 locale로 표시되는 접근 가능한 눈 이동량 range를 제공해야 하며(MUST), 범위는 `50%–150%`, 기본값은 `100%`, UI 간격은 `5%`여야 한다(MUST). 생성 시작 시 선택값을 snapshot해 16개 look frame에 적용하고(MUST), remote recipe의 `pet.lookMovementScale`에 기록해 headless renderer가 같은 raster를 재현해야 한다(MUST). Schema version 1 recipe에서 이 optional 값의 기본값은 `1.00`이며(MUST), v2 `pet.json`은 이 값을 raster에만 반영해야 한다(MUST).

#### Scenario: 접근 가능한 눈 이동량 조절
- **WHEN** ready source에서 눈 이동량 slider를 조작한다
- **THEN** slider는 현재 locale의 label과 `aria-valuetext`, visible percentage output을 표시하고 5% 단위로 50%부터 150%까지 변경되어야 한다

#### Scenario: locale 전환 중 값 유지
- **WHEN** 눈 이동량을 125%로 설정한 뒤 locale을 변경한다
- **THEN** slider label과 설명은 새 locale로 바뀌고 numeric value 125%는 유지되어야 한다

#### Scenario: 완료 결과 이후 눈 이동량 변경
- **WHEN** 검증된 ZIP과 installed preview가 있는 상태에서 눈 이동량을 변경한다
- **THEN** 이전 download URL, validation 결과와 installed preview는 폐기되고 metadata와 animation mapping은 유지된다

#### Scenario: 생성 중 설정 고정
- **WHEN** sampling, packaging 또는 validation이 진행 중이다
- **THEN** 눈 이동량 slider와 초기화 action은 비활성화되고 현재 작업은 생성 시작 시 snapshot한 값을 사용한다

#### Scenario: recipe와 manifest 경계
- **WHEN** remote source에서 125% 눈 이동량 package와 설치 명령을 만든다
- **THEN** recipe는 `lookMovementScale: 1.25`를 포함하고 sampler에 같은 값을 전달하지만 생성된 v2 `pet.json`의 필드는 변경되지 않는다

### Requirement: Build 입력 snapshot과 결과 무효화

Package 생성은 active source identity, Pet metadata, framing, look scale, global mirror와 9개 mapping을 시작 시점에 snapshot해야 한다(MUST). 완료 결과는 그 snapshot에만 유효하며(MUST), source 교체 또는 metadata·framing·look·mirror·mapping 변경은 이전 ZIP, validation, installed preview와 object URL을 제거해야 한다(MUST). 변경이 허용되는 진행 중 작업은 abort하고 generation이 오래된 비동기 결과를 노출하지 않아야 한다(MUST). Locale 변경은 build input이 아니므로 현재 작업과 완료 결과를 유지해야 한다(MUST).

#### Scenario: 완료 뒤 metadata 또는 mapping 변경
- **WHEN** 검증된 package 뒤 Pet 이름·설명, 상태 animation 또는 mirror를 변경한다
- **THEN** 이전 download와 installed preview를 제거하고 새 input으로 다시 생성할 수 있어야 한다

#### Scenario: Source 교체 중 stale 결과
- **WHEN** export가 진행 중일 때 다른 source가 ready가 되어 builder instance가 교체된다
- **THEN** 이전 작업을 abort하고 이전 source의 늦은 sampling·validation 결과와 object URL을 노출하지 않아야 한다

#### Scenario: Locale 전환
- **WHEN** 생성 중이거나 검증된 결과가 있는 상태에서 locale만 변경한다
- **THEN** snapshot, 진행 작업, object URL과 installed preview는 유지되고 visible label만 새 locale로 바뀌어야 한다
