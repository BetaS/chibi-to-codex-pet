## Why

저장소에는 브라우저 애플리케이션 코드와 패키지 설정이 없어 LiveSD 가져오기·미리보기 변경을 구현하거나 검증할 실행 기반이 없다. 확정된 프런트엔드와 테스트 도구를 별도 변경으로 먼저 구축해 기능 변경이 제품·도구 선택을 다시 결정하지 않게 한다.

## What Changes

- React, Vite와 TypeScript 기반 단일 페이지 앱을 저장소 루트에 구성한다.
- pnpm과 고정 lockfile로 애플리케이션 및 개발 의존성을 관리한다.
- Vitest `jsdom` 단위 테스트와 Playwright Chromium 브라우저 테스트 환경을 추가한다.
- TypeScript 검사, ESLint, 단위 테스트, 브라우저 테스트와 production build 명령을 제공한다.
- 한국어 기본 앱 shell과 접근 가능한 상태 영역을 제공하되 LiveSD 기능 자체는 구현하지 않는다.
- router와 별도 전역 상태 관리 라이브러리 없이 React 기본 상태 관리로 시작한다.
- Phase 1 브라우저 지원 범위를 desktop Chromium으로 고정한다.

## Capabilities

### New Capabilities

- `web-app-foundation`: React/Vite 애플리케이션의 실행, 검사, 테스트, build와 최소 접근성 shell 계약을 정의한다.

### Modified Capabilities

없음.

## Impact

- 루트에 `package.json`, `pnpm-lock.yaml`, TypeScript/Vite/ESLint/Playwright 설정과 앱 entry가 추가된다.
- React와 Vite가 production 의존 기반이 되고 Vitest, jsdom, Playwright 및 Testing Library가 개발 의존성이 된다.
- 후속 LiveSD 변경은 이 기반의 `src/`와 Vite middleware 확장 지점을 사용한다.
- 기존 README, OpenSpec과 gitignore된 `assets/`에는 동작상 변경이 없다.
