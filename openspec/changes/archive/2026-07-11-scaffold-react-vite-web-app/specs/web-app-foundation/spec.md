## ADDED Requirements

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

### Requirement: 접근 가능한 한국어 앱 shell
앱은 제품명을 나타내는 단일 최상위 heading, 한국어 현재 상태 설명과 동적 상태를 위한 `aria-live` 영역을 제공해야 한다(MUST).

#### Scenario: 초기 화면
- **WHEN** 사용자가 앱 root를 연다
- **THEN** `LiveSD Pet Builder` heading과 현재 구현 단계의 한국어 안내를 볼 수 있다

#### Scenario: 접근성 상태 영역
- **WHEN** 컴포넌트 테스트가 초기 앱 shell을 조회한다
- **THEN** 동적 진행·오류 메시지를 표시할 `aria-live` 영역이 존재한다

### Requirement: Phase 1 Chromium 지원
프로젝트의 자동 브라우저 호환 범위는 desktop Chromium으로 제한해야 한다(MUST).

#### Scenario: Playwright project 구성
- **WHEN** Playwright 설정을 검사한다
- **THEN** Chromium project가 존재하고 Firefox 또는 WebKit project는 포함되지 않는다

### Requirement: 후속 기능 확장 경계
Vite와 React 기반은 후속 LiveSD 변경이 개발 middleware와 feature 컴포넌트를 추가할 수 있어야 하며(MUST), foundation 자체는 LiveSD runtime이나 PRSK 자산을 포함해서는 안 된다(MUST NOT).

#### Scenario: foundation build 검사
- **WHEN** foundation 변경만 적용해 production build를 만든다
- **THEN** build 산출물에 `spine-webgl.js`와 PRSK 모델 파일이 포함되지 않는다
