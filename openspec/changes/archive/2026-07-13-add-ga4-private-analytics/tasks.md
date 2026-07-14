## 1. GA4 adapter

- [x] 1.1 `VITE_GA_MEASUREMENT_ID`를 검증하고 Google tag를 한 번 초기화하는 비차단 browser adapter를 구현한다.
- [x] 1.2 설정 누락·잘못된 ID·중복 초기화·최소 `pet_zip_download` payload를 adapter 단위 테스트로 검증한다.

## 2. 애플리케이션 연결

- [x] 2.1 앱 bootstrap에서 선택적으로 GA4를 초기화해 기본 `page_view` 측정을 활성화한다.
- [x] 2.2 검증된 Pet ZIP 링크 클릭을 analytics service에 연결하고 기존 Blob download 속성을 유지한다.
- [x] 2.3 Package 생성만으로는 이벤트가 발생하지 않고 각 링크 클릭마다 한 번 호출되는지 component test로 검증한다.

## 3. 배포 설정과 문서

- [x] 3.1 `.env.example`과 GitHub Pages workflow에 선택적 GA4 measurement ID build 설정을 추가한다.
- [x] 3.2 README에 GA4 web stream, repository variable, event 의미, 비공개 dashboard와 개인정보 검토 사항을 문서화한다.

## 4. 검증

- [x] 4.1 관련 단위 테스트, typecheck, lint와 production build를 실행해 analytics가 설정되지 않은 기본 환경도 통과하는지 확인한다.
- [x] 4.2 OpenSpec 변경을 strict 검증하고 공개 browser 경로에서 page-view 초기화와 다운로드 클릭 event를 확인한다.
