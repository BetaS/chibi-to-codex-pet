# npx Pet 설치 명세

## Purpose

사용자는 web app이 만든 recipe를 `npx` CLI에 전달해 같은 Codex Pet v2 payload를 렌더링하고 선택한 Codex home에 설치한다. CLI는 입력 검증, browser rendering, package 검증과 transactional filesystem write를 담당한다.

## Requirements

### Requirement: recipe-first npx CLI surface

시스템은 Node.js `>=22.12.0`에서 실행되는 public `chibi-to-codex-pet` package와 같은 이름의 bin을 제공해야 한다(MUST). 사용자에게 제공하는 설치 명령은 `npx -y chibi-to-codex-pet install --recipe <recipe>` 한 형태여야 하며(MUST), repo-local package spec은 개발 검증에서만 사용해야 한다(MUST). `<recipe>`는 base64url JSON, raw JSON 또는 HTTPS recipe URL로 해석할 수 있어야 하며(MUST), CLI는 `--help`, `--version`, `--codex-home`, `--dry-run`, `--force`를 비대화형으로 처리해야 한다(MUST).

#### Scenario: npx recipe 설치 명령 실행
- **WHEN** 사용자가 `npx -y chibi-to-codex-pet install --recipe <recipe>`를 실행한다
- **THEN** CLI는 recipe를 strict parse하고 지원 renderer/source인지 확인한 뒤 render/install 절차를 시작한다

#### Scenario: recipe가 없는 install 거부
- **WHEN** 사용자가 `install`, `install <pet-id>` 또는 `install --recipe`만 실행한다
- **THEN** CLI는 `CLI_USAGE_INVALID`와 exit `2`를 반환하고 filesystem을 변경하지 않는다

### Requirement: strict Codex Pet recipe schema
Recipe는 `schemaVersion: 1`, `kind: "livesd-recipe"`, `renderer: "livesd36-codex-pet@1"`, remote `source`, `pet` metadata, framing scale과 optional X/Y offset, PRSK 전체 수평 반전 설정, 그리고 모든 표준 Codex Pet 상태의 animation mapping과 상태별 `mirrorX`를 포함해야 한다(MUST). Recipe의 value는 JSON metadata와 설정으로 제한하고 binary payload와 local path는 허용하지 않아야 한다(MUST). Optional 전체 반전의 기본값은 `false`, X/Y offset의 기본값은 각각 `0`이며(MUST), 새로 생성하는 recipe는 canonical boolean과 framing 값을 명시해야 한다(MUST).

#### Scenario: 유효한 prsk-chibi-viewer recipe
- **WHEN** recipe source가 `provider: "prsk-chibi-viewer"`, safe `characterId`, 유효한 scale·offset과 전체 수평 반전 값을 가진다
- **THEN** CLI는 canonical prsk-chibi-viewer catalog와 pjsek.ai area_sd asset base를 사용해 모델 리소스를 찾는다
- **AND** headless renderer는 recipe의 scale, offset, 전체 반전과 상태별 반전을 웹 exporter와 동일하게 적용한다

#### Scenario: 유효한 custom provider recipe
- **WHEN** recipe source가 `provider: "custom"`, canonical HTTPS `assetBaseUrl`, safe `characterId`와 유효한 framing 값을 가진다
- **THEN** CLI는 해당 asset base의 `catalog.json`과 모델 리소스만 요청 대상으로 사용한다

#### Scenario: Optional framing 기본값
- **WHEN** 유효한 schema version 1 recipe에 전체 수평 반전과 X/Y offset key가 없다
- **THEN** parser는 전체 반전을 `false`, offset을 `0,0`으로 정규화한다
- **AND** 입력의 상태별 `mirrorX`와 `framingScale`을 그대로 사용한다

#### Scenario: 잘못된 recipe offset
- **WHEN** recipe에 범위 밖, 비정수 또는 유한하지 않은 X/Y offset이 있다
- **THEN** CLI는 `RECIPE_INVALID`와 exit `2`를 반환하고 renderer를 시작하지 않는다

#### Scenario: binary inline recipe 거부
- **WHEN** recipe에 `spritesheet`, `spritesheetBase64`, `zip`, `zipBase64`, local path 또는 unknown top-level key가 있다
- **THEN** CLI는 `RECIPE_INVALID`와 exit `2`를 반환한다

### Requirement: recipe render and validation

CLI는 recipe를 package-internal headless browser renderer에 전달해야 하며(MUST), renderer는 web app과 공유하는 remote resource loader, LiveSD frame sampler, Codex Pet exporter와 package validator를 사용해야 한다(MUST). Renderer가 반환한 payload는 설치 전에 `pet.json`과 `spritesheet.png` 두 파일이어야 하며(MUST), manifest ID와 spritesheet v2 계약을 통과해야 한다(MUST).

#### Scenario: recipe를 v2 Pet payload로 렌더링
- **WHEN** recipe source와 mappings가 유효하고 remote resources가 공유 browser validator를 통과한다
- **THEN** renderer는 `pet.json`과 `spritesheet.png` bytes를 반환하고 CLI는 해당 manifest ID를 destination ID로 사용한다

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

#### Scenario: 설치 성공 안내
- **WHEN** recipe render와 fresh install이 성공한다
- **THEN** CLI는 exit `0`, stable success code, Pet ID, absolute destination과 Codex custom pet refresh 안내를 stdout에 출력한다

#### Scenario: 예측 가능한 오류 출력
- **WHEN** usage, recipe, renderer, conflict 또는 filesystem 오류가 발생한다
- **THEN** CLI는 해당 stable code와 exit를 stderr에 출력하고 stack trace 또는 내부 exception object를 노출하지 않는다
