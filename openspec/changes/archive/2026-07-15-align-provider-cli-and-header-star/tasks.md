## 1. Garupa recipe와 provider 계약

- [x] 1.1 Canonical recipe provider 집합과 strict `garupa-pinned` source parser를 추가하고 preset source validation을 shared recipe type으로 통합한다.
- [x] 1.2 Available game source에 non-empty CLI recipe provider 선언을 추가하고 development harness가 누락·미지원 선언을 거부하게 한다.

## 2. CLI renderer와 web builder 연결

- [x] 2.1 Headless recipe renderer가 Garupa pinned source를 frozen materializer와 LiveSD (Spine 4.0) sampler로 routing하도록 구현하고 runtime 분기 test를 추가한다.
- [x] 2.2 Garupa integration이 pinned source만 공통 builder의 recipe source로 전달하고 builder가 Garupa npx 명령·복사 action을 표시하는 회귀 test를 추가한다.
- [x] 2.3 CLI renderer bundle을 재생성하고 package·repository boundary 검증으로 provider asset 비포함을 확인한다.

## 3. GitHub Star UX

- [x] 3.1 Shared repository URL과 지원 locale message를 사용해 App header에 native Star link를 추가하고 반응형 style을 적용한다.
- [x] 3.2 Header link의 항상 표시, URL·새 탭 보안 속성, locale 전환과 idle network 무동작을 App test로 고정한다.
- [x] 3.3 Star modal trigger를 첫 다운로드 클릭에서 첫 성공한 Pet 생성 완료로 옮기고 다운로드 handler는 분석 이벤트만 유지한다.
- [x] 3.4 생성 성공 전 비노출, 성공 직후 무클릭 노출, 닫은 뒤 focus 복원과 재생성·반복 다운로드 시 무재노출 test를 추가한다.

## 4. 전체 검증

- [x] 4.1 관련·전체 test, App·CLI typecheck, lint, strict OpenSpec, renderer package와 diff 무결성 검사를 통과시킨다.
