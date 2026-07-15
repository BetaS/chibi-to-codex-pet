# npx Pet 설치 명세

## Purpose

사용자는 web app이 만든 recipe를 `npx` CLI에 전달해 같은 Codex Pet v2 payload를 렌더링하고 선택한 Codex home에 설치한다. CLI는 입력 검증, browser rendering, package 검증과 transactional filesystem write를 담당한다.

## Requirements

### Requirement: recipe-first npx CLI surface

시스템은 Node.js `>=22.13.0`에서 실행되는 public `chibi-to-codex-pet` package와 같은 이름의 bin을 제공해야 한다(MUST). 사용자에게 제공하는 설치 명령은 `npx -y chibi-to-codex-pet install --recipe <recipe>` 한 형태여야 하며(MUST), repo-local package spec은 개발 검증에서만 사용해야 한다(MUST). `<recipe>`는 base64url JSON, raw JSON 또는 HTTPS recipe URL로 해석할 수 있어야 하며(MUST), CLI는 `--help`, `--version`, `--codex-home`, `--dry-run`, `--force`를 비대화형으로 처리해야 한다(MUST). `--recipe`는 정확히 한 번만 허용하고(MUST), 알 수 없는 command·option 또는 값이 없는 option은 renderer와 filesystem 작업 전에 `CLI_USAGE_INVALID`와 exit `2`로 거부해야 한다(MUST).

#### Scenario: npx recipe 설치 명령 실행
- **WHEN** 사용자가 `npx -y chibi-to-codex-pet install --recipe <recipe>`를 실행한다
- **THEN** CLI는 recipe를 strict parse하고 지원 renderer/source인지 확인한 뒤 render/install 절차를 시작한다

#### Scenario: recipe가 없는 install 거부
- **WHEN** 사용자가 `install`, `install <pet-id>` 또는 `install --recipe`만 실행한다
- **THEN** CLI는 `CLI_USAGE_INVALID`와 exit `2`를 반환하고 filesystem을 변경하지 않는다

### Requirement: web CLI 바로가기 복사

Web builder는 recipe를 만들 수 있는 remote source의 package validation이 성공하면 정확한 `npx -y chibi-to-codex-pet install --recipe <recipe>` 명령을 read-only text로 표시하고(MUST), 그 명령 바로 아래에 locale별 `CLI 바로가기 복사` action을 제공해야 한다(MUST). Action은 표시된 명령 전체를 clipboard에 그대로 기록하고 성공을 polite live status로 알려야 한다(MUST). Clipboard write가 실패하거나 API를 사용할 수 없으면 명령 text와 package download를 유지하고 locale별 수동 복사 안내를 표시해야 한다(MUST). Recipe source가 없는 build에는 실행 불가능한 CLI 명령이나 복사 action을 만들어서는 안 된다(MUST NOT).

#### Scenario: CLI 바로가기 복사 성공
- **WHEN** 검증된 remote-source build 결과에서 사용자가 `CLI 바로가기 복사`를 실행한다
- **THEN** clipboard에는 화면에 표시된 npx 명령과 byte-for-byte 같은 text가 한 번 기록되어야 한다
- **AND** UI는 복사 성공을 현재 locale로 알려야 한다

#### Scenario: Clipboard 실패
- **WHEN** clipboard write가 거부되거나 지원되지 않는다
- **THEN** read-only npx 명령과 ZIP download는 유지되어야 한다
- **AND** UI는 명령을 직접 복사하라는 현재 locale의 안내를 표시해야 한다

### Requirement: Available provider CLI recipe parity

Game source registry의 모든 available provider는 하나 이상의 canonical CLI recipe provider ID를 선언해야 하며(MUST), 선언한 ID는 shared recipe parser가 지원해야 한다(MUST). 재현 가능한 remote source의 package validation이 성공하면 공통 builder는 provider와 관계없이 npx 설치 명령과 복사 action을 표시해야 하며(MUST), local-only source에는 실행 불가능한 명령을 표시해서는 안 된다(MUST NOT). Development harness는 available provider의 선언 누락과 unsupported provider ID를 자동으로 실패시켜야 한다(MUST).

#### Scenario: Available provider registry 검증
- **WHEN** development harness가 현재 game source registry를 검사한다
- **THEN** PRSK는 `prsk-chibi-viewer`와 `custom`, STRR는 `strr-res-pak`, Garupa는 `garupa-pinned` recipe provider를 선언해야 한다
- **AND** 각 선언은 shared parser의 canonical provider 집합에 포함되어야 한다

#### Scenario: Garupa pinned Pet 생성 완료
- **WHEN** 사용자가 pinned Garupa source로 package validation을 완료한다
- **THEN** ZIP download와 함께 `garupa-pinned` source를 담은 npx 설치 명령과 locale별 복사 action이 표시되어야 한다

#### Scenario: Garupa local ZIP Pet 생성 완료
- **WHEN** 사용자가 local Garupa ZIP source로 package validation을 완료한다
- **THEN** ZIP download는 표시되지만 remote source를 가장한 npx 설치 명령과 복사 action은 표시되어서는 안 된다

### Requirement: strict Codex Pet recipe schema
Recipe는 `schemaVersion: 1`, `kind: "livesd-recipe"`, `renderer: "livesd36-codex-pet@1"`, remote `source`, `pet` metadata, framing과 look 설정, 전체 수평 반전 설정, 그리고 모든 표준 Codex Pet 상태의 animation mapping을 포함해야 한다(MUST). Version 1의 renderer 값은 source별 runtime profile을 선택하는 기존 protocol token으로 유지되어야 한다(MUST). Top level, source, pet와 각 mapping은 정의된 field 외의 key를 거부해야 하며(MUST), `package`, `packageBase64`, `spritesheet`, `spritesheetBase64`, `zip`, `zipBase64`와 local path 또는 binary payload를 허용하지 않아야 한다(MUST). JavaScript UTF-16 `length` 기준 trim된 `displayName`은 1–80, `description`은 0–280, 각 animation 이름은 1–128, remote source ID는 안전한 1–128 단일 segment, custom asset base URL 문자열은 최대 2048여야 한다(MUST). STRR source는 `provider: "strr-res-pak"`, 1–8자리 numeric `characterId`와 그 character ID로 시작하는 1–16자리 numeric `editionId`만 허용해야 한다(MUST). Garupa source는 `provider: "garupa-pinned"`와 safe single-segment `sdAssetBundleName`만 허용해야 한다(MUST).

Version 1 parser는 누락된 `globalMirrorX`와 각 mapping의 `mirrorX`를 `false`, `framingScale`과 `lookMovementScale`을 `1.00`, X/Y offset을 각각 `0`으로 정규화해야 한다(MUST). Scale 값은 범위를 검사한 뒤 소수점 둘째 자리까지 반올림해야 하며(MUST), 새로 생성하는 recipe는 모든 canonical boolean과 framing·look 값을 명시해야 한다(MUST).

#### Scenario: 유효한 prsk-chibi-viewer recipe
- **WHEN** recipe source가 `provider: "prsk-chibi-viewer"`, safe `characterId`, 유효한 scale·offset과 전체 수평 반전 값을 가진다
- **THEN** CLI는 canonical prsk-chibi-viewer catalog와 pjsek.ai area_sd asset base를 사용해 모델 리소스를 찾는다
- **AND** headless renderer는 recipe의 scale, offset, 전체 반전과 상태별 반전을 웹 exporter와 동일하게 적용한다

#### Scenario: 유효한 custom provider recipe
- **WHEN** recipe source가 `provider: "custom"`, canonical HTTPS `assetBaseUrl`, safe `characterId`와 유효한 framing 값을 가진다
- **THEN** CLI는 해당 asset base의 `catalog.json`과 모델 리소스만 요청 대상으로 사용한다

#### Scenario: 유효한 STRR 고정 mirror recipe
- **WHEN** recipe source가 `provider: "strr-res-pak"`, 유효한 numeric `characterId`와 그 캐릭터에 속한 numeric `editionId`를 가진다
- **THEN** CLI renderer는 web integration과 같은 exact-commit STRR catalog를 읽고 해당 캐릭터 skeleton과 에디션 atlas·PNG만 요청해야 한다
- **AND** 전체·상태별 반전과 framing을 웹 exporter와 동일하게 적용하고 유효한 eye rig가 없으면 정적 look fallback으로 73-frame package를 생성해야 한다

#### Scenario: 유효한 Garupa pinned recipe
- **WHEN** recipe source가 `provider: "garupa-pinned"`와 safe `sdAssetBundleName`을 가진다
- **THEN** CLI renderer는 web integration과 같은 frozen provider manifest에서 해당 bundle의 shared skeleton과 costume atlas·PNG graph를 materialize해야 한다
- **AND** 전체·상태별 반전, framing과 dual-eye look 설정을 LiveSD (Spine 4.0) web exporter와 동일하게 적용해야 한다

#### Scenario: 잘못된 STRR source 관계
- **WHEN** STRR recipe의 ID가 숫자가 아니거나 `editionId`가 `characterId`로 시작하지 않는다
- **THEN** CLI는 remote request 전에 `RECIPE_INVALID`와 exit `2`로 거부해야 한다

#### Scenario: 잘못된 Garupa bundle ID
- **WHEN** Garupa recipe의 `sdAssetBundleName`이 비어 있거나 path separator, traversal 또는 128자를 초과하는 값을 포함한다
- **THEN** CLI는 remote request 전에 `RECIPE_INVALID`와 exit `2`로 거부해야 한다

#### Scenario: Optional framing 기본값
- **WHEN** 유효한 schema version 1 recipe에 전체·상태별 수평 반전, scale 또는 X/Y offset key가 없다
- **THEN** parser는 전체·누락 상태 반전을 `false`, framing과 look scale을 `1.00`, offset을 `0,0`으로 정규화한다
- **AND** 명시된 상태별 `mirrorX`와 유효한 framing 값은 보존한다

#### Scenario: Scale 정규화
- **WHEN** recipe가 범위 안의 `framingScale: 1.234` 또는 `lookMovementScale: 1.256`을 포함한다
- **THEN** parser는 각각 `1.23`, `1.26`으로 정규화해야 한다

#### Scenario: 잘못된 recipe offset
- **WHEN** recipe에 범위 밖, 비정수 또는 유한하지 않은 X/Y offset이 있다
- **THEN** CLI는 `RECIPE_INVALID`와 exit `2`를 반환하고 renderer를 시작하지 않는다

#### Scenario: binary inline recipe 거부
- **WHEN** recipe에 `spritesheet`, `spritesheetBase64`, `zip`, `zipBase64`, local path 또는 unknown top-level key가 있다
- **THEN** CLI는 `RECIPE_INVALID`와 exit `2`를 반환한다

### Requirement: HTTPS recipe 입력 제한

CLI는 HTTPS URL recipe를 `credentials: omit`, `redirect: error`, 20초 timeout으로 요청해야 하며(MUST), response body는 Content-Length 유무와 관계없이 최대 64KiB까지만 읽어 strict UTF-8 JSON으로 parse해야 한다(MUST). HTTP 실패는 `RECIPE_URL_HTTP`, 크기 초과는 `RECIPE_URL_TOO_LARGE`, fetch·redirect·timeout·decode 실패는 `RECIPE_URL_FETCH_FAILED` 또는 `RECIPE_INVALID`와 exit `2`로 반환해야 한다(MUST).

#### Scenario: 정상 HTTPS recipe
- **WHEN** HTTPS URL이 20초 안에 64KiB 이하의 유효한 schema version 1 JSON을 반환한다
- **THEN** CLI는 redirect와 credential 전송 없이 해당 JSON을 parse하고 render 절차를 시작해야 한다

#### Scenario: 큰 streaming recipe
- **WHEN** Content-Length가 없고 누적 body가 64KiB를 초과한다
- **THEN** CLI는 reader를 취소하고 `RECIPE_URL_TOO_LARGE`와 exit `2`를 반환해야 한다

#### Scenario: HTTP와 redirect 실패
- **WHEN** recipe URL이 non-2xx status 또는 redirect를 반환한다
- **THEN** CLI는 redirect를 따라가지 않고 stable recipe URL 오류로 종료하며 renderer를 시작하지 않아야 한다

### Requirement: recipe render and validation

CLI는 recipe를 `127.0.0.1`의 임의 port에서 제공되는 package-internal headless browser renderer에 전달해야 하며(MUST), renderer는 web app과 공유하는 remote resource loader, source runtime profile에 맞는 LiveSD frame sampler, Codex Pet exporter와 package validator를 사용해야 한다(MUST). PRSK·custom·STRR source는 LiveSD 3.6 경로를, Garupa pinned source는 official LiveSD (Spine 4.0) 경로를 사용해야 한다(MUST). Headless page의 default timeout과 navigation timeout은 180초로 설정해야 한다(MUST). Renderer가 반환한 payload는 설치 전에 `pet.json`과 `spritesheet.png` 두 파일이어야 하며(MUST), manifest ID와 spritesheet v2 계약을 통과해야 한다(MUST).

#### Scenario: recipe를 v2 Pet payload로 렌더링
- **WHEN** recipe source와 mappings가 유효하고 remote resources가 공유 browser validator를 통과한다
- **THEN** renderer는 `pet.json`과 `spritesheet.png` bytes를 반환하고 CLI는 해당 manifest ID를 destination ID로 사용한다

#### Scenario: Garupa runtime routing
- **WHEN** headless renderer가 `garupa-pinned` recipe를 받는다
- **THEN** renderer는 Garupa frozen materializer와 LiveSD (Spine 4.0) sampler를 정확히 한 번 사용한다
- **AND** LiveSD 3.6 sampler로 해당 source를 처리해서는 안 된다

#### Scenario: renderer browser 없음
- **WHEN** CLI가 usable Chromium/Chrome executable을 찾지 못한다
- **THEN** CLI는 `RENDER_BROWSER_MISSING`과 exit `3`을 반환하고 filesystem을 변경하지 않는다

#### Scenario: remote 또는 rendering failure
- **WHEN** catalog fetch, model fetch, WebGL rendering, PNG encoding 또는 v2 validation이 실패한다
- **THEN** CLI는 stable error code와 exit `3`을 반환하고 Codex home을 변경하지 않는다

### Requirement: 예측 가능한 Codex home 해석

CLI는 설치 root를 absolute `--codex-home`, 비어 있지 않은 absolute `CODEX_HOME`, `path.join(os.homedir(), ".codex")` 순서로 결정해야 하며(MUST), 목적지를 항상 `<codex-home>/pets/<manifest-id>`로 구성해야 한다(MUST). 상대 path, NUL 또는 path escape는 쓰기 전에 거부해야 한다(MUST).

#### Scenario: 명시적 home이 환경 변수를 우선함
- **WHEN** `CODEX_HOME`과 다른 absolute `--codex-home /tmp/codex-a`를 주고 recipe를 설치한다
- **THEN** CLI는 `/tmp/codex-a/pets/<manifest-id>`만 대상으로 사용한다

#### Scenario: 상대 home 거부
- **WHEN** 사용될 home 값이 상대 path다
- **THEN** CLI는 `CODEX_HOME_INVALID`와 exit `2`를 반환하고 filesystem을 변경하지 않는다

### Requirement: 무변경 dry-run

`--dry-run`은 recipe parse, remote rendering, payload validation, home resolution과 destination 충돌 판정을 수행해야 하지만(MUST), home·`pets`·lock·stage·backup·destination을 만들거나 변경해서는 안 된다(MUST NOT).

#### Scenario: 존재하지 않는 home에 대한 dry-run
- **WHEN** 존재하지 않는 absolute `--codex-home`과 정상 recipe로 `install --recipe <recipe> --dry-run`을 실행한다
- **THEN** CLI는 `PET_INSTALL_DRY_RUN`과 exit `0`으로 계획된 path를 출력하고 그 home directory를 만들지 않는다

### Requirement: 반복 설치와 명시적 덮어쓰기

CLI는 destination에 정확히 같은 `pet.json`과 `spritesheet.png` bytes만 있으면 idempotent no-op으로 성공해야 한다(MUST). 다른 일반 directory가 있으면 `--force` 없이는 보존하고 실패해야 하며(MUST), `--force`가 있을 때만 검증된 payload로 directory 전체를 교체해야 한다(MUST). destination 또는 installer-owned path가 symlink나 예상하지 않은 file type이면 `--force`로도 변경해서는 안 된다(MUST NOT).

#### Scenario: 같은 recipe 재설치
- **WHEN** destination에 방금 생성된 payload와 같은 두 file만 있고 사용자가 다시 설치한다
- **THEN** CLI는 `PET_ALREADY_CURRENT`와 exit `0`을 반환하고 file timestamp와 bytes를 변경하지 않는다

#### Scenario: 다른 기존 Pet 보존
- **WHEN** 같은 manifest ID destination의 bytes가 다르고 `--force`가 없다
- **THEN** CLI는 `PET_ALREADY_INSTALLED`와 exit `4`를 반환하고 기존 directory를 보존한다

### Requirement: 같은 filesystem의 transactional install

CLI는 source 검증 후 `<codex-home>/pets` 안에 exclusive per-ID lock과 random sibling stage를 만들고, stage를 다시 검증한 다음 atomic rename으로 commit해야 한다(MUST). Force 교체는 sibling backup과 rollback을 사용해야 하며(MUST), 실패 시 자신이 만든 temporary path를 정리하고 설치 전 tree를 복구해야 한다(MUST).

#### Scenario: fresh install의 atomic commit
- **WHEN** destination이 없고 stage copy 및 재검증이 성공한다
- **THEN** CLI는 같은 `pets` filesystem에서 stage를 destination으로 rename한다

#### Scenario: 같은 ID 동시 설치
- **WHEN** 한 process가 ID lock을 가진 동안 다른 process가 같은 ID 설치를 시작한다
- **THEN** 두 번째 process는 첫 process의 file을 변경하지 않고 `PET_INSTALL_BUSY`와 exit `4`를 반환한다

### Requirement: 안정적인 결과와 Codex desktop handoff

CLI는 성공·dry-run·동일 version no-op에 exit `0`, 사용법·home·recipe 오류에 exit `2`, renderer·remote·payload 검증 오류에 exit `3`, destination·lock 충돌에 exit `4`, filesystem·rollback 오류에 exit `5`를 사용해야 한다(MUST). 오류는 stable 영문 code와 한국어 message를 stack 없이 stderr에 쓰고, 성공은 CLI version, Pet ID, absolute destination과 Codex refresh 안내를 stdout에 써야 한다(MUST). Desktop handoff는 설치 경로와 refresh 안내로 완료되며 Codex 설정과 선택 Pet은 사용자가 Codex에서 관리해야 한다(MUST).

| Exit | Stable code |
|---:|---|
| 0 | `PET_INSTALLED`, `PET_ALREADY_CURRENT`, `PET_INSTALL_DRY_RUN` |
| 2 | `CLI_USAGE_INVALID`, `RECIPE_INVALID`, `RECIPE_URL_HTTP`, `RECIPE_URL_TOO_LARGE`, `RECIPE_URL_FETCH_FAILED`, `CODEX_HOME_INVALID` |
| 3 | `RENDER_BROWSER_MISSING`, `PET_RENDER_FAILED`, `PET_RENDER_INVALID` |
| 4 | `PET_ALREADY_INSTALLED`, `PET_INSTALL_BUSY` |
| 5 | `RENDER_SERVER_FAILED`, `PET_INSTALL_IO` |

#### Scenario: 설치 성공 안내
- **WHEN** recipe render와 fresh install이 성공한다
- **THEN** CLI는 exit `0`, stable success code, Pet ID, absolute destination과 Codex custom pet refresh 안내를 stdout에 출력한다

#### Scenario: 예측 가능한 오류 출력
- **WHEN** usage, recipe, renderer, conflict 또는 filesystem 오류가 발생한다
- **THEN** CLI는 해당 stable code와 exit를 stderr에 출력하고 stack trace 또는 내부 exception object를 노출하지 않는다
