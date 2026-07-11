## 1. LiveSD session 수평 반전

- [x] 1.1 `LiveSDPreviewSession`에 runtime 독립 수평 반전 API를 추가하고 `WebGLLiveSDPreviewSession`에서 중심 기준 negative-width projection을 구현한다
- [x] 1.2 animation alpha calibration은 canonical 무반전 projection을 사용하고 최종 draw·resize·framing에서 현재 반전을 보존한다
- [x] 1.3 반전 상태에서 pointer look X를 역변환하고 toggle 사이 offset 비누적을 adapter unit test로 검증한다

## 2. Builder mirror와 PRSK preview 연결

- [x] 2.1 `CodexPetBuilder`가 초기·변경 전체 반전과 상태 preview의 현재 `mirrorX`를 optional callback으로 알리도록 구현한다
- [x] 2.2 상태 shortcut이 현재 mapping의 animation과 `mirrorX`를 함께 활성화하도록 component 계약을 확장한다
- [x] 2.3 `PrskIntegration`이 전체·상태 mirror를 XOR해 shortcut, mapping focus·변경·mirror checkbox와 direct animation 경로에 같은 session으로 적용한다
- [x] 2.4 source 교체 초기화와 locale 보존, mapping/package/network 무변경을 App·builder component test로 검증한다

## 3. 실제 렌더와 전체 검증

- [x] 3.1 실제 비대칭 Miku mobile WebGL preview에서 반전 전후 장식 pixel centroid가 중심 반대편으로 이동하는 E2E를 추가한다
- [x] 3.2 typecheck, lint, unit/component, 전체 Playwright와 production build를 통과시킨다
- [x] 3.3 `openspec validate sync-livesd-preview-horizontal-mirroring`를 통과시키고 OpenSpec 작업 상태를 동기화한다
