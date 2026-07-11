## 1. 가시 geometry framing

- [x] 1.1 RGBA alpha bbox, pixel-edge world 역변환과 고정 8px projection 공용 helper 및 단위 테스트를 추가한다
- [x] 1.2 `LiveSD36Adapter` preview의 첫 frame과 animation 전환 framing을 실제 alpha calibration으로 전환한다
- [x] 1.3 `LiveSD36FrameSampler`에 57-frame coarse alpha calibration과 하나의 final canonical projection을 구현한다

## 2. 결정적인 2D WebGL 순서

- [x] 2.1 depth write/test와 간섭 가능한 3D state를 끄는 공용 LiveSD 2D WebGL state helper를 추가한다
- [x] 2.2 preview와 sampler context를 depth/stencil 없이 생성하고 매 draw 전에 2D state를 재적용한다
- [x] 2.3 오염된 depth state 복구, context 옵션 및 Spine draw order 보존을 단위 테스트한다

## 3. v2 atlas 시각 품질 검증

- [x] 3.1 package validator에 사용 cell alpha bbox, 4px 안전 여백 및 70% 표준 합집합 점유율 검사를 추가한다
- [x] 3.2 `PNG_CELL_CLIPPED`와 `PNG_OCCUPANCY_TOO_SMALL` 진단 및 정상·실패 fixture 단위 테스트를 추가한다

## 4. 실제 Airi·Miku export/install 검증

- [x] 4.1 Playwright E2E에 Airi·Miku 실제 ZIP의 alpha bbox 점유율과 안전 여백 검증을 추가한다
- [x] 4.2 로컬 `sd_07airi_normal`과 idle `z_test_F_negi01`인 `sd_21miku_normal`을 다운로드해 격리 root 및 승인된 Codex pets root에 설치한다
- [x] 4.3 웹 installed preview와 실제 Codex renderer에서 크기, clipping 및 layer-order 안정성을 screenshot으로 확인한다

## 5. 사용자 조절 Pet 크기

- [x] 5.1 `framingScale` 80%–100% 공통 계약과 bottom-anchored projection 계산 및 단위 테스트를 추가한다
- [x] 5.2 `LiveSDPreviewSession`에 cached bounds 기반 배율 getter/setter와 animation·resize 유지 테스트를 추가한다
- [x] 5.3 WebGL preview toolbar에 접근 가능한 range·output·reset을 추가하고 성공한 새 source에서만 100%로 초기화한다
- [x] 5.4 `framingScale`을 builder와 sampler에 전달하고 변경 시 진행 작업·기존 package 결과를 무효화하되 metadata와 mapping을 유지한다
- [x] 5.5 Airi 80%와 Miku 100% Playwright export/install에서 상대 alpha 크기, 점유율, 여백과 16방향 look을 검증한다

## 6. 회귀 검증 및 OpenSpec 완료

- [x] 6.1 전체 Vitest, Playwright, typecheck, lint와 production build를 다시 통과시킨다
- [x] 6.2 변경을 strict 검증하고 delta spec을 sync한 뒤 완료 change를 archive한다
