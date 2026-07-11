## ADDED Requirements

### Requirement: publish 가능한 CLI package 경계

프로젝트는 private 웹 root와 분리된 local `@chibi-to-codex-pet/cli` npm package를 제공해야 한다(MUST). Package는 ESM `chibi-to-codex-pet` bin, Node.js `>=22.12.0` engine과 `dist`, `renderer`, package metadata·문서·license만 허용하는 files allowlist를 가져야 하며(MUST), 웹 root를 publish 가능하게 바꾸거나 npm registry publish를 요구해서는 안 된다(MUST NOT).

#### Scenario: 실제 npm tarball 생성
- **WHEN** release check가 CLI workspace에서 actual `npm pack`을 실행한다
- **THEN** tarball의 package 이름은 `@chibi-to-codex-pet/cli`이고 executable bin은 built `dist/cli.js`를 가리킨다

#### Scenario: local npx package spec 검증
- **WHEN** 다른 PC에서 사용자가 repo를 pull하고 `pnpm verify:local-npx`를 실행한다
- **THEN** 스크립트는 dependency install, CLI/renderer build, package contents 검사, local npx version, recipe dry-run, 임시 Codex home install과 repeat no-op을 검증한다

#### Scenario: 웹 root publish 방지
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

### Requirement: raw/generated Pet asset 비포함

Published package는 raw `.skel`, `.atlas`, source texture, generated `.codex-pet.zip`, generated `pet.json`, generated `spritesheet.png`, browser `public/assets`와 credential을 포함해서는 안 된다(MUST NOT). Recipe는 runtime에 remote source에서 asset을 가져와 새 payload를 생성해야 한다(MUST).

#### Scenario: 금지 asset 유출 탐지
- **WHEN** npm files 설정 또는 build 실수로 raw PRSK asset, 생성 ZIP, generated spritesheet, fixture나 browser asset이 tarball에 들어간다
- **THEN** release check는 금지 path와 함께 실패하고 publish 단계로 진행하지 않는다

### Requirement: browser prerequisite without install lifecycle download

Published package는 `preinstall`, `install`, `postinstall` lifecycle script를 포함해서는 안 된다(MUST NOT). CLI는 `CHIBI_TO_CODEX_PET_CHROMIUM`, Playwright-compatible browser cache 또는 system Chrome/Chromium 후보로 browser executable을 찾아야 하며(SHOULD), 찾지 못하면 browser 설치 안내와 함께 실패해야 한다(MUST).

#### Scenario: lifecycle script 검사
- **WHEN** actual tarball의 `package.json`을 읽는다
- **THEN** consumer install 시 실행되는 lifecycle script가 없고 Pet file은 CLI bin을 명시적으로 실행하기 전까지 어떤 home에도 복사되지 않는다

### Requirement: web production bundle 격리

웹 production build는 CLI package code, headless renderer build output, local CLI tests와 generated Pet bytes를 포함해서는 안 된다(MUST NOT). 웹 source는 recipe schema와 command formatter만 공유할 수 있다(MAY).

#### Scenario: 웹 production build 격리
- **WHEN** CLI workspace와 renderer가 준비된 상태에서 기존 웹 production build를 실행한다
- **THEN** web `dist`에는 CLI bin, CLI renderer output, generated Pet manifest·spritesheet 또는 release-only fixture가 포함되지 않는다
