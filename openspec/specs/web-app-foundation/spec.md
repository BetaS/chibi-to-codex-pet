# 웹 애플리케이션 기반 명세

## Purpose

LiveSD Pet Builder를 React, Vite와 TypeScript로 실행하고 정적 web app으로 배포한다. 이 capability는 재현 가능한 pnpm toolchain, 품질 검사, 접근 가능한 다국어 shell, browser 지원과 application layer 경계를 정의한다.

## Requirements

### Requirement: 재현 가능한 pnpm 프로젝트
저장소는 pnpm을 유일한 패키지 관리자로 선언하고 lockfile로 애플리케이션과 개발 의존성을 재현 가능하게 설치해야 한다(MUST).

#### Scenario: 고정 의존성 설치
- **WHEN** 지원되는 Node.js 환경에서 `pnpm install --frozen-lockfile`을 실행한다
- **THEN** lockfile 변경 없이 모든 의존성이 설치된다

#### Scenario: 다른 lockfile 방지
- **WHEN** 프로젝트 파일을 검사한다
- **THEN** npm 또는 yarn lockfile이 존재하지 않고 `packageManager`가 pnpm 11 계열을 가리킨다

### Requirement: React TypeScript 앱 실행
시스템은 React, Vite와 TypeScript로 구성된 단일 페이지 앱을 개발 서버와 production build에서 실행해야 한다(MUST).

#### Scenario: 개발 서버 실행
- **WHEN** 개발자가 `pnpm dev`를 실행한다
- **THEN** Vite가 앱을 제공하고 root React 컴포넌트가 오류 없이 mount된다

#### Scenario: production build
- **WHEN** 개발자가 `pnpm build`를 실행한다
- **THEN** TypeScript 검사와 Vite build가 성공하고 정적 배포 가능한 산출물이 생성된다

#### Scenario: Repository 하위 경로 배포
- **WHEN** `DEPLOY_BASE_PATH=/chibi-to-codex-pet/`으로 production build를 실행한다
- **THEN** HTML의 module·CSS asset과 browser runtime·license URL은 모두 `/chibi-to-codex-pet/` 아래를 가리킨다
- **AND** Pages artifact root에는 정적 client 파일만 포함된다

### Requirement: 독립적인 품질 검사 명령
프로젝트는 typecheck, lint, 단위 테스트와 브라우저 테스트를 서로 독립적으로 실행하는 package script를 제공해야 한다(MUST).

#### Scenario: 정적 검사
- **WHEN** `pnpm typecheck`와 `pnpm lint`를 실행한다
- **THEN** TypeScript 오류와 ESLint 위반이 없으면 두 명령이 성공한다

#### Scenario: 단위 테스트
- **WHEN** `pnpm test`를 실행한다
- **THEN** Vitest가 `jsdom` 환경에서 모든 단위·컴포넌트 테스트를 한 번 실행하고 종료한다

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

### Requirement: Application layer 경계
Foundation 계층은 app shell, 공통 UI와 composition을 소유하고, LiveSD feature 계층은 runtime adapter, 전역 `spine` API 경계와 renderer를 소유해야 한다(MUST). PRSK integration은 game-specific resource source를 제공해야 한다(MUST). Production asset allowlist에는 고정 runtime과 필수 배포 고지가 포함되며(MUST), 모델 file은 사용자 또는 runtime provider source에서 제공되어야 한다(MUST).

#### Scenario: foundation 계층 검사
- **WHEN** foundation shell과 공통 설정의 source dependency를 검사한다
- **THEN** foundation 계층은 vendoring된 runtime이나 전역 `spine` API를 직접 import·참조하지 않고 feature 경계를 통해 확장된다

#### Scenario: LiveSD feature가 활성화된 production build
- **WHEN** LiveSD 미리보기 feature를 포함해 production build를 만든다
- **THEN** build는 feature가 공급하는 고정 `spine-webgl.js`, 원문 LICENSE와 third-party notices를 포함한다

#### Scenario: production 모델 asset 경계
- **WHEN** development에서 `public/assets` symlink와 로컬 PRSK 자산을 사용한 뒤 production build를 만든다
- **THEN** build 산출물에는 `.skel`, `sekai_atlas.atlas` 또는 PRSK PNG 모델 파일이 포함되지 않는다

### Requirement: 허용된 browser persistence 경계
Production browser code의 same-origin `localStorage` schema는 사용자 locale과 versioned Pet 설정 preset으로 구성되어야 한다(MUST). Locale persistence와 Pet preset repository가 storage access를 소유해야 하며(MUST), preset field는 metadata, framing, look scale과 animation·mirror mapping allowlist를 따라야 한다(MUST). Source와 생성 결과는 session memory에서 관리해야 한다(MUST).

#### Scenario: production storage allowlist
- **WHEN** production source와 bundle을 persistence verifier로 검사한다
- **THEN** `localStorage` 호출은 locale storage와 Pet preset repository의 명시적 module에만 존재해야 한다

#### Scenario: 민감 source 정보 제외
- **WHEN** local file 또는 remote provider source로 preview와 build를 완료한다
- **THEN** browser persistence에는 source binary, 파일·URL·provider·character 식별자와 생성 결과가 없어야 한다
