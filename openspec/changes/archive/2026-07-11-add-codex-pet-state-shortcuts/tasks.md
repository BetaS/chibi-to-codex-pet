## 1. Mapping snapshot 경계

- [x] 1.1 `CodexPetBuilder`가 초기 추천과 사용자 수정 뒤의 read-only mapping을 optional callback으로 알리도록 구현한다
- [x] 1.2 source 교체와 builder lifecycle에서 이전 mapping snapshot이 shortcut에 남지 않는 component test를 추가한다

## 2. Preview 상태 바로가기 UI

- [x] 2.1 9개 표준 상태의 고정 icon, localized accessible name·tooltip과 선택 상태를 제공하는 `CodexPetStateShortcuts`를 구현한다
- [x] 2.2 PRSK preview toolbar에 shortcut group을 연결하고 상태 click·mapping focus·변경과 직접 animation 선택의 선택 상태 전환을 구현한다
- [x] 2.3 shortcut click이 현재 mapping의 animation만 기존 session에서 재생하고 mapping, mirror, package 결과와 request generation을 보존하는 component test를 추가한다
- [x] 2.4 desktop preview에 맞는 compact 9-button layout과 mobile wrapping, disabled·focus·selected style을 추가한다
- [x] 2.5 네 locale catalog에 shortcut 문구를 추가하고 locale 전환에서 icon·선택·animation을 보존하는 test를 추가한다

## 3. 통합 검증

- [x] 3.1 실제 PRSK Chromium preview에서 직접 animation 선택과 상태 shortcut 재생이 공존하고 무네트워크로 동작하는 E2E를 추가한다
- [x] 3.2 typecheck, lint, unit/component, Playwright, production build와 `openspec validate add-codex-pet-state-shortcuts`를 통과시킨다

## 4. 모바일 레이아웃 회귀

- [x] 4.1 모바일 세로 toolbar의 wrapping과 shortcut flex basis를 재설정하고 9개 button을 content box 안의 3×3 grid로 고정한다
- [x] 4.2 390px mobile Chromium에서 toolbar·shortcut의 가로 overflow, 겹침과 3×3 배치를 검증하고 전체 품질 검사를 다시 통과시킨다
