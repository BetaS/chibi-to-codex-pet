## 1. Preset 저장 계층

- [x] 1.1 versioned preset schema, field 정규화와 bounded catalog parser를 구현한다
- [x] 1.2 예외를 전파하지 않는 `localStorage` repository와 active preset 전환·새 세션 API를 구현한다
- [x] 1.3 schema, overwrite, 20개 제한, 손상 복구와 storage 실패 단위 테스트를 추가한다

## 2. Builder preset 수명주기

- [x] 2.1 preset selector와 네 locale의 label·새 세션 문구를 builder에 추가한다
- [x] 2.2 active preset을 source-ready 설정에 적용하고 없는 animation을 상태별 추천값으로 fallback한다
- [x] 2.3 검증된 build 성공 뒤 현재 설정을 Pet 이름으로 저장하고 새 세션 reset을 연결한다
- [x] 2.4 preset 복원·전환·성공/실패 build와 자동 source load 금지 component 회귀 테스트를 추가한다

## 3. 검색 가능한 상태 mapping

- [x] 3.1 공용 `SearchableCombobox`를 상태 mapping row에 연결하고 focus preview와 query reset을 지원한다
- [x] 3.2 상태 검색 label·placeholder·빈 결과 문구와 responsive layout을 네 locale에 추가한다
- [x] 3.3 검색, keyboard 선택, mapping 보존과 실제 Spine preview 연동 component 테스트를 추가한다

## 4. Production 검증

- [x] 4.1 production persistence verifier의 allowlist를 locale과 preset repository로 제한한다
- [x] 4.2 typecheck, lint, 단위 테스트, 관련 Playwright 회귀와 production build를 실행한다
