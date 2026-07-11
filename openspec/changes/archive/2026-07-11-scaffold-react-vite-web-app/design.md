## Context

저장소에는 `package.json`, 앱 entry, 빌드 설정과 테스트 환경이 없다. 후속 `add-livesd-36-prsk-import-preview` 변경은 브라우저 File/Blob API, WebGL canvas, 로컬 Vite middleware와 React UI가 필요하므로 기능 코드보다 먼저 재현 가능한 실행 기반을 만들어야 한다.

개발 환경에는 Node.js 22와 pnpm 11이 설치되어 있다. 제품은 브라우저 전용 단일 사용자 도구이며 Phase 1은 desktop Chromium만 지원한다.

## Goals / Non-Goals

**Goals:**

- 저장소 루트에서 일관된 설치, 개발, 검사, 테스트와 build 명령을 제공한다.
- React와 TypeScript로 후속 기능이 사용할 단일 페이지 shell을 제공한다.
- Vitest `jsdom` 단위 테스트와 Playwright Chromium 브라우저 테스트를 모두 실행 가능하게 한다.
- Vite 설정이 후속 로컬 자산·runtime middleware를 추가할 수 있는 확장 지점을 제공한다.
- 기본 UI와 테스트가 한국어 사용자 메시지와 접근성 semantic을 검증한다.

**Non-Goals:**

- LiveSD importer, runtime 또는 WebGL 미리보기 구현
- router, 서버 렌더링, 백엔드, API client 또는 전역 상태 라이브러리
- Firefox, Safari, WebKit 또는 모바일 브라우저 지원
- 배포 provider 설정과 CI workflow
- 제품 완성 수준의 시각 디자인

## Decisions

### 1. React, Vite와 TypeScript를 사용한다

React는 향후 파일 입력, 비동기 오류, canvas 수명 주기와 애니메이션 선택 상태를 컴포넌트로 분리하기에 적합하다. Vite는 TypeScript와 React 공식 template 및 개발 middleware hook을 제공한다. Vanilla DOM 또는 Web Components 대안은 초기 의존성이 적지만 후속 UI 상태 관리 코드가 더 장황해진다.

앱은 `React.StrictMode`로 시작하고 router나 별도 전역 상태 저장소 없이 props, local state와 context만 사용한다.

### 2. pnpm을 유일한 패키지 관리자로 고정한다

루트 `package.json`의 `packageManager`에 pnpm 11 계열을 기록하고 `pnpm-lock.yaml`을 source of truth로 사용한다. npm/yarn lockfile은 추가하지 않는다. 설치는 `pnpm install --frozen-lockfile`로 재현 가능해야 한다.

### 3. 검증 명령을 독립적으로 제공한다

다음 script를 제공한다.

| 명령 | 책임 |
|---|---|
| `pnpm dev` | Vite 개발 서버 |
| `pnpm build` | TypeScript build 검사 후 Vite production build |
| `pnpm preview` | build 결과 로컬 확인 |
| `pnpm typecheck` | emit 없는 TypeScript 검사 |
| `pnpm lint` | ESLint 정적 검사 |
| `pnpm test` | Vitest 단위·컴포넌트 테스트 1회 실행 |
| `pnpm test:watch` | Vitest watch |
| `pnpm test:e2e` | Playwright Chromium 테스트 |

production build는 정상 허용한다. LiveSD runtime의 라이선스 및 고지는 기능 변경이 별도 release gate로 검증한다.

### 4. Vitest `jsdom`과 Testing Library를 사용한다

단위·컴포넌트 테스트는 `jsdom`에서 실행하고 `@testing-library/react`, `@testing-library/jest-dom`, `@testing-library/user-event`를 사용한다. WebGL과 runtime은 후속 변경에서 명시적 mock으로 대체한다. Vitest Browser Mode 대신 Playwright를 실제 브라우저 경계로 사용해 역할을 분리한다.

### 5. Playwright는 Chromium project 하나만 구성한다

Phase 1 지원 범위와 일치하도록 desktop Chromium project만 구성한다. e2e runner가 Vite 개발 서버를 자동으로 시작하고 기본 shell과 후속 파일 입력 flow를 same-origin에서 검증한다.

### 6. 최소 한국어 앱 shell을 제공한다

root app은 제품명 heading, 현재 단계 설명과 후속 기능이 상태를 알릴 `aria-live` 영역을 포함한다. CSS는 일반 stylesheet 한 장으로 시작하고 CSS framework나 component library는 추가하지 않는다.

## Risks / Trade-offs

- [Risk] 최신 toolchain의 Node 요구사항이 바뀔 수 있다. → `engines.node`와 package manager를 명시하고 설치 및 build에서 검증한다.
- [Risk] `React.StrictMode`가 개발 중 effect를 두 번 실행해 runtime 수명 주기 결함을 드러낼 수 있다. → 이를 비활성화하지 않고 후속 session 생성·dispose가 멱등적이게 구현한다.
- [Risk] Chromium 전용 테스트가 다른 브라우저 회귀를 잡지 못한다. → Phase 1 범위를 문서화하고 browser 확장은 별도 변경으로 추가한다.
- [Trade-off] jsdom과 Playwright를 함께 유지하면 테스트 의존성이 늘어난다. → 빠른 로직/컴포넌트 검증과 실제 브라우저 경계를 명확히 분리한다.

## Migration Plan

1. 루트 package와 TypeScript/Vite/ESLint 설정을 추가한다.
2. React entry, 최소 shell과 stylesheet를 추가한다.
3. Vitest와 Playwright 설정 및 smoke test를 추가한다.
4. 의존성을 설치해 lockfile을 생성한다.
5. typecheck, lint, unit test, e2e와 build를 모두 실행한다.
6. 문제가 있으면 신규 package와 `src/`, 테스트 설정을 제거해 문서 전용 상태로 되돌린다.

## Open Questions

없음. 라이브러리 선택과 Phase 1 브라우저 범위는 `DECISIONS.md`의 D-010으로 확정했다.
