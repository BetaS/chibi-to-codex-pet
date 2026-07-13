## Why

공개 GitHub Pages 앱의 방문과 실제 Pet ZIP 다운로드 관심도를 운영자가 개인적으로 파악할 수단이 없다. 별도 공개 카운터나 서버 저장소 없이 GA4의 기본 페이지 측정과 명시적인 다운로드 이벤트만 추가해 최소한의 제품 사용 지표를 확보한다.

## What Changes

- `VITE_GA_MEASUREMENT_ID`가 설정된 배포에서만 Google tag를 초기화하고 GA4 기본 페이지 측정을 활성화한다.
- 검증된 Codex Pet ZIP 다운로드 링크를 누를 때 `pet_zip_download` 이벤트만 전송한다.
- 측정 ID가 없거나 분석 스크립트가 차단된 환경에서도 앱과 다운로드가 기존과 동일하게 동작하도록 분석을 선택적 비차단 기능으로 유지한다.
- 개발·배포 환경변수 설정과 운영자가 GA4에서 지표를 확인하는 방법을 문서화한다.

## Capabilities

### New Capabilities

- `private-product-analytics`: 공개 카운터 없이 운영자 전용 GA4 방문 및 Pet ZIP 다운로드 이벤트 측정을 정의한다.

### Modified Capabilities

없음.

## Impact

- 앱 bootstrap과 분석 모듈, Codex Pet 다운로드 링크 및 관련 단위 테스트가 영향을 받는다.
- `.env.example`, GitHub Pages build 환경과 README에 선택적 GA4 measurement ID 설정이 추가된다.
- 새 runtime package나 서버, 데이터베이스는 추가하지 않으며 Google의 `gtag.js`만 설정된 배포에서 외부 로드한다.
