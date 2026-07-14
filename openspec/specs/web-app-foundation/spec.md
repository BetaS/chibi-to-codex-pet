# 웹 애플리케이션 기반 명세

## Purpose

LiveSD Pet Builder를 React, Vite와 TypeScript로 실행하고 GitHub Pages 정적 web app으로 배포한다. 이 capability는 재현 가능한 pnpm toolchain, 공통 combobox, 품질 검사, 접근 가능한 다국어 shell, browser 지원, persistence와 application layer 경계를 정의한다.

## Requirements

### Requirement: 재현 가능한 pnpm 프로젝트
저장소는 Node.js `>=22.13.0`과 `packageManager: pnpm@11.7.0`을 선언하고 pnpm을 유일한 패키지 관리자로 사용해야 한다(MUST). Root lockfile은 web app과 `packages/cli` workspace의 애플리케이션·개발 의존성을 재현 가능하게 설치해야 한다(MUST).

#### Scenario: 고정 의존성 설치
- **WHEN** 지원되는 Node.js 환경에서 `pnpm install --frozen-lockfile`을 실행한다
- **THEN** lockfile 변경 없이 모든 의존성이 설치된다

#### Scenario: 다른 lockfile 방지
- **WHEN** 프로젝트 파일을 검사한다
- **THEN** npm 또는 yarn lockfile이 존재하지 않고 `packageManager`는 정확히 `pnpm@11.7.0`, Node engine은 `>=22.13.0`이어야 한다

### Requirement: React TypeScript 앱 실행
시스템은 React, Vite와 TypeScript로 구성된 단일 페이지 앱을 개발 서버와 production build에서 실행해야 한다(MUST).

#### Scenario: 개발 서버 실행
- **WHEN** 개발자가 `pnpm dev`를 실행한다
- **THEN** Vite가 앱을 제공하고 root React 컴포넌트가 오류 없이 mount된다

#### Scenario: production build
- **WHEN** 개발자가 `pnpm build`를 실행한다
- **THEN** `tsc -b`, `pnpm --filter chibi-to-codex-pet build`, `pnpm verify:runtime`, `vite build`, `pnpm verify:dist`가 이 순서로 성공해야 한다
- **AND** 정적 client 산출물은 `dist/client/`, static-host worker entry는 `dist/server/index.js`에 생성되어야 한다

#### Scenario: Repository 하위 경로 배포
- **WHEN** `DEPLOY_BASE_PATH=/chibi-to-codex-pet/`으로 production build를 실행한다
- **THEN** HTML의 module·CSS asset과 browser runtime·license URL은 모두 `/chibi-to-codex-pet/` 아래를 가리킨다
- **AND** Pages artifact root에는 정적 client 파일만 포함된다

#### Scenario: deploy base path 정규화
- **WHEN** `DEPLOY_BASE_PATH`가 비어 있으면 `/`, 끝 slash가 없는 `/repo`면 `/repo/`로 build한다
- **THEN** Vite base와 runtime URL은 정규화된 같은 absolute path prefix를 사용해야 한다
- **AND** query, fragment, backslash를 포함하거나 `/`로 시작하지 않는 값은 build 전에 거부해야 한다

### Requirement: GitHub Pages 자동 배포
저장소는 `.github/workflows/deploy-pages.yml`에서 `main` branch push와 수동 `workflow_dispatch`를 trigger로 GitHub Pages를 배포해야 한다(MUST). Workflow는 repository checkout, pnpm 설정, Node.js `22.13.0`, `pnpm install --frozen-lockfile`, Pages base path가 주입된 `pnpm build`, `dist/client` artifact upload와 Pages deploy 순서로 실행해야 한다(MUST). 권한은 `contents: read`, `pages: write`, `id-token: write`로 제한하고(MUST), `github-pages` concurrency group의 이전 실행을 취소해야 한다(MUST).

#### Scenario: main push 배포
- **WHEN** commit이 `main` branch에 push된다
- **THEN** workflow는 Pages가 제공한 base path 뒤에 slash를 붙여 `DEPLOY_BASE_PATH`로 build해야 한다
- **AND** build job이 성공한 경우에만 `dist/client` artifact를 `github-pages` environment에 배포해야 한다

#### Scenario: 다른 branch push
- **WHEN** commit이 `main` 이외의 branch에만 push된다
- **THEN** Pages workflow는 자동으로 시작되지 않아야 한다

#### Scenario: 수동 재배포
- **WHEN** 관리자가 GitHub Actions에서 workflow를 수동 실행한다
- **THEN** 같은 frozen install, build, artifact와 deploy 절차를 사용해야 한다

### Requirement: 독립적인 품질 검사 명령
프로젝트는 typecheck, lint, 단위 테스트와 브라우저 테스트를 서로 독립적으로 실행하는 package script를 제공해야 한다(MUST).

#### Scenario: 정적 검사
- **WHEN** `pnpm typecheck`와 `pnpm lint`를 실행한다
- **THEN** TypeScript 오류와 ESLint 위반이 없으면 두 명령이 성공한다

#### Scenario: 단위 테스트
- **WHEN** `pnpm test`를 실행한다
- **THEN** root Vitest가 `jsdom` 환경에서 web 단위·컴포넌트 테스트를 한 번 실행하고, 이어서 CLI workspace Vitest가 Node 환경 테스트를 실행한 뒤 종료한다

#### Scenario: 브라우저 테스트
- **WHEN** `pnpm test:e2e`를 실행한다
- **THEN** Playwright가 desktop Chromium project와 Vite web server를 사용해 모든 e2e 테스트를 실행한다

### Requirement: 접근 가능한 다국어 앱 shell
앱은 제품명을 나타내는 단일 최상위 heading, 현재 locale의 상태 설명, 상단 locale selector와 동적 상태를 위한 `aria-live` 영역을 제공해야 한다(MUST). 최초 locale은 browser 감지 또는 저장된 선택으로 결정하고(MUST), 미지원 browser 언어는 영어로 fallback해야 한다(MUST).

#### Scenario: 초기 화면
- **WHEN** 사용자가 앱 root를 지원되는 browser locale로 연다
- **THEN** `LiveSD Pet Builder` heading과 지원 workflow 안내를 해당 locale로 볼 수 있어야 한다

#### Scenario: 미지원 locale 초기 화면
- **WHEN** 저장된 선택 없이 지원되지 않는 browser locale로 앱 root를 연다
- **THEN** shell과 상단 selector는 영어로 표시되어야 한다

#### Scenario: 접근성 상태 영역
- **WHEN** 컴포넌트 테스트가 초기 앱 shell을 조회한다
- **THEN** 현재 locale의 동적 진행·오류 메시지를 표시할 `aria-live` 영역이 존재해야 한다

### Requirement: Browser 지원과 E2E 범위
Desktop Chromium은 지원 browser이자 자동 E2E 검증 대상이어야 한다(MUST).

#### Scenario: Playwright project 구성
- **WHEN** Playwright 설정을 검사한다
- **THEN** 설정은 desktop Chromium project를 실행 대상으로 정의한다

### Requirement: 공통 검색형 combobox 상호작용
캐릭터, 직접 animation과 9개 상태 animation selector는 같은 accessible combobox 계약을 사용해야 한다(MUST). Popup을 열면 현재 선택 option을 initial active option으로 삼고 listbox viewport 안에 `block: nearest` 방식으로 자동 스크롤해야 한다(MUST). 선택값이 현재 filtered option에 없으면 첫 visible option을 active로 사용해야 한다(MUST). Arrow key는 visible option 안에서 양끝을 순환하고(MUST), Enter만 active option을 commit하며 Escape와 blur는 선택값을 유지한 채 popup을 닫아야 한다(MUST).

#### Scenario: 선택 항목이 긴 목록 아래에 있음
- **WHEN** 선택값이 viewport 밖에 있는 combobox를 pointer 또는 keyboard로 연다
- **THEN** 선택 option은 `aria-selected`와 active highlight를 가지고 가장 가까운 scroll 위치로 이동해 보여야 한다
- **AND** popup open과 scroll 자체는 selection callback, preview play 또는 network request를 만들지 않아야 한다

#### Scenario: Keyboard 순환과 commit
- **WHEN** 열린 popup에서 첫 option에 ArrowUp 또는 마지막 option에 ArrowDown을 누른다
- **THEN** highlight는 각각 마지막 또는 첫 visible option으로 순환해야 한다
- **AND** Enter 전까지 canonical value는 유지되어야 한다

#### Scenario: Escape와 query reset
- **WHEN** 사용자가 query와 highlight를 바꾼 뒤 Escape를 누르거나 source·preset 변경으로 `queryResetKey`가 바뀐다
- **THEN** committed value는 유지되고 popup, uncontrolled query와 highlight가 초기화되어야 한다

### Requirement: Application layer 경계
Foundation 계층은 app shell, 공통 UI와 composition을 소유하고, LiveSD feature 계층은 runtime adapter, 전역 `spine` API 경계와 renderer를 소유해야 한다(MUST). PRSK integration은 game-specific resource source를 제공해야 한다(MUST). Production asset allowlist에는 고정 runtime과 필수 배포 고지가 포함되며(MUST), 모델 file은 사용자 또는 runtime provider source에서 제공되어야 한다(MUST).

#### Scenario: foundation 계층 검사
- **WHEN** foundation shell과 공통 설정의 source dependency를 검사한다
- **THEN** foundation 계층은 vendoring된 runtime이나 전역 `spine` API를 직접 import·참조하지 않고 feature 경계를 통해 확장된다

#### Scenario: LiveSD feature가 활성화된 production build
- **WHEN** LiveSD 미리보기 feature를 포함해 production build를 만든다
- **THEN** build는 feature가 공급하는 고정 `spine-webgl.js`, 원문 LICENSE와 third-party notices를 포함한다

#### Scenario: production 모델 asset 경계
- **WHEN** LiveSD provider 기능을 포함한 production build를 만든다
- **THEN** build 산출물에는 `.skel`, `sekai_atlas.atlas` 또는 PRSK PNG 모델 파일이 포함되지 않는다

#### Scenario: production option과 origin 경계
- **WHEN** production artifact verifier가 HTML, JavaScript, CSS, JSON과 text 산출물을 검사한다
- **THEN** 고정 `sd_*` PRSK character ID, 고정 `m_normal|wait|idle|talk|walk|run_*` animation option, generated catalog와 test·사용자별 remote origin이 포함되지 않아야 한다
- **AND** browser option은 runtime에 불러온 catalog와 skeleton에서만 생성되어야 한다

### Requirement: 허용된 browser persistence 경계
Production browser code의 same-origin writable persistence key는 `chibi-to-codex-pet.locale.v1`, `chibi-to-codex-pet.pet-presets.prsk.v1`, `chibi-to-codex-pet.pet-presets.strr.v1`, `chibi-to-codex-pet.pet-presets.garupa.v1`로 제한되어야 한다(MUST). 이전 `chibi-to-codex-pet.pet-presets.v1`은 runtime별 key가 없을 때 source provider별 migration을 위한 read-only 입력으로만 허용해야 한다(MAY). Locale persistence와 Pet preset repository가 각각의 `localStorage` access를 소유해야 하며(MUST), preset field는 metadata, framing, look scale과 animation·mirror mapping allowlist를 따라야 한다(MUST). Production source와 bundle은 `sessionStorage`와 `indexedDB`를 사용해서는 안 되며(MUST NOT), source와 생성 결과는 session memory에서 관리해야 한다(MUST).

#### Scenario: production storage allowlist
- **WHEN** production source와 bundle을 persistence verifier로 검사한다
- **THEN** `localStorage` 호출은 locale storage와 Pet preset repository의 명시적 module에만 존재해야 한다

#### Scenario: 민감 source 정보 제외
- **WHEN** local file 또는 remote provider source로 preview와 build를 완료한다
- **THEN** browser persistence에는 source binary, 파일·URL·provider·character 식별자와 생성 결과가 없어야 한다
