## 1. 실시간 preview PMA 합성

- [x] 1.1 `LiveSD36Adapter`가 PMA WebGL drawing buffer를 만들고 이미 PMA인 atlas upload에는 추가 premultiply를 적용하지 않도록 수정한다
- [x] 1.2 `WebGLLiveSDPreviewSession`이 모든 draw에서 PMA Spine renderer를 사용하도록 수정하고 context·unpack·renderer 계약 test를 갱신한다

## 2. Frame sampler와 PNG export

- [x] 2.1 PMA WebGL readback을 straight RGBA로 결정적으로 변환하는 alpha 0·반투명·불투명 pixel utility와 unit test를 추가한다
- [x] 2.2 `LiveSD36FrameSampler`의 context·renderer를 PMA로 전환하고 변환된 RGBA만 2D cell·atlas에 기록하도록 통합한다
- [x] 2.3 sampler unit test에서 PMA 설정, 변환 적용, 기존 alpha bounds·mirror·look frame 계약을 검증한다

## 3. 실제 자산 회귀와 전체 검증

- [x] 3.1 `sd_21miku_miko`를 mobile viewport·높은 device pixel ratio로 렌더링해 PMA context와 앞머리 seam 제거 결과를 screenshot·pixel 기준으로 검증한다
- [x] 3.2 실제 Miku/Airi Pet export·설치 회귀를 포함한 전체 Playwright, unit, typecheck, lint와 production build를 통과시킨다
- [x] 3.3 `openspec validate fix-prsk-premultiplied-alpha-seams`를 통과시키고 OpenSpec 작업 상태를 동기화한다
