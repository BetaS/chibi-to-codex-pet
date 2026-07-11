## 1. 공통 framing 계약

- [x] 1.1 `framingScale` 상한을 150%로 확장하고 최종 cell pixel 기반 X/Y offset 타입, 기본값, 범위와 검증 helper를 추가한다
- [x] 1.2 LiveSD preview session의 projection과 resize·animation redraw에 scale과 X/Y offset을 동일하게 적용한다
- [x] 1.3 frame sampler가 scale·offset snapshot을 표준 57개와 look 16개 canonical projection에 적용하고 잘못된 입력을 자원 생성 전에 거부하도록 구현한다

## 2. Package와 recipe 일관성

- [x] 2.1 Codex Pet builder가 framing 변경 시 진행 중·완료 결과를 무효화하고 생성 시 scale·offset을 snapshot하도록 구현한다
- [x] 2.2 package validator가 명시적인 custom framing에서 edge crop만 허용하고 empty·occupancy·geometry·unused cell 검사는 유지하도록 구현한다
- [x] 2.3 schema version 1 recipe에 optional X/Y offset 기본값·검증·직렬화를 추가하고 headless renderer에 같은 값을 전달한다

## 3. UI와 번역

- [x] 3.1 PRSK preview에 80%–150% scale과 cell pixel X/Y offset control, 초기화와 disabled 상태를 추가한다
- [x] 3.2 LiveSD canvas와 installed Codex Pet preview에 정확한 `192×208` border box와 size label을 표시한다
- [x] 3.3 한국어·영어·일본어·중국어 catalog에 framing label, 단위와 접근성 문구를 추가하고 responsive layout을 유지한다

## 4. 검증

- [x] 4.1 scale·offset projection, session redraw, sampler와 validator 정책의 단위 테스트를 추가한다
- [x] 4.2 builder invalidation, recipe round-trip과 네 locale UI control 통합 테스트를 추가한다
- [x] 4.3 typecheck, lint, 단위 테스트, 관련 Playwright와 production build를 실행하고 OpenSpec change를 검증한다
