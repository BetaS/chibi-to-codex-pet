# npm Pet bundle 명세

## Purpose

`chibi-to-codex-pet` CLI를 공개 npm tarball로 배포한다. Package는 recipe renderer와 설치 bin에 필요한 file만 포함하고 public registry와 local package spec에서 같은 방식으로 실행된다.

## Requirements

### Requirement: publish 가능한 CLI package 경계

프로젝트는 `packages/cli`에서 public `chibi-to-codex-pet` npm package를 제공해야 한다(MUST). Package는 ESM `chibi-to-codex-pet` bin, Node.js `>=22.13.0` engine과 `dist`, `renderer`, package metadata·문서·license로 구성된 files allowlist를 가져야 한다(MUST). Web root는 private application workspace이며 local package spec은 registry와 독립된 개발 검증에 사용할 수 있어야 한다(MUST).

#### Scenario: 실제 npm tarball 생성
- **WHEN** release check가 CLI workspace에서 actual `npm pack`을 실행한다
- **THEN** tarball의 package 이름은 `chibi-to-codex-pet`이고 executable bin은 built `dist/cli.js`를 가리킨다

#### Scenario: Workspace package 검증
- **WHEN** dependency를 설치한 repository에서 CLI/renderer build와 `pnpm --filter chibi-to-codex-pet verify:pack`을 실행한다
- **THEN** release check는 actual tarball의 executable, dependency, file allowlist와 credential·model signature 비포함을 검증한다
- **AND** 실제 provider recipe render·install smoke는 package 검증이나 CI의 전제 조건이어서는 안 된다

#### Scenario: Workspace publish 범위
- **WHEN** root와 workspace package manifest를 검사한다
- **THEN** root `livesd-pet-builder`는 계속 `private: true`이고 CLI package만 publish 대상이다

### Requirement: headless renderer asset 포함

CLI package는 recipe rendering을 위해 package-internal renderer HTML/JS/CSS와 Spine 3.6 runtime asset을 포함해야 한다(MUST). Renderer는 package-local loopback HTTP server에서만 제공되어야 하며(MUST), user-controlled path를 static file path로 직접 사용해서는 안 된다(MUST NOT).

#### Scenario: renderer HTML 제공
- **WHEN** CLI가 recipe install을 시작한다
- **THEN** CLI는 package-internal renderer directory를 loopback HTTP server로 열고 headless browser가 `/index.html`을 로드하게 한다

#### Scenario: static path escape 거부
- **WHEN** renderer server가 `..`, encoded traversal 또는 directory request를 받는다
- **THEN** server는 package directory 밖의 파일을 읽지 않는다

### Requirement: npm tarball file allowlist

Published package는 package metadata가 선언한 `LICENSE`, `README.md`, `dist`와 `renderer` file로 구성되어야 한다(MUST). Runtime model은 recipe의 remote source에서 읽고 Pet payload는 CLI 실행 중 생성해야 한다(MUST). Release check는 tarball entry와 content를 이 allowlist 및 credential·model signature 검사로 검증해야 한다(MUST).

#### Scenario: Allowlist 밖 asset 탐지
- **WHEN** npm files 설정 또는 build 실수로 raw PRSK asset, 생성 ZIP, generated spritesheet, fixture나 browser asset이 tarball에 들어간다
- **THEN** release check는 allowlist 밖 path를 보고하고 publish 검증을 실패 처리한다

### Requirement: 명시적 CLI 실행과 browser prerequisite

Published package의 설치 lifecycle script 목록은 비어 있어야 한다(MUST). CLI는 사용자가 bin을 실행한 뒤 `CHIBI_TO_CODEX_PET_CHROMIUM`, Playwright-compatible browser cache 또는 system Chrome/Chromium 후보에서 browser executable을 찾아야 하며(SHOULD), 찾지 못하면 browser 설치 안내와 함께 실패해야 한다(MUST).

#### Scenario: lifecycle script 검사
- **WHEN** actual tarball의 `package.json`을 읽는다
- **THEN** consumer install 시 실행되는 lifecycle script가 없고 Pet file은 CLI bin을 명시적으로 실행하기 전까지 어떤 home에도 복사되지 않는다

### Requirement: web production bundle 격리

웹 production build의 entry graph는 web application과 공유 recipe schema·command formatter로 구성되어야 한다(MUST). CLI bin, headless renderer, CLI test와 generated Pet payload는 CLI workspace가 소유해야 한다(MUST).

#### Scenario: 웹 production build 격리
- **WHEN** CLI workspace와 renderer가 준비된 상태에서 웹 production build를 실행한다
- **THEN** web `dist`에는 CLI bin, CLI renderer output, generated Pet manifest·spritesheet 또는 release-only fixture가 포함되지 않는다
