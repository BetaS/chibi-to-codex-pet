## 1. 패키지와 빌드 설정

- [x] 1.1 pnpm 11과 지원 Node 버전을 선언한 `package.json` 및 기본 script를 추가한다
- [x] 1.2 React, Vite, TypeScript와 검사·테스트 의존성을 설치하고 `pnpm-lock.yaml`을 생성한다
- [x] 1.3 TypeScript app/node 설정과 Vite React 설정을 추가한다
- [x] 1.4 ESLint 설정과 저장소 ignore 항목을 추가한다

## 2. React 앱 shell

- [x] 2.1 `index.html`, React entry와 `React.StrictMode` root를 추가한다
- [x] 2.2 제품 heading, 한국어 상태 설명과 `aria-live` 영역을 가진 최소 `App`을 구현한다
- [x] 2.3 CSS framework 없이 반응형 기본 stylesheet를 추가한다

## 3. 테스트 기반

- [x] 3.1 Vitest `jsdom`과 Testing Library setup을 구성한다
- [x] 3.2 앱 shell heading과 `aria-live` 영역을 검증하는 컴포넌트 테스트를 추가한다
- [x] 3.3 Playwright Chromium project와 Vite web server를 구성한다
- [x] 3.4 desktop Chromium에서 초기 앱 shell을 검증하는 e2e smoke test를 추가한다

## 4. Foundation 검증

- [x] 4.1 `pnpm install --frozen-lockfile`, typecheck, lint와 단위 테스트를 통과시킨다
- [x] 4.2 Playwright Chromium 설치 및 e2e smoke test를 통과시킨다
- [x] 4.3 production build를 통과시키고 산출물에 runtime 및 PRSK 자산이 없음을 확인한다
